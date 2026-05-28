import sys; sys.path.insert(0, "/app")
from core.db.bigquery import get_bigquery_client
c = get_bigquery_client()

# Desactivate old PVCP_EVALPLUS just in case
c.query("UPDATE gcp_my_paie.config_etl_sources SET is_active=FALSE WHERE projet_nom='PVCP_EVALPLUS'").result()

sql = """
INSERT INTO gcp_my_paie.config_etl_sources (
    univers, projet_nom, table_source, type_structure,
    colonne_cle_json, colonne_kpi_code, colonne_kpi_value,
    colonne_matricule, colonne_agent_fallback, colonne_date,
    is_active, scale_max
) VALUES (
    'QUALITE', 'DYNAMIC', 'dataproject_EvalPlus.evalplus_detail_evaluations_agents', 'TALL',
    NULL, '''"QUALITE"''', 'Note_Globale_Evaluation',
    NULL, 'Agent', 'Date_Evaluation',
    TRUE, 100.0
)
"""
c.query(sql).result()
print("Insertion réussie !")
