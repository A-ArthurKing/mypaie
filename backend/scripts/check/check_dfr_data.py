import sys
sys.path.insert(0, '/app')
from core.db.bigquery import get_bigquery_client
client = get_bigquery_client()
rows = list(client.query("SELECT * FROM `data-project-438313.gcp_my_paie.paie_performance` WHERE projet = 'PVCP_DFR' LIMIT 10").result())
if not rows:
    print("No data for PVCP_DFR in paie_performance")
for r in rows:
    print(dict(r))
