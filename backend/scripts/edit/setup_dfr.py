import sys
sys.path.insert(0, '/app')
from core.db.bigquery import get_bigquery_client

client = get_bigquery_client()

create_view_sql = """
CREATE OR REPLACE VIEW `data-project-438313.dataset_pvcp.vue_performance_tcd_dfr_json` AS
SELECT 
    NOMSIRH AS MATRICULE,
    call_date,
    TO_JSON_STRING(STRUCT(
        Incoming_Call,
        BKG,
        Revenue,
        Service_Revenue,
        Pct_Service_Revenue,
        ABV_Revenue,
        ABV_NBR,
        ABV_Service,
        Duration_call,
        Conversion_Agent,
        Nb_CSAT,
        AVR_CSAT
    )) AS METRICS
FROM `data-project-438313.dataset_pvcp.vue_performance_tcd_dfr`
WHERE NOMSIRH IS NOT NULL
"""
client.query(create_view_sql).result()
print('View created.')

insert_sql = """
INSERT INTO `data-project-438313.gcp_my_paie.config_etl_sources`
(id, univers, projet_nom, table_source, type_structure, colonne_cle_json, colonne_matricule, colonne_date, is_active)
VALUES (
    9,
    'PERFORMANCE',
    'PVCP_DFR', 
    'dataset_pvcp.vue_performance_tcd_dfr_json',
    'JSON',
    'METRICS',
    'MATRICULE',
    'call_date',
    TRUE
)
"""
try:
    client.query(insert_sql).result()
    print('Inserted into config_etl_sources.')
except Exception as e:
    print('Insert failed (maybe already exists):', e)
