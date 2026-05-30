"""Test final : vérifie que tous les metric_key de la grille matchent dans kpis."""
import sys, json, requests
sys.path.insert(0, '/app')

r = requests.get(
    'http://localhost:5001/api/regles/2/calcul',
    params={'date_debut': '2026-05-01', 'date_fin': '2026-05-31', 'matricules': '12747,12640'},
    timeout=60
)
print('Status:', r.status_code)
d = r.json()
agent_kpis = d['data']['12747']['kpis']

# Les 5 metric_key de la grille
metric_keys_grille = ['DMT', 'IS_CONVERTED', 'AVG_NBR', 'QUALITE', 'TX_MEA']
print()
print("=== Correspondance metric_key (grille) => valeur dans kpis API ===")
all_ok = True
for mk in metric_keys_grille:
    val = agent_kpis.get(mk)
    status = 'OK' if val is not None else 'MANQUANT'
    if val is None:
        all_ok = False
    print('[' + status + '] ' + mk + ' = ' + str(val))

print()
if all_ok:
    print('TOUS LES KPIs SONT PRESENTS - Le frontend devrait afficher les valeurs reelles.')
else:
    print('ATTENTION: Des KPIs manquent, le frontend affichera des tirets pour ces indicateurs.')
