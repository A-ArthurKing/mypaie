"""
Fichier : dw_api_performance_provider.py
Rôle    : Service de lecture des données de performance (PVCP) depuis BigQuery.
          Extrait les métriques JSON et gère les filtres.
          La résolution des noms de projet se fait depuis MySQL (ref_projets_mapping),
          sans JOIN BigQuery — architecture découplée et plus maintenable.
Module  : mypaie / backend / services / performance
"""

import logging
import json
import re
import datetime
from typing import Optional
from google.cloud import bigquery
from google.cloud.exceptions import GoogleCloudError
from config.dw_api_bigquery_connector import get_bigquery_client, GCP_PROJECT_ID, BQ_DATASET_PAIE, BQ_TABLE_PAIE_PERF
from tools.bigquery_queries import query_performance_detail, query_performance_count

logger = logging.getLogger(__name__)


# #region HELPERS — Résolution des noms de projets depuis MySQL

def _load_projet_mapping() -> dict:
    """
    Charge le mapping source_name → nom standard depuis MySQL ref_projets_mapping.
    Retourne un dict { 'NOM_SOURCE_UPPER': 'Nom Standard' } pour résolution rapide.
    En cas d'erreur de connexion, retourne un dict vide (non bloquant).
    """
    try:
        import pymysql
        from config.db_mysql_connector import get_mysql_connection
        conn = get_mysql_connection()
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute("""
                SELECT pm.source_name, p.nom AS standard_name
                FROM ref_projets_mapping pm
                LEFT JOIN ref_projets p ON p.id = pm.id_projet
                WHERE pm.source_name IS NOT NULL
            """)
            rows = cur.fetchall()
        conn.close()
        # Clé en UPPER pour comparaison insensible à la casse
        return {r["source_name"].strip().upper(): r["standard_name"] for r in rows if r["standard_name"]}
    except Exception as e:
        logger.warning("Impossible de charger ref_projets_mapping depuis MySQL : %s", e)
        return {}


def _resolve_projet(raw_name: Optional[str], mapping: dict) -> Optional[str]:
    """
    Résout le nom brut BigQuery vers le nom standard MySQL.
    Retourne le nom brut si aucun mapping trouvé.
    """
    if not raw_name:
        return raw_name
    return mapping.get(raw_name.strip().upper(), raw_name)

# #endregion


# #region LECTURE PERFORMANCE PVCP

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
    Les noms de projets bruts BigQuery sont résolus via MySQL (ref_projets_mapping).
    Granularity : 'total' (default), 'month', 'week'
    """
    client = get_bigquery_client()

    # Chargement anticipé du mapping projet (non bloquant si MySQL indisponible)
    projet_mapping = _load_projet_mapping()

    # Choix de la source selon la granularité
    # Note : On utilise la table mensuelle par défaut car plus performante pour les totaux
    if granularity == "month":
        table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.paie_performance_mensuelle`"
        date_col = "mois"
        is_string_date = True
    elif granularity == "week":
        table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.paie_performance_hebdomadaire`"
        date_col = "date_ref"
        is_string_date = False
    else:
        # Cas 'total' ou autre : on utilise la mensuelle pour agréger
        table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.paie_performance_mensuelle`"
        date_col = "mois"
        is_string_date = True

    where_clauses = []
    query_params = []

    if date_debut:
        where_clauses.append(f"{date_col} >= @date_debut")
        # Ajustement du type de paramètre selon la colonne
        if is_string_date:
            val = date_debut[:7] if len(date_debut) > 7 else date_debut
            query_params.append(bigquery.ScalarQueryParameter("date_debut", "STRING", val))
        else:
            query_params.append(bigquery.ScalarQueryParameter("date_debut", "DATE", date_debut))

    if date_fin:
        where_clauses.append(f"{date_col} <= @date_fin")
        if is_string_date:
            val = date_fin[:7] if len(date_fin) > 7 else date_fin
            query_params.append(bigquery.ScalarQueryParameter("date_fin", "STRING", val))
        else:
            query_params.append(bigquery.ScalarQueryParameter("date_fin", "DATE", date_fin))

    if agent:
        where_clauses.append("LOWER(agent_nom) LIKE @agent")
        query_params.append(bigquery.ScalarQueryParameter("agent", "STRING", f"%{agent.lower()}%"))

    where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    # Requêtes selon granularité
    if granularity in ["month", "week"]:
        sql_data = f"""
            SELECT 
                matricule AS agent_id_hash,
                ANY_VALUE(matricule) AS agent_name,
                matricule,
                {date_col},
                ANY_VALUE(projet) AS projet,
                SUM(IF(kpi_code IN ('in_call_nbr', 'nb_appels'), valeur_sum, 0))        AS in_call_nbr,
                SUM(IF(kpi_code IN ('booking_nbr', 'nb_ventes'), valeur_sum, 0))        AS booking_nbr,
                SUM(IF(kpi_code IN ('in_call_min_nbr', 'temps_appel'), valeur_sum, 0))  AS call_min,
                SUM(IF(kpi_code IN ('agent_logged_time_min_nbr', 'call_worked_time_min_nbr', 'temps_production'), valeur_sum, 0)) AS logged_min,
                SUM(IF(kpi_code IN ('agent_logged_time_min_nbr', 'call_worked_time_min_nbr', 'temps_production'), valeur_sum, 0)) AS worked_min,
                SUM(nb_jours)                                                           AS nb_records,
                MAX(last_update)                                                        AS date_ajout,
                SUM(IF(kpi_code IN ('net_booking_rental_amt_eur', 'chiffre_affaire'), valeur_sum, 0)) AS chiffre_affaire,
                SAFE_DIVIDE(SUM(IF(kpi_code IN ('booking_nbr', 'nb_ventes'), valeur_sum, 0)), NULLIF(SUM(IF(kpi_code IN ('in_call_nbr', 'nb_appels'), valeur_sum, 0)), 0)) * 100 AS taux_conversion_calc,
                AVG(IF(kpi_code IN ('tx_mea'), valeur_avg, 0))                          AS tx_mea,
                SAFE_DIVIDE(SUM(IF(kpi_code IN ('csat_nbr', 'csat'), valeur_sum, 0)), NULLIF(SUM(IF(kpi_code IN ('total_csat_num', 'nb_csat'), valeur_sum, 0)), 0)) AS csat_moyen
            FROM {table_ref}
            {where_str}
            GROUP BY matricule, {date_col}
            ORDER BY {date_col} DESC, matricule ASC
            LIMIT @limit OFFSET @offset
        """
        sql_count = f"SELECT COUNT(*) AS total FROM (SELECT matricule FROM {table_ref} {where_str} GROUP BY matricule, {date_col})"
    else:
        sql_data = query_performance_detail(table_ref, where_str)
        sql_count = query_performance_count(table_ref, where_str)

    pagination_params = query_params + [
        bigquery.ScalarQueryParameter("limit", "INT64", limit),
        bigquery.ScalarQueryParameter("offset", "INT64", offset),
    ]

    try:
        job_config_data = bigquery.QueryJobConfig(query_parameters=pagination_params)
        data_job = client.query(sql_data, job_config=job_config_data)
        results = [dict(row) for row in data_job.result()]

        for r in results:
            # Résolution du nom de projet brut BQ → nom standard MySQL
            r["projet"] = _resolve_projet(r.get("projet"), projet_mapping)

            r["chiffre_affaire"] = r.get("chiffre_affaire")
            r["taux_conversion_calc"] = r.get("taux_conversion") if granularity in ["month", "week"] else r.get("taux_conversion_calc")

            r["metrics_full"] = {
                "in_call_nbr":               r.get("in_call_nbr"),
                "booking_nbr":               r.get("booking_nbr"),
                "in_call_min_nbr":           r.get("call_min"),
                "call_worked_time_min_nbr":  r.get("worked_min"),
                "agent_logged_time_min_nbr": r.get("logged_min"),
                "chiffre_affaire":           r.get("chiffre_affaire"),
                "taux_conversion_calc":      r.get("taux_conversion_calc"),
                "csat_moyen":                r.get("csat_moyen"),
                "nb_records":                r.get("nb_records"),
                "is_consolidated":           True,
                "granularity":               granularity,
                "date_val":                  r.get("mois") if granularity == "month" else r.get("date_ref"),
            }

            # Sérialisation des dates
            for key, value in r.items():
                if isinstance(value, (datetime.date, datetime.datetime)):
                    r[key] = value.isoformat()

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

# #endregion


# #region MOTEUR DE FORMULES DYNAMIQUES (KPIs VIRTUELS)

from tools.kpi_engine import evaluate_formula, get_kpi_registry

# #endregion


# #region HELPERS — Mapping matricule numérique ↔ nom BQ

def _load_nom_matricule_mapping(matricules: list) -> dict:
    """
    Charge depuis ref_employes le mapping { NOM_COMPLET_UPPER: matricule_numerique }
    pour les matricules demandés.

    BigQuery paie_performance_mensuelle stocke NOM + ' ' + PRENOM comme identifiant
    dans la colonne 'matricule'. Cette fonction permet la correspondance inverse.
    Retourne {} en cas d'erreur (non-bloquant).
    """
    if not matricules:
        return {}
    try:
        import pymysql
        from config.db_mysql_connector import get_mysql_connection
        conn = get_mysql_connection()
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            phs = ",".join(["%s"] * len(matricules))
            cur.execute(
                f"SELECT matricule, nom, prenom FROM ref_employes WHERE matricule IN ({phs})",
                list(matricules)
            )
            rows = cur.fetchall()
        conn.close()
        return {
            (r['nom'].strip() + ' ' + r['prenom'].strip()).upper(): str(r['matricule'])
            for r in rows if r.get('nom') and r.get('prenom')
        }
    except Exception as e:
        logger.warning("Impossible de charger le mapping nom→matricule depuis ref_employes : %s", e)
        return {}

# #endregion


# #region KPI NATIVE DYNAMIQUES — chargement depuis config_kpis

# (Suppression de _load_native_bq_kpi_definitions car on passe en dynamique total)

# #endregion


def get_perf_totaux_par_matricule(
    date_debut: Optional[str],
    date_fin: Optional[str],
    matricules: list,
) -> dict:
    """
    Retourne TOUTES les métriques de performance brutes de BigQuery par matricule.
    Renvoie systématiquement {kpi_code}_sum et {kpi_code}_avg.
    Résultat : { matricule_str: { "Duration_call_sum": X, "Duration_call_avg": Y, ... } }
    """
    if not matricules:
        return {}

    client = get_bigquery_client()
    table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.paie_performance_mensuelle`"

    # Mapping NOM_COMPLET_UPPER → matricule_numerique
    nom_mat_map = _load_nom_matricule_mapping(matricules)
    if nom_mat_map:
        mat_literals = ", ".join(f"'{name}'" for name in nom_mat_map.keys())
        where_clauses = [f"UPPER(matricule) IN ({mat_literals})"]
    else:
        mat_literals = ", ".join(f"'{str(m).upper()}'" for m in matricules)
        where_clauses = [f"UPPER(matricule) IN ({mat_literals})"]
        
    query_params = []

    if date_debut:
        where_clauses.append("mois >= @date_debut")
        query_params.append(bigquery.ScalarQueryParameter("date_debut", "STRING", date_debut[:7]))
    if date_fin:
        where_clauses.append("mois <= @date_fin")
        query_params.append(bigquery.ScalarQueryParameter("date_fin", "STRING", date_fin[:7]))

    where_str = "WHERE " + " AND ".join(where_clauses)

    # Extraction Totale (Wide-Fetch) sans filtrer par noms de KPIs
    sql = f"""
        SELECT
            matricule,
            kpi_code,
            SUM(valeur_sum) as total_sum,
            AVG(valeur_avg) as total_avg
        FROM {table_ref}
        {where_str}
        GROUP BY matricule, kpi_code
    """

    try:
        job_config = bigquery.QueryJobConfig(query_parameters=query_params)
        rows = list(client.query(sql, job_config=job_config).result())
        
        result = {}
        # Construction dynamique
        for r in rows:
            bq_mat = str(r["matricule"]).upper()
            mat = nom_mat_map.get(bq_mat, bq_mat)
            
            kpi_code = r["kpi_code"]
            if not kpi_code:
                continue
                
            if mat not in result:
                result[mat] = {}
                
            # Double Export
            result[mat][f"{kpi_code}_sum"] = r["total_sum"]
            result[mat][f"{kpi_code}_avg"] = r["total_avg"]

        return result
    except GoogleCloudError as e:
        logger.error("Erreur BigQuery perf totaux par matricule : %s", e)
        raise

# #endregion
