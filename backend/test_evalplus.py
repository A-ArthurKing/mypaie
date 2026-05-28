import sys; sys.path.insert(0, "/app")
from workers.universal_etl import _run_quality, client, TABLE_CONFIG

for r in client.query(f"SELECT * FROM {TABLE_CONFIG} WHERE projet_nom='PVCP_EVALPLUS'").result():
    _run_quality(r)
    print("ETL Qualite ran for PVCP_EVALPLUS")

# Check what was inserted
q = "SELECT * FROM gcp_my_paie.paie_qualite WHERE projet='PVCP_EVALPLUS' LIMIT 5"
for r in client.query(q).result():
    print(dict(r))
