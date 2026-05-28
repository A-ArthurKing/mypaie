import sys
sys.path.insert(0, '/app')
from core.db.bigquery import get_bigquery_client
client = get_bigquery_client()
client.query("DELETE FROM `data-project-438313.gcp_my_paie.config_etl_sources` WHERE id = 9").result()
client.query("DROP VIEW IF EXISTS `data-project-438313.dataset_pvcp.vue_performance_tcd_dfr_json`").result()
print("Rollback complete")
