"""
Fichier : dw_api_qualite_provider.py
Rôle    : Service de lecture des données qualité (Eval Plus) depuis BigQuery.
          Permet de récupérer les notes par agent, projet ou date.
Dépend  : dw_api_bigquery_connector
Module  : mypaie / backend / services / notes_qualite
"""

# #region IMPORTS
import logging
from typing import Optional
from google.cloud import bigquery
from google.cloud.exceptions import GoogleCloudError
from config.dw_api_bigquery_connector import (
    get_bigquery_client,
    GCP_PROJECT_ID,
    BQ_DATASET_QUALITE,
    BQ_TABLE_QUALITE,
    BQ_DATASET_PAIE,
    BQ_TABLE_PAIE_QUALITE,
)
from tools.bigquery_queries import (
    query_qualite_detail,
    query_qualite_count,
    query_qualite_stats_projets,
    query_qualite_stats_global
)
from tools.cache import get_cached, set_cached
# #endregion

# #region CONFIGURATION
logger = logging.getLogger(__name__)

COLONNES_EXPOSEES = [
    "ID_Eval",
    "Date_Evaluation",
    "Note_Sous_Item",
    "Sous_Item",
    "Item_Global",
    "Projet",
    "Agent",
    "Evaluateur",
    "Date_Import",
]
# #endregion


# #region SERVICE
def get_qualite_agents(
    date_debut: Optional[str] = None,
    date_fin: Optional[str] = None,
    agent: Optional[str] = None,
    projet: Optional[str] = None,
    limit: int = 10000,
    offset: int = 0,
) -> dict:
    """
    Interroge BigQuery pour récupérer les notes qualité des agents.
    """
    client = get_bigquery_client()

    # ── Nouveau schéma Silver : (matricule, date_ref, projet, kpi_code, kpi_value) ──
    table_ref = f"`{GCP_PROJECT_ID}.gcp_my_paie.paie_qualite`"

    where_clauses = ["kpi_value IS NOT NULL"]
    query_params = []

    if date_debut:
        where_clauses.append("date_ref >= @date_debut")
        query_params.append(
            {"name": "date_debut", "parameterType": {"type": "DATE"}, "parameterValue": {"value": date_debut.split()[0]}}
        )

    if date_fin:
        where_clauses.append("date_ref <= @date_fin")
        query_params.append(
            {"name": "date_fin", "parameterType": {"type": "DATE"}, "parameterValue": {"value": date_fin.split()[0]}}
        )

    # Dans le nouveau schéma, le filtre 'agent' correspond au matricule
    if agent:
        where_clauses.append("matricule = @matricule_filter")
        query_params.append(
            {"name": "matricule_filter", "parameterType": {"type": "STRING"}, "parameterValue": {"value": agent}}
        )

    if projet:
        where_clauses.append("projet = @projet")
        query_params.append(
            {"name": "projet", "parameterType": {"type": "STRING"}, "parameterValue": {"value": projet}}
        )

    where_str = f"WHERE {' AND '.join(where_clauses)}"

    # Agrège les kpi_code par session (matricule + date + projet) → score_global = AVG(kpi_value)
    data_query = f"""
        SELECT
            matricule AS agent,
            matricule,
            projet,
            date_ref AS date_evaluation,
            ROUND(AVG(kpi_value), 2) AS score_global,
            COUNT(DISTINCT kpi_code) AS nb_evaluations
        FROM {table_ref}
        {where_str}
        GROUP BY matricule, projet, date_ref
        ORDER BY date_ref DESC
        LIMIT @limit OFFSET @offset
    """

    count_query = f"""
        SELECT COUNT(*) AS total
        FROM (
            SELECT matricule, projet, date_ref
            FROM {table_ref}
            {where_str}
            GROUP BY matricule, projet, date_ref
        )
    """

    pagination_params = query_params + [
        {"name": "limit",  "parameterType": {"type": "INT64"}, "parameterValue": {"value": str(limit)}},
        {"name": "offset", "parameterType": {"type": "INT64"}, "parameterValue": {"value": str(offset)}},
    ]

    try:
        data_job  = client.query(data_query,  job_config=_build_job_config(pagination_params))
        count_job = client.query(count_query, job_config=_build_job_config(query_params))

        rows  = [dict(row) for row in data_job.result()]
        total = next(iter(count_job.result()), {"total": 0})["total"]
        rows  = _serialize_rows(rows)

        return {"data": rows, "total": int(total), "limit": limit, "offset": offset}

    except GoogleCloudError as err:
        logger.error("Erreur BigQuery lors de la lecture de la qualité: %s", err)
        raise


# TTL du cache stats projets : 5 minutes
_CACHE_TTL_STATS = 300


def get_qualite_stats_projets(
    date_debut: Optional[str] = None,
    date_fin: Optional[str] = None,
) -> list:
    """
    Récupère les statistiques agrégées (moyenne et nombre d'évals) par projet.
    """
    cache_key = f"stats_projets::{date_debut}::{date_fin}"
    cached = get_cached(cache_key)
    if cached is not None:
        logger.debug("Cache HIT stats_projets [%s]", cache_key)
        return cached

    client    = get_bigquery_client()
    table_ref = f"`{GCP_PROJECT_ID}.gcp_my_paie.paie_qualite`"

    where_clauses = ["kpi_value IS NOT NULL"]
    query_params  = []

    if date_debut:
        where_clauses.append("date_ref >= @date_debut")
        query_params.append({"name": "date_debut", "parameterType": {"type": "DATE"}, "parameterValue": {"value": date_debut.split()[0]}})
    if date_fin:
        where_clauses.append("date_ref <= @date_fin")
        query_params.append({"name": "date_fin", "parameterType": {"type": "DATE"}, "parameterValue": {"value": date_fin.split()[0]}})

    where_str = f"WHERE {' AND '.join(where_clauses)}"

    query = f"""
        SELECT
            projet,
            ROUND(AVG(kpi_value), 2) AS moyenne,
            COUNT(DISTINCT CONCAT(matricule, '_', CAST(date_ref AS STRING))) AS nbEvaluations
        FROM {table_ref}
        {where_str}
        GROUP BY 1
        ORDER BY moyenne DESC
    """

    try:
        job    = client.query(query, job_config=_build_job_config(query_params))
        result = [dict(row) for row in job.result()]
        set_cached(cache_key, result, _CACHE_TTL_STATS)
        return result
    except GoogleCloudError as err:
        logger.error("Erreur BigQuery stats projets qualité: %s", err)
        raise

def get_qualite_totaux_par_matricule(
    date_debut: Optional[str],
    date_fin: Optional[str],
    matricules: list,
    nom_matricule_map: Optional[dict] = None,
) -> dict:
    """
    Récupère la moyenne des scores qualité agrégée par matricule depuis paie_qualite.

    Priorité :
      1. Matching par matricule (colonne non NULL en base).
      2. Fallback par nom d'agent normalisé (LOWER(TRIM(agent))) quand
         matricule IS NULL — nécessite le mapping optionnel { nom_norm: matricule }.

    Retourne { matricule_str: moyenne_float, ... }
    """
    nom_matricule_map = nom_matricule_map or {}

    if not matricules and not nom_matricule_map:
        return {}

    from google.cloud import bigquery as bq
    client = get_bigquery_client()
    table_ref = f"`{GCP_PROJECT_ID}.gcp_my_paie.paie_qualite`"

    # ── Nouveau schéma Silver : on filtre par matricule uniquement ────────────
    # La colonne 'agent' (nom) n'existe plus dans le schéma Silver.
    if not matricules:
        return {}

    query_params = [
        bq.ArrayQueryParameter("matricules", "STRING", [str(m) for m in matricules]),
    ]
    where_clauses = [
        "matricule IN UNNEST(@matricules)",
        "kpi_value IS NOT NULL",
    ]

    if date_debut:
        where_clauses.append("date_ref >= @date_debut")
        query_params.append(bq.ScalarQueryParameter("date_debut", "DATE", date_debut))
    if date_fin:
        where_clauses.append("date_ref <= @date_fin")
        query_params.append(bq.ScalarQueryParameter("date_fin", "DATE", date_fin))

    sql = f"""
        SELECT
            matricule,
            ROUND(AVG(kpi_value), 2) AS moyenne
        FROM {table_ref}
        WHERE {" AND ".join(where_clauses)}
        GROUP BY matricule
    """

    try:
        job_config = bq.QueryJobConfig(query_parameters=query_params)
        rows = [dict(r) for r in client.query(sql, job_config=job_config).result()]
        return {str(r["matricule"]): r["moyenne"] for r in rows if r.get("matricule")}
    except GoogleCloudError as err:
        logger.error("Erreur BigQuery totaux qualité par matricule: %s", err)
        raise

def get_qualite_stats_global(
    date_debut: Optional[str] = None,
    date_fin: Optional[str] = None,
) -> dict:
    """
    Récupère les statistiques globales (moyenne totale, par item, par sous-item).
    """
    cache_key = f"stats_global::{date_debut}::{date_fin}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    client    = get_bigquery_client()
    table_ref = f"`{GCP_PROJECT_ID}.gcp_my_paie.paie_qualite`"

    where_clauses = ["kpi_value IS NOT NULL"]
    query_params  = []

    if date_debut:
        where_clauses.append("date_ref >= @date_debut")
        query_params.append({"name": "date_debut", "parameterType": {"type": "DATE"}, "parameterValue": {"value": date_debut.split()[0]}})
    if date_fin:
        where_clauses.append("date_ref <= @date_fin")
        query_params.append({"name": "date_fin", "parameterType": {"type": "DATE"}, "parameterValue": {"value": date_fin.split()[0]}})

    where_str = f"WHERE {' AND '.join(where_clauses)}"
    sql = f"""
        SELECT
            ROUND(AVG(kpi_value), 2) AS moyenne_globale,
            COUNT(DISTINCT CONCAT(matricule, '_', CAST(date_ref AS STRING))) AS nb_total
        FROM {table_ref}
        {where_str}
    """

    try:
        job  = client.query(sql, job_config=_build_job_config(query_params))
        row = list(job.result())[0]

        # On retourne une structure simplifiée sans les items codés en dur
        result = {
            "moyenne_globale": row["moyenne_globale"] or 0, 
            "nb_total": row["nb_total"] or 0, 
            "items": {} # À remplir dynamiquement via une table de config UI si besoin
        }

        set_cached(cache_key, result, _CACHE_TTL_STATS)
        return result

    except GoogleCloudError as err:
        logger.error("Erreur BigQuery stats global qualité: %s", err)
        raise


# Alias — la fonction ci-dessus (définie plus haut) est la version canonique.
# Cette redéfinition est supprimée pour éviter le shadowing.


# #endregion


# #region HELPERS INTERNES
def _build_job_config(params: list):
    from google.cloud import bigquery as bq
    bq_params = []
    for p in params:
        bq_params.append(
            bq.ScalarQueryParameter(
                p["name"],
                p["parameterType"]["type"],
                p["parameterValue"]["value"],
            )
        )
    config = bq.QueryJobConfig()
    config.query_parameters = bq_params
    return config


def _serialize_rows(rows: list) -> list:
    import datetime
    serialized = []
    for row in rows:
        clean = {}
        for key, value in row.items():
            if isinstance(value, (datetime.date, datetime.datetime)):
                clean[key] = value.isoformat()
            elif isinstance(value, str):
                clean[key] = _repair_encoding(value)
            else:
                clean[key] = value
        serialized.append(clean)
    return serialized


def _repair_encoding(val: any) -> any:
    if not isinstance(val, str):
        return val
    try:
        return val.encode('latin-1').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        return val
# #endregion
