import sys
sys.path.insert(0, '/app')
from core.db.bigquery import get_bigquery_client
client = get_bigquery_client()
rows = client.query("SELECT * FROM `data-project-438313.gcp_my_paie.config_etl_sources`").result()
for src in rows:
    print(dict(src))
