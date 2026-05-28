import sys; sys.path.insert(0, "/app")
from core.db.bigquery import get_bigquery_client
c = get_bigquery_client()

sql_update = """
UPDATE gcp_my_paie.config_etl_sources 
SET 
    is_active = TRUE,
    table_source = 'dataproject_EvalPlus.evalplus_detail_evaluations_agents',
    colonne_kpi_code = '"QUALITE"',
    colonne_kpi_value = 'Note_Globale_Evaluation'
WHERE projet_nom = 'PVCP_EVALPLUS'
"""
c.query(sql_update).result()

# Delete the old detail rows from the Silver table to start fresh for this project
c.query("DELETE FROM gcp_my_paie.paie_qualite WHERE projet='PVCP_EVALPLUS'").result()

print("Config updated and old details deleted")
