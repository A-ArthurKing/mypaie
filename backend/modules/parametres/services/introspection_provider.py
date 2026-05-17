"""
Fichier : services/parametres/introspection_provider.py
Rôle    : Fournisseur d'introspection BigQuery — re-export depuis l'implémentation.
Module  : mypaie / backend / services / parametres
"""

from modules.parametres.services.dw_api_introspection_provider import (  # noqa: F401
    list_bigquery_tables,
    list_table_columns,
    get_unique_column_values,
    discover_gold_kpis,
)
