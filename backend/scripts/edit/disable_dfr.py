import sys; sys.path.insert(0, "/app")
from core.db.bigquery import get_bigquery_client
c = get_bigquery_client()
c.query("UPDATE gcp_my_paie.config_etl_sources SET is_active = FALSE WHERE table_source = 'dataset_pvcp.vue_performance_tcd_dfr_tall'").result()
print("Source DFR désactivée avec succès")
