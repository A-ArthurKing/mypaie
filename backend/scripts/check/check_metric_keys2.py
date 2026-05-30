"""Affiche tous les metric_key des indicateurs et les cibles par statut."""
import sys, json
sys.path.insert(0, '/app')
from config.db_mysql_connector import get_mysql_connection
import requests

conn = get_mysql_connection()
cur = conn.cursor()
cur.execute('SELECT content FROM matrice_primes_configs WHERE matrice_id = 2 AND est_active = 1 LIMIT 1')
row = cur.fetchone()
content = json.loads(row['content'])
conn.close()

indicateurs = content.get('indicateurs', [])
statuts = content.get('statuts', [])

print("=== Indicateurs et metric_key ===")
for ind in indicateurs:
    print("  id=" + ind.get('id','') + " metric_key='" + str(ind.get('metric_key','')) + "' nom='" + ind.get('nom','') + "'")

print()
print("=== Cibles par statut ===")
for s in statuts:
    print("Statut: " + s.get('nom','?'))
    cibles = s.get('cibles', {})
    print("  Type cibles:", type(cibles).__name__)
    if isinstance(cibles, dict):
        for k, v in cibles.items():
            print("    kpi_id='" + str(k) + "' -> objectif=" + str(v))
    elif isinstance(cibles, list):
        for c in cibles:
            print("    ", json.dumps(c, ensure_ascii=False))

print()
print("=== Vérification matchings metric_key vs kpis API ===")
r = requests.get(
    'http://localhost:5001/api/regles/2/calcul',
    params={'date_debut': '2026-05-01', 'date_fin': '2026-05-31', 'matricules': '12747'},
    timeout=60
)
d = r.json()
kpis = d['data']['12747']['kpis']
print("Clés kpis:", sorted(kpis.keys()))

print()
for ind in indicateurs:
    mk = ind.get('metric_key', '')
    found = mk in kpis or mk.lower() in kpis or mk.upper() in kpis
    val = kpis.get(mk) or kpis.get(mk.lower()) or kpis.get(mk.upper())
    status = "OK" if found else "MANQUANT"
    print("[" + status + "] metric_key='" + mk + "' -> val=" + str(val))
