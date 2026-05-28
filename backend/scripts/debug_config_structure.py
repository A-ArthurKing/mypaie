"""Affiche la structure complète de la config active pour debug."""
import sys, json
sys.path.insert(0, '/app')
from config.db_mysql_connector import get_mysql_connection

conn = get_mysql_connection()
cur = conn.cursor()
cur.execute('SELECT content FROM matrice_primes_configs WHERE matrice_id = 2 AND est_active = 1 LIMIT 1')
row = cur.fetchone()
content = json.loads(row['content'])

# Afficher toutes les clés de premier niveau
print("Keys top-level:", list(content.keys()))

# Afficher les statuts
statuts = content.get('statuts', [])
print("Nombre de statuts:", len(statuts))
if statuts:
    print("Clés d'un statut:", list(statuts[0].keys()))
    # Chercher les indicateurs
    for sk in statuts[0].keys():
        val = statuts[0][sk]
        if isinstance(val, list) and len(val) > 0:
            print("  Clé avec liste '" + sk + "' - nb éléments:", len(val))
            print("  Premier élément:", json.dumps(val[0], ensure_ascii=False))

# Chercher les indicateurs au niveau racine
for key in content.keys():
    if key not in ('statuts',):
        val = content[key]
        if isinstance(val, list) and len(val) > 0 and isinstance(val[0], dict):
            print("Clé racine '" + key + "' - nb éléments:", len(val))
            print("  Premier élément:", json.dumps(val[0], ensure_ascii=False)[:200])

conn.close()
