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
from tools.sql_queries import (
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

    table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_QUALITE}.{BQ_TABLE_QUALITE}`"
    colonnes_str = ", ".join(COLONNES_EXPOSEES)

    where_clauses = []
    query_params = []

    if date_debut:
        where_clauses.append("Date_Evaluation >= @date_debut")
        query_params.append(
            {"name": "date_debut", "parameterType": {"type": "DATETIME"}, "parameterValue": {"value": date_debut}}
        )

    if date_fin:
        where_clauses.append("Date_Evaluation <= @date_fin")
        query_params.append(
            {"name": "date_fin", "parameterType": {"type": "DATETIME"}, "parameterValue": {"value": date_fin}}
        )

    if agent:
        where_clauses.append("Agent = @agent")
        query_params.append(
            {"name": "agent", "parameterType": {"type": "STRING"}, "parameterValue": {"value": agent}}
        )

    if projet:
        where_clauses.append("Projet = @projet")
        query_params.append(
            {"name": "projet", "parameterType": {"type": "STRING"}, "parameterValue": {"value": projet}}
        )

    where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    data_query  = query_qualite_detail(table_ref, colonnes_str, where_str)
    count_query = query_qualite_count(table_ref, where_str)

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
    table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_QUALITE}.{BQ_TABLE_QUALITE}`"

    where_clauses = []
    query_params  = []

    if date_debut:
        where_clauses.append("Date_Evaluation >= @date_debut")
        query_params.append({"name": "date_debut", "parameterType": {"type": "DATETIME"}, "parameterValue": {"value": date_debut}})
    if date_fin:
        where_clauses.append("Date_Evaluation <= @date_fin")
        query_params.append({"name": "date_fin", "parameterType": {"type": "DATETIME"}, "parameterValue": {"value": date_fin}})

    where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    query     = query_qualite_stats_projets(table_ref, where_str)

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

    # ─── Construction du prédicat d'identité (matricule OU nom d'agent) ─────
    identity_parts = []
    query_params   = []

    if matricules:
        identity_parts.append("(matricule IS NOT NULL AND matricule IN UNNEST(@matricules))")
        query_params.append(bq.ArrayQueryParameter("matricules", "STRING", [str(m) for m in matricules]))

    if nom_matricule_map:
        agent_names = list(nom_matricule_map.keys())
        identity_parts.append("(matricule IS NULL AND LOWER(TRIM(agent)) IN UNNEST(@agent_names))")
        query_params.append(bq.ArrayQueryParameter("agent_names", "STRING", agent_names))

    identity_clause = "(" + " OR ".join(identity_parts) + ")"
    where_clauses = [identity_clause]

    if date_debut:
        where_clauses.append("date_evaluation >= @date_debut")
        query_params.append(bq.ScalarQueryParameter("date_debut", "DATE", date_debut))
    if date_fin:
        where_clauses.append("date_evaluation <= @date_fin")
        query_params.append(bq.ScalarQueryParameter("date_fin", "DATE", date_fin))

    sql = f"""
        SELECT agent, matricule, ROUND(AVG(score_global), 2) AS moyenne
        FROM {table_ref}
        WHERE {" AND ".join(where_clauses)}
        GROUP BY agent, matricule
    """

    try:
        job_config = bq.QueryJobConfig(query_parameters=query_params)
        rows = [dict(r) for r in client.query(sql, job_config=job_config).result()]

        result = {}
        for r in rows:
            mat = r.get("matricule")
            if not mat:
                # Fallback via le nom normalisé fourni par le frontend
                nom_norm = (r.get("agent") or "").strip().lower()
                mat = nom_matricule_map.get(nom_norm)
            if mat:
                result[str(mat)] = r["moyenne"]

        return result
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
    table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_QUALITE}.{BQ_TABLE_QUALITE}`"

    where_clauses = []
    query_params  = []

    if date_debut:
        where_clauses.append("Date_Evaluation >= @date_debut")
        query_params.append({"name": "date_debut", "parameterType": {"type": "DATETIME"}, "parameterValue": {"value": date_debut}})
    if date_fin:
        where_clauses.append("Date_Evaluation <= @date_fin")
        query_params.append({"name": "date_fin", "parameterType": {"type": "DATETIME"}, "parameterValue": {"value": date_fin}})

    where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    query     = query_qualite_stats_global(table_ref, where_str)

    try:
        job  = client.query(query, job_config=_build_job_config(query_params))
        rows = [dict(row) for row in job.result()]

        result = {"moyenne_globale": 0, "nb_total": 0, "items": {}}

        for row in rows:
            it  = row["item"]
            sit = row["sous_item"]
            moy = row["moyenne"]
            nb  = row["nb"]

            if it is None and sit is None:
                result["moyenne_globale"] = moy
                result["nb_total"]        = nb
            elif sit is None:
                if it not in result["items"]:
                    result["items"][it] = {"moyenne": 0, "nb": 0, "sous_items": {}}
                result["items"][it]["moyenne"] = moy
                result["items"][it]["nb"]      = nb
            else:
                if it not in result["items"]:
                    result["items"][it] = {"moyenne": 0, "nb": 0, "sous_items": {}}
                result["items"][it]["sous_items"][sit] = {"moyenne": moy, "nb": nb}

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
