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


# ─── Moteur de formules dynamiques ──────────────────────────────────────────

import re as _re

# Seuls les caractères arithmétiques et noms de colonnes sont autorisés
_SAFE_FORMULA_RE = _re.compile(r'^[\w\s\.\+\-\*/\(\)]+$')

def _get_formula_kpi_mappings() -> list:
    """
    Charge depuis MySQL les KPIs basés sur une formule (is_formula=1).
    Retourne une liste de dicts {formula, tech_key}.
    """
    try:
        import pymysql
        from config.db_mysql_connector import get_mysql_connection
        conn = get_mysql_connection()
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute("""
                SELECT m.formula, k.tech_key
                FROM matrice_kpis_mapping m
                JOIN matrice_kpis k ON k.code = m.standard_kpi_code
                WHERE m.is_formula = 1
                  AND m.formula IS NOT NULL
                  AND m.formula != ''
                  AND k.actif = 1
                  AND k.tech_key IS NOT NULL
                GROUP BY k.tech_key
            """)
            return cur.fetchall()
    except Exception as e:
        logger.warning("Impossible de charger les formules KPI dynamiques : %s", e)
        return []
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _evaluate_formula(formula: str, row_ctx: dict):
    """
    Évalue une formule arithmétique de façon sécurisée.
    Les références table.colonne sont normalisées en colonne seule.
    Ex: 'paie_performance.chiffre_affaire / paie_performance.nb_ventes'
         → eval('chiffre_affaire / nb_ventes', ctx)
    """
    # Normaliser : table.colonne → colonne
    expr = _re.sub(r'\b[a-zA-Z_]\w*\.([a-zA-Z_]\w*)\b', r'\1', formula).strip()
    # Vérification de sécurité : aucun caractère non autorisé
    if not _SAFE_FORMULA_RE.match(expr):
        logger.warning("Formule rejetée (caractères non autorisés) : %s", formula)
        return None
    try:
        result = eval(  # noqa: S307 – contexte restreint, formules admin uniquement
            expr,
            {"__builtins__": {}},
            {k: (v if v is not None else 0) for k, v in row_ctx.items()}
        )
        return round(float(result), 4) if result is not None else None
    except (ZeroDivisionError, TypeError, NameError, SyntaxError) as e:
        logger.debug("Erreur évaluation formule '%s' : %s", formula, e)
        return None

# ─────────────────────────────────────────────────────────────────────────────


def get_perf_totaux_par_matricule(
    date_debut: Optional[str],
    date_fin: Optional[str],
    matricules: list,
) -> dict:
    """
    Retourne les métriques de performance agrégées par matricule.
    Inclut les métriques hardcodées (DMT, CVR…) ET toutes les formules
    dynamiques définies dans matrice_kpis_mapping (is_formula=1).
    Résultat : { matricule_str: { "dmt": X, "cvr": Y, "avg_nbr": Z, … } }
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
            -- Métriques calculées standard
            SAFE_DIVIDE(SUM(temps_appel), SUM(nb_appels)) * 60              AS dmt_sec,
            SAFE_DIVIDE(SUM(nb_ventes),   SUM(nb_appels)) * 100             AS cvr_pct,
            AVG(tx_mea)                                                     AS tx_mea_avg,
            AVG(chiffre_affaire)                                            AS avg_ca,
            SAFE_DIVIDE(SUM(csat * nb_csat), NULLIF(SUM(nb_csat), 0))      AS csat_moyen,
            SAFE_DIVIDE(SUM(chiffre_affaire), NULLIF(SUM(nb_ventes), 0))   AS avg_nbr,
            -- Agrégats bruts exposés au moteur de formules
            SUM(nb_ventes)                                                  AS nb_ventes_total,
            SUM(nb_appels)                                                  AS nb_appels_total,
            SUM(nb_csat)                                                    AS nb_csat_total,
            SUM(chiffre_affaire)                                            AS sum_chiffre_affaire,
            SUM(temps_production)                                           AS sum_temps_production,
            SUM(temps_appel)                                                AS sum_temps_appel,
            SUM(csat)                                                       AS sum_csat,
            AVG(taux_conversion)                                            AS avg_taux_conversion
        FROM {table_ref}
        {where_str}
        GROUP BY matricule
    """

    # Charger les formules dynamiques depuis MySQL (une seule fois par appel)
    formula_mappings = _get_formula_kpi_mappings()

    try:
        job_config = bigquery.QueryJobConfig(query_parameters=query_params)
        rows = list(client.query(sql, job_config=job_config).result())
        result = {}
        for r in rows:
            mat = str(r["matricule"])

            # Métriques hardcodées
            entry = {
                "dmt":       round(r["dmt_sec"], 1)       if r["dmt_sec"]    is not None else None,
                "cvr":       round(r["cvr_pct"], 2)       if r["cvr_pct"]    is not None else None,
                "tx_mea":    round(r["tx_mea_avg"], 2)    if r["tx_mea_avg"] is not None else None,
                "avg_ca":    round(r["avg_ca"], 2)        if r["avg_ca"]     is not None else None,
                "csat_moyen":round(r["csat_moyen"], 2)    if r["csat_moyen"] is not None else None,
                "avg_nbr":   round(r["avg_nbr"], 2)       if r["avg_nbr"]    is not None else None,
                "nb_ventes": int(r["nb_ventes_total"])    if r["nb_ventes_total"] is not None else None,
                "nb_appels": int(r["nb_appels_total"])    if r["nb_appels_total"] is not None else None,
                "nb_csat":   int(r["nb_csat_total"])      if r["nb_csat_total"]   is not None else None,
            }

            # Contexte brut pour le moteur de formules (noms = colonnes BigQuery)
            formula_ctx = {
                "chiffre_affaire":  r["sum_chiffre_affaire"],
                "nb_ventes":        r["nb_ventes_total"],
                "nb_appels":        r["nb_appels_total"],
                "temps_production": r["sum_temps_production"],
                "temps_appel":      r["sum_temps_appel"],
                "csat":             r["sum_csat"],
                "nb_csat":          r["nb_csat_total"],
                "tx_mea":           r["tx_mea_avg"],
                "taux_conversion":  r["avg_taux_conversion"],
            }

            # Évaluation dynamique de chaque formule → stockée sous son tech_key
            for fm in formula_mappings:
                tech_key = fm.get("tech_key")
                formula  = fm.get("formula")
                if tech_key and formula and tech_key not in entry:
                    entry[tech_key] = _evaluate_formula(formula, formula_ctx)

            result[mat] = entry
        return result
    except GoogleCloudError as e:
        logger.error("Erreur BigQuery perf totaux par matricule : %s", e)
        raise
