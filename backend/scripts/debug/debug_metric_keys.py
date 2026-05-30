"""Debug: inspecte les metric_keys utilisés dans la grille active"""
import sys, json
sys.path.insert(0, '/app')

import pymysql
from config.db_mysql_connector import get_mysql_connection

conn = get_mysql_connection()
with conn.cursor(pymysql.cursors.DictCursor) as cur:
    cur.execute("SELECT id, matrice_id, est_active, content FROM matrice_primes_configs WHERE matrice_id = 6 AND est_active = 1")
    rows = cur.fetchall()
conn.close()

for r in rows:
    print(f"\n=== Config ID {r['id']} (prime {r['matrice_id']}) actif={r['est_active']} ===")
    raw = r['content']
    print(f"  type(content): {type(raw)}")
    if isinstance(raw, str):
        raw = json.loads(raw)
    if isinstance(raw, str):
        raw = json.loads(raw)  # double-encoded
    print(f"  type after parse: {type(raw)}")
    if isinstance(raw, dict):
        print(f"  top-level keys: {list(raw.keys())}")
        # Chercher les metric_keys à tous niveaux
        metric_keys = set()
        def find_metric_keys(obj):
            if isinstance(obj, dict):
                if 'metric_key' in obj:
                    metric_keys.add(obj['metric_key'])
                for v in obj.values():
                    find_metric_keys(v)
            elif isinstance(obj, list):
                for item in obj:
                    find_metric_keys(item)
        find_metric_keys(raw)
        print(f"  metric_keys: {sorted(metric_keys)}")
    elif isinstance(raw, list):
        print(f"  liste de {len(raw)} éléments, keys[0]: {list(raw[0].keys()) if raw else []}")

