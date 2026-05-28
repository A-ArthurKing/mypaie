"""Vérifie la correspondance metric_key grille <-> clés kpis retournées."""
import sys, json
sys.path.insert(0, '/app')
from config.db_mysql_connector import get_mysql_connection

conn = get_mysql_connection()
cur = conn.cursor()
cur.execute('SELECT content FROM matrice_primes_configs WHERE matrice_id = 2 AND est_active = 1 LIMIT 1')
row = cur.fetchone()
if not row:
    print("Aucune config active pour matrice_id=2")
    sys.exit(1)

content = json.loads(row['content'])
statuts = content.get('statuts', [])

print("=== Statuts dans la grille active ===")
for s in statuts:
    print("  Statut:", s.get('nom'))
    indicateurs = s.get('indicateurs', [])
    for ind in indicateurs:
        mk = ind.get('metric_key', '???')
        nom = ind.get('nom', '???')
        print("    metric_key='" + mk + "'  nom='" + nom + "'")

print()
print("=== Clés kpis retournées par le moteur pour matrice 12747 ===")
import requests
r = requests.get(
    'http://localhost:5001/api/regles/2/calcul',
    params={'date_debut': '2026-05-01', 'date_fin': '2026-05-31', 'matricules': '12747'},
    timeout=60
)
d = r.json()
kpis = d['data']['12747']['kpis']
all_keys = sorted(kpis.keys())
print("All keys (" + str(len(all_keys)) + "):", all_keys)
print()
print("=== Vérification matchings ===")
for s in statuts:
    for ind in s.get('indicateurs', []):
        mk = ind.get('metric_key', '')
        found_exact = mk in kpis
        found_lower = mk.lower() in kpis
        found_upper = mk.upper() in kpis
        val = kpis.get(mk) or kpis.get(mk.lower()) or kpis.get(mk.upper())
        status = "OK" if (found_exact or found_lower or found_upper) else "MISSING"
        print("  [" + status + "] metric_key='" + mk + "' -> val=" + str(val))
    break  # Un seul statut suffit (mêmes indicateurs)

conn.close()
