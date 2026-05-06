"""
Fichier : dw_api_performance_provider.py
Rôle    : Service de lecture des données de performance (PVCP) depuis BigQuery.
          Extrait les métriques JSON et gère les filtres.
Module  : mypaie / backend / services / performance
"""

import logging
import json
import datetime
from typing import Optional
from google.cloud import bigquery
from google.cloud.exceptions import GoogleCloudError
from config.dw_api_bigquery_connector import get_bigquery_client, GCP_PROJECT_ID, BQ_DATASET_PAIE, BQ_TABLE_PAIE_PERF
from tools.sql_queries import query_performance_detail, query_performance_count

logger = logging.getLogger(__name__)

def get_performance_pvcp(
    date_debut: Optional[str] = None,
    date_fin: Optional[str] = None,
    agent: Optional[str] = None,
    granularity: str = "total",
    limit: int = 500,
    offset: int = 0
) -> dict:
    """
    Récupère les données de performance depuis la table normalisée ou les vues.
    Granularity : 'total' (default), 'month', 'week'
    """
    client = get_bigquery_client()
    
    # Choix de la source selon la granularité
    if granularity == "month":
        table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.v_paie_agent_mensuel`"
        date_col = "mois" # Format 'YYYY-MM'
    elif granularity == "week":
        table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.v_paie_agent_hebdo`"
        date_col = "date_ref"
    else:
        table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.{BQ_TABLE_PAIE_PERF}`"
        date_col = "date_ref"

    where_clauses = []
    query_params = []

    if date_debut:
        where_clauses.append(f"{date_col} >= @date_debut")
        if granularity == "month" and len(date_debut) > 7:
            date_debut_param = date_debut[:7]
            query_params.append(bigquery.ScalarQueryParameter("date_debut", "STRING", date_debut_param))
        else:
            query_params.append(bigquery.ScalarQueryParameter("date_debut", "DATE" if granularity != "month" else "STRING", date_debut))

    if date_fin:
        where_clauses.append(f"{date_col} <= @date_fin")
        if granularity == "month" and len(date_fin) > 7:
            date_fin_param = date_fin[:7]
            query_params.append(bigquery.ScalarQueryParameter("date_fin", "STRING", date_fin_param))
        else:
            query_params.append(bigquery.ScalarQueryParameter("date_fin", "DATE" if granularity != "month" else "STRING", date_fin))

    if agent:
        where_clauses.append("LOWER(agent_nom) LIKE @agent")
        query_params.append(bigquery.ScalarQueryParameter("agent", "STRING", f"%{agent.lower()}%"))

    where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    # Pour les vues, les colonnes sont déjà pré-agrégées
    if granularity in ["month", "week"]:
        sql_data = f"""
            SELECT *, matricule as agent_id_hash, agent_nom as agent_name 
            FROM {table_ref} 
            {where_str} 
            ORDER BY {date_col} DESC, agent_nom ASC
            LIMIT @limit OFFSET @offset
        """
        sql_count = f"SELECT COUNT(*) as total FROM {table_ref} {where_str}"
    else:
        sql_data = query_performance_detail(table_ref, where_str)
        sql_count = query_performance_count(table_ref, where_str)
    
    # Paramètres additionnels pour la pagination
    pagination_params = query_params + [
        bigquery.ScalarQueryParameter("limit", "INT64", limit),
        bigquery.ScalarQueryParameter("offset", "INT64", offset)
    ]

    try:
        # Exécution data
        job_config_data = bigquery.QueryJobConfig(query_parameters=pagination_params)
        data_job = client.query(sql_data, job_config=job_config_data)
        results = [dict(row) for row in data_job.result()]

        # Transformation pour la compatibilité Frontend
        for r in results:
            r['chiffre_affaire'] = r.get('chiffre_affaire')
            r['taux_conversion_calc'] = r.get('taux_conversion') if granularity in ["month", "week"] else r.get('taux_conversion_calc')
            
            r['metrics_full'] = {
                'in_call_nbr': r.get('in_call_nbr'),
                'booking_nbr': r.get('nb_ventes') if granularity in ["month", "week"] else r.get('booking_nbr'),
                'in_call_min_nbr': r.get('temps_appel') if granularity in ["month", "week"] else r.get('call_min'),
                'call_worked_time_min_nbr': r.get('temps_appel') if granularity in ["month", "week"] else r.get('worked_min'),
                'agent_logged_time_min_nbr': r.get('temps_production') if granularity in ["month", "week"] else r.get('logged_min'),
                'chiffre_affaire': r.get('chiffre_affaire'),
                'taux_conversion_calc': r.get('taux_conversion') if granularity in ["month", "week"] else r.get('taux_conversion_calc'),
                'csat_moyen': r.get('csat'),
                'nb_records': r.get('nb_records') if granularity == "month" else (1 if granularity == "week" else r.get('nb_records')),
                'is_consolidated': True,
                'granularity': granularity,
                'date_val': r.get('mois') if granularity == "month" else r.get('date_ref')
            }
            
            # Sérialisation des dates
            for key, value in r.items():
                if isinstance(value, (datetime.date, datetime.datetime)):
                    r[key] = value.isoformat()

        # Exécution count
        job_config_count = bigquery.QueryJobConfig(query_parameters=query_params)
        count_job = client.query(sql_count, job_config=job_config_count)
        total_res = next(iter(count_job.result()), {"total": 0})
        total = total_res.get("total", 0)

        return {"data": results, "total": int(total)}

    except GoogleCloudError as e:
        logger.error("Erreur BigQuery Performance : %s", e)
        raise e
    except Exception as e:
        logger.error("Erreur Inattendue Performance : %s", e)
        raise e


def get_perf_totaux_par_matricule(
    date_debut: Optional[str],
    date_fin: Optional[str],
    matricules: list,
) -> dict:
    """
    Retourne la DMT (en secondes) et le CVR Naturelle (%) agrégés par matricule.
    DMT = SAFE_DIVIDE(SUM(temps_appel_min), SUM(nb_appels)) * 60
    CVR = SAFE_DIVIDE(SUM(nb_ventes), SUM(nb_appels)) * 100
    Résultat : { matricule_str: { "dmt": X, "cvr": Y }, ... }
    """
    if not matricules:
        return {}

    client = get_bigquery_client()
    table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.{BQ_TABLE_PAIE_PERF}`"

    mat_literals = ", ".join(f"'{m}'" for m in matricules)
    where_clauses = [f"matricule IN ({mat_literals})", "nb_appels > 0"]
    query_params = []

    if date_debut:
        where_clauses.append("date_ref >= @date_debut")
        query_params.append(bigquery.ScalarQueryParameter("date_debut", "DATE", date_debut))
    if date_fin:
        where_clauses.append("date_ref <= @date_fin")
        query_params.append(bigquery.ScalarQueryParameter("date_fin", "DATE", date_fin))

    where_str = "WHERE " + " AND ".join(where_clauses)
    sql = f"""
        SELECT
            matricule,
            SAFE_DIVIDE(SUM(temps_appel), SUM(nb_appels)) * 60              AS dmt_sec,
            SAFE_DIVIDE(SUM(nb_ventes),   SUM(nb_appels)) * 100             AS cvr_pct,
            AVG(tx_mea)                                                     AS tx_mea_avg,
            AVG(chiffre_affaire)                                            AS avg_ca
        FROM {table_ref}
        {where_str}
        GROUP BY matricule
    """

    try:
        job_config = bigquery.QueryJobConfig(query_parameters=query_params)
        rows = list(client.query(sql, job_config=job_config).result())
        result = {}
        for r in rows:
            mat = str(r["matricule"])
            result[mat] = {
                "dmt": round(r["dmt_sec"], 1) if r["dmt_sec"] is not None else None,
                "cvr": round(r["cvr_pct"], 2) if r["cvr_pct"] is not None else None,
                "tx_mea": round(r["tx_mea_avg"], 2) if r["tx_mea_avg"] is not None else None,
                "avg_ca": round(r["avg_ca"], 2) if r["avg_ca"] is not None else None,
            }
        return result
    except GoogleCloudError as e:
        logger.error("Erreur BigQuery perf totaux par matricule : %s", e)
        raise
