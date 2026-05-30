"""Script de diagnostic: mapping KPI ids/codes dans la grille config"""
import sys, json
sys.path.insert(0, '/app')
from config.db_mysql_connector import get_mysql_connection

conn = get_mysql_connection()
import pymysql.cursors
cur = conn.cursor(pymysql.cursors.DictCursor)

print('=== KPIs table ===')
cur.execute('SELECT id, code, libelle, type FROM kpis_indicateurs LIMIT 30')
for r in cur.fetchall():
    print(r['id'], '|', r['code'], '->', r['libelle'])

print()
print('=== Config active (contenu.indicateurs) ===')
cur.execute("""
SELECT cc.id, cc.contenu
FROM matrice_primes_configs cc
JOIN matrice_primes mp ON mp.id = cc.matrice_prime_id AND mp.actif=1
WHERE cc.est_active=1
LIMIT 5
""")
for r in cur.fetchall():
    try:
        contenu = json.loads(r['contenu']) if isinstance(r['contenu'], str) else r['contenu']
        inds = contenu.get('content', contenu).get('indicateurs', [])
        print(f"Config id={r['id']}")
        for ind in inds:
            print(f"  ind id={ind.get('id')} | libelle={ind.get('libelle')} | metric_key={ind.get('metric_key','N/A')} | poids={ind.get('poids')}")
    except Exception as e:
        print(f"  Erreur: {e}")
