"""Debug: affiche les cibles complètes de la grille active (config 11, prime 6)"""
import sys, json
sys.path.insert(0, '/app')

import pymysql
from config.db_mysql_connector import get_mysql_connection

conn = get_mysql_connection()
with conn.cursor(pymysql.cursors.DictCursor) as cur:
    cur.execute("SELECT content FROM matrice_primes_configs WHERE id = 11")
    row = cur.fetchone()
conn.close()

content = json.loads(row['content'])

print("=== Structure top-level ===")
for k in content.keys():
    print(f"  {k}: {type(content[k])}")

print("\n=== statuts (structure brute) ===")
for i, s in enumerate(content.get('statuts', [])):
    print(f"\n  Statut {i}: {json.dumps(s, indent=4, ensure_ascii=False)[:600]}")
    
print("\n=== indicateurs (structure brute) ===")
for ind in content.get('indicateurs', []):
    print(f"  {json.dumps(ind, ensure_ascii=False)[:300]}")
