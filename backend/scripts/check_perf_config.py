import sys
sys.path.insert(0, '/app')
from core.db.bigquery import get_bigquery_client
client = get_bigquery_client()
rows = client.query("SELECT projet_nom, is_active FROM `data-project-438313.gcp_my_paie.config_etl_sources` WHERE univers = 'PERFORMANCE'").result()
for src in rows:
    print(dict(src))
