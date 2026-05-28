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

def discover_gold_kpis(projet: str = None) -> List[Dict]:
    """
    Interroge les tables Gold (paie_performance_mensuelle et paie_qualite_mensuelle)
    pour découvrir dynamiquement tous les kpi_code disponibles.
    Permet de créer un pont entre la Data (BQ) et l'Application (UI).
    Si un projet est fourni, on cherche par inclusion (ex: PVCP -> %PVCP%).
    """
    client = get_bigquery_client()
    perf_table = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.paie_performance_mensuelle`"
    qual_table = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.paie_qualite_mensuelle`"
    
    where_clause = f"WHERE projet LIKE '%{projet}%'" if projet else ""
    
    query = f"""
        SELECT DISTINCT kpi_code, projet, 'PERF' as univers 
        FROM {perf_table}
        {where_clause}
        UNION ALL
        SELECT DISTINCT kpi_code, projet, 'QUALITE' as univers 
        FROM {qual_table}
        {where_clause}
        ORDER BY univers, projet, kpi_code
    """
    try:
        rows = client.query(query).result()
        return [{"kpi_code": row["kpi_code"], "projet": row["projet"], "univers": row["univers"]} for row in rows]
    except Exception as e:
        logger.error(f"Erreur discover_gold_kpis : {e}")
        return []

