"""Script de test de l'API calcul."""
import sys, json, requests
sys.path.insert(0, '/app')

r = requests.get(
    'http://localhost:5001/api/regles/2/calcul',
    params={'date_debut': '2026-05-01', 'date_fin': '2026-05-31', 'matricules': '12747,12640'},
    timeout=60
)
print('Status:', r.status_code)
try:
    d = r.json()
    if d.get('data'):
        for mat, val in list(d['data'].items())[:2]:
            kpis = val.get('kpis', {})
            print('Agent', mat, '- KPI keys (' + str(len(kpis)) + '):', list(kpis.keys())[:15])
            dmt = kpis.get('dmt')
            cvr = kpis.get('cvr')
            tx_mea = kpis.get('tx_mea')
            note = kpis.get('NOTE_QUALITE')
            avg_nbr = kpis.get('avg_nbr')
            print('  dmt=' + str(dmt) + ' cvr=' + str(cvr) + ' tx_mea=' + str(tx_mea) + ' NOTE_QUALITE=' + str(note) + ' avg_nbr=' + str(avg_nbr))
    else:
        print(json.dumps(d, ensure_ascii=False)[:500])
except Exception as e:
    print('JSON error:', str(e), r.text[:300])
