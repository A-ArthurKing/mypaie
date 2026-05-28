import sys
sys.path.insert(0, '/app')
from core.db.bigquery import get_bigquery_client
client = get_bigquery_client()
sql = """
CREATE OR REPLACE VIEW `data-project-438313.dataset_pvcp.vue_performance_tcd_dfr_tall` AS
SELECT NOMSIRH as MATRICULE, call_date, kpi_nom, kpi_valeur
FROM (
  SELECT 
    NOMSIRH, call_date,
    Incoming_Call, BKG, Revenue, Service_Revenue,
    Pct_Service_Revenue, ABV_Revenue, ABV_NBR, ABV_Service,
    Duration_call, Conversion_Agent, Nb_CSAT, AVR_CSAT
  FROM `data-project-438313.dataset_pvcp.vue_performance_tcd_dfr`
  WHERE NOMSIRH IS NOT NULL AND call_date IS NOT NULL
)
UNPIVOT (
  kpi_valeur FOR kpi_nom IN (
    Incoming_Call, BKG, Revenue, Service_Revenue,
    Pct_Service_Revenue, ABV_Revenue, ABV_NBR, ABV_Service,
    Duration_call, Conversion_Agent, Nb_CSAT, AVR_CSAT
  )
)
"""
client.query(sql).result()
print('Vue TALL mise a jour.')
