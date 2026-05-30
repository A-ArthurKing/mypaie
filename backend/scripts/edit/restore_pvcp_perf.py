import sys
sys.path.insert(0, '/app')
from core.db.bigquery import get_bigquery_client
client = get_bigquery_client()

insert_pvcp = """
INSERT INTO `data-project-438313.gcp_my_paie.config_etl_sources` 
(id, univers, projet_nom, table_source, type_structure, colonne_cle_json, colonne_kpi_code, colonne_kpi_value, colonne_matricule, colonne_agent_fallback, colonne_date, is_active)
VALUES (
    1, 
    'PERFORMANCE', 
    'PVCP_PERFORMANCE', 
    'dataset_pvcp.pvcp_data_outils_client_performance', 
    'JSON', 
    'METRICS', 
    NULL, 
    NULL, 
    'MATRICULE', 
    NULL, 
    'date_importation', 
    TRUE
)
"""

try:
    client.query(insert_pvcp).result()
    print("PVCP_PERFORMANCE re-inserted successfully.")
except Exception as e:
    print(f"Error inserting: {e}")
