import sys
sys.path.insert(0, '/app')
from core.db.bigquery import get_bigquery_client
client = get_bigquery_client()
client.query("DELETE FROM `data-project-438313.gcp_my_paie.config_etl_sources` WHERE projet_nom = 'PVCP_PERFORMANCE'").result()
print('PVCP_PERFORMANCE deleted.')
