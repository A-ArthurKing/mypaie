"""
Fichier : dw_api_introspection_provider.py
Rôle    : Fournit des fonctions d'introspection sur les tables et colonnes de BigQuery.
          Utilisé pour le mapping dynamique des KPIs.
Module  : mypaie / backend / services / parametres
"""

import logging
from typing import List, Dict
from config.dw_api_bigquery_connector import get_bigquery_client, GCP_PROJECT_ID, BQ_DATASET_PAIE

logger = logging.getLogger(__name__)

def list_bigquery_tables(dataset_id: str = BQ_DATASET_PAIE) -> List[Dict]:
    """Liste toutes les tables et vues d'un dataset BigQuery."""
    client = get_bigquery_client()
    try:
        tables = client.list_tables(dataset_id)
        return [{"id": t.table_id, "type": t.table_type} for t in tables]
    except Exception as e:
        logger.error(f"Erreur list_bigquery_tables : {e}")
        return []

def list_table_columns(table_id: str, dataset_id: str = BQ_DATASET_PAIE) -> List[Dict]:
    """Liste toutes les colonnes d'une table BigQuery spécifique."""
    client = get_bigquery_client()
    try:
        table_ref = f"{GCP_PROJECT_ID}.{dataset_id}.{table_id}"
        table = client.get_table(table_ref)
        return [{"name": f.name, "type": f.field_type, "description": f.description} for f in table.schema]
    except Exception as e:
        logger.error(f"Erreur list_table_columns : {e}")
        return []

def get_unique_column_values(table_id: str, column_name: str, dataset_id: str = BQ_DATASET_PAIE) -> List[str]:
    """Récupère les valeurs uniques d'une colonne spécifique dans une table BigQuery."""
    client = get_bigquery_client()
    try:
        table_ref = f"`{GCP_PROJECT_ID}.{dataset_id}.{table_id}`"
        query = f"SELECT DISTINCT {column_name} FROM {table_ref} WHERE {column_name} IS NOT NULL ORDER BY {column_name}"
        rows = client.query(query).result()
        return [row[0] for row in rows]
    except Exception as e:
        logger.error(f"Erreur get_unique_column_values : {e}")
        return []
