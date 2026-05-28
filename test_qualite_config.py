import sys; sys.path.insert(0, "/app")
from core.db.bigquery import get_bigquery_client
c = get_bigquery_client()
q = "SELECT * FROM gcp_my_paie.paie_data_sources_config WHERE univers='QUALITE'"
for r in c.query(q).result():
    print(dict(r))
