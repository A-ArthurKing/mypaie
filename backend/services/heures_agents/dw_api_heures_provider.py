"""
Fichier : dw_api_heures_provider.py
Rôle    : Service de lecture des heures agents depuis BigQuery.
          Applique les filtres de date et de matricule, et retourne
          les données paginées sous forme de liste de dictionnaires.
Dépend  : dw_api_bigquery_connector
Module  : mypaie / backend / services / heures_agents
"""

# #region IMPORTS
import logging
from typing import Optional
from google.cloud.exceptions import GoogleCloudError
from config.dw_api_bigquery_connector import get_bigquery_client, GCP_PROJECT_ID, BQ_DATASET_ID, BQ_TABLE_HEURES
from tools.sql_queries import (
    query_heures_detail,
    query_heures_count,
    query_equipes_distinctes,
    query_projets_heures_distincts
)
from tools.cache import get_cached, set_cached
# #endregion

# #region CONFIGURATION
logger = logging.getLogger(__name__)

COLONNES_EXPOSEES = [
    "matricule",
    "LastName",
    "FirstName",
    "Equipe",
    "date",
    "projet",
    "heure_ht",
    "heure_hp",
    "heure_hc",
    "heure_hf",
    "heure_total",
    "heure_ecart",
    "TYPE_CONGE",
    "TYPE_FORMATION",
    "cloture_sup",
    "cloture_rh",
    "updated_at",
]
# #endregion


# #region SERVICE
def get_heures_agents(
    date_debut: Optional[str] = None,
    date_fin: Optional[str] = None,
    matricule: Optional[str] = None,
    equipe: Optional[str] = None,
    projet: Optional[str] = None,
    limit: int = 500,
    offset: int = 0,
) -> dict:
    """
    Interroge BigQuery pour récupérer les heures des agents.
    Applique les filtres passés en paramètre et retourne un dict
    contenant les données et le nombre total de lignes trouvées.
    """
    client = get_bigquery_client()

    table_ref    = f"`{GCP_PROJECT_ID}.{BQ_DATASET_ID}.{BQ_TABLE_HEURES}`"
    colonnes_str = ", ".join(COLONNES_EXPOSEES)

    where_clauses = []
    query_params  = []

    if date_debut:
        where_clauses.append("date >= @date_debut")
        query_params.append(
            {"name": "date_debut", "parameterType": {"type": "DATE"}, "parameterValue": {"value": date_debut}}
        )

    if date_fin:
        where_clauses.append("date <= @date_fin")
        query_params.append(
            {"name": "date_fin", "parameterType": {"type": "DATE"}, "parameterValue": {"value": date_fin}}
        )

    if matricule:
        where_clauses.append("matricule = @matricule")
        query_params.append(
            {"name": "matricule", "parameterType": {"type": "STRING"}, "parameterValue": {"value": matricule}}
        )

    if equipe:
        where_clauses.append("Equipe = @equipe")
        query_params.append(
            {"name": "equipe", "parameterType": {"type": "STRING"}, "parameterValue": {"value": equipe}}
        )

    if projet:
        where_clauses.append("projet = @projet")
        query_params.append(
            {"name": "projet", "parameterType": {"type": "STRING"}, "parameterValue": {"value": projet}}
        )

    where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    data_query  = query_heures_detail(table_ref, colonnes_str, where_str)
    count_query = query_heures_count(table_ref, where_str)

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
        logger.error("Erreur BigQuery lors de la lecture des heures agents: %s", err)
        raise


# TTL du cache dropdowns : 30 minutes
_CACHE_TTL_DROPDOWNS = 1800


def get_equipes_distinctes() -> list:
    """Retourne la liste des équipes distinctes pour alimenter le filtre dropdown."""
    cached = get_cached("equipes_distinctes")
    if cached is not None:
        return cached

    client    = get_bigquery_client()
    table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_ID}.{BQ_TABLE_HEURES}`"
    query     = query_equipes_distinctes(table_ref)

    try:
        rows = [_repair_encoding(row["Equipe"]) for row in client.query(query).result()]
        set_cached("equipes_distinctes", rows, _CACHE_TTL_DROPDOWNS)
        return rows
    except GoogleCloudError as err:
        logger.error("Erreur BigQuery lors de la lecture des équipes: %s", err)
        raise


def get_projets_distincts() -> list:
    """Retourne la liste des projets distincts pour alimenter le filtre dropdown."""
    cached = get_cached("projets_distincts")
    if cached is not None:
        return cached

    client    = get_bigquery_client()
    table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_ID}.{BQ_TABLE_HEURES}`"
    query     = query_projets_heures_distincts(table_ref)

    try:
        rows = [_repair_encoding(row["projet"]) for row in client.query(query).result()]
        set_cached("projets_distincts", rows, _CACHE_TTL_DROPDOWNS)
        return rows
    except GoogleCloudError as err:
        logger.error("Erreur BigQuery lors de la lecture des projets: %s", err)
        raise
# #endregion


# #region HELPERS INTERNES
def _build_job_config(params: list):
    """Construit un QueryJobConfig BigQuery à partir d'une liste de paramètres bruts."""
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
    """Convertit les types date/datetime en chaînes ISO et répare l'encodage des chaînes."""
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
    """Répare les chaînes UTF-8 interprétées comme Latin-1."""
    if not isinstance(val, str):
        return val
    try:
        return val.encode('latin-1').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        return val
# #endregion
