import sys; sys.path.insert(0, "/app")
from workers.universal_etl import _run_quality, client, TABLE_CONFIG
for row in client.query(f"SELECT * FROM {TABLE_CONFIG} WHERE projet_nom='DYNAMIC'").result():
    print("Testing DYNAMIC run...")
    try:
        _run_quality(row)
        print("Success")
    except Exception as e:
        print("ERROR:", e)
