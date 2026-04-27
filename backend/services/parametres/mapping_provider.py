"""
Fichier : mapping_provider.py
Rôle    : Service gérant la table de correspondance des noms de projets (mapping) sur BigQuery.
          Permet d'ajouter, lister et supprimer des règles de mapping.
Module  : mypaie / backend / services / parametres
"""

import logging
from google.cloud.exceptions import GoogleCloudError
from config.dw_api_bigquery_connector import get_bigquery_client, GCP_PROJECT_ID, BQ_DATASET_PAIE

logger = logging.getLogger(__name__)

def ensure_mapping_table_exists():
    """Crée la table de mapping sur BigQuery si elle n'existe pas encore."""
    client = get_bigquery_client()
    table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.projet_mapping`"
    
    query = f"""
        CREATE TABLE IF NOT EXISTS {table_ref} (
            source_name STRING NOT NULL,
            standard_name STRING NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
        )
    """
    try:
        client.query(query).result()
    except GoogleCloudError as err:
        logger.error("Erreur lors de la création de la table de mapping: %s", err)

def get_mappings() -> list:
    """Récupère tous les mappings existants."""
    ensure_mapping_table_exists()
    client = get_bigquery_client()
    table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.projet_mapping`"
    
    query = f"SELECT source_name, standard_name, created_at FROM {table_ref} ORDER BY standard_name"
    try:
        rows = [dict(r) for r in client.query(query).result()]
        for r in rows:
            if r.get("created_at"):
                r["created_at"] = r["created_at"].isoformat()
        return rows
    except GoogleCloudError as err:
        logger.error("Erreur BigQuery lors de la lecture des mappings: %s", err)
        raise

def add_mapping(source_name: str, standard_name: str):
    """Ajoute ou met à jour un mapping de projet."""
    ensure_mapping_table_exists()
    client = get_bigquery_client()
    table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.projet_mapping`"
    
    # Suppression de l'existant puis insertion (Upsert)
    query = f"""
        DELETE FROM {table_ref} WHERE source_name = @source_name;
        INSERT INTO {table_ref} (source_name, standard_name) VALUES (@source_name, @standard_name);
    """
    from google.cloud import bigquery as bq
    job_config = bq.QueryJobConfig(
        query_parameters=[
            bq.ScalarQueryParameter("source_name", "STRING", source_name),
            bq.ScalarQueryParameter("standard_name", "STRING", standard_name),
        ]
    )
    
    try:
        # Exécution de plusieurs requêtes nécessite d'autoriser le multi-statement, ce que BigQuery fait par défaut pour les requêtes standard.
        client.query(query, job_config=job_config).result()
        return {"source_name": source_name, "standard_name": standard_name, "status": "success"}
    except GoogleCloudError as err:
        logger.error("Erreur BigQuery lors de l'ajout du mapping: %s", err)
        raise

def delete_mapping(source_name: str):
    """Supprime un mapping."""
    ensure_mapping_table_exists()
    client = get_bigquery_client()
    table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.projet_mapping`"
    
    query = f"DELETE FROM {table_ref} WHERE source_name = @source_name"
    from google.cloud import bigquery as bq
    job_config = bq.QueryJobConfig(
        query_parameters=[
            bq.ScalarQueryParameter("source_name", "STRING", source_name)
        ]
    )
    try:
        client.query(query, job_config=job_config).result()
        return {"source_name": source_name, "status": "deleted"}
    except GoogleCloudError as err:
        logger.error("Erreur BigQuery lors de la suppression du mapping: %s", err)
        raise
