"""Test script for the updated collaborateur API"""
import sys, json
sys.path.insert(0, '/app')
import jwt
import urllib.request

JWT_SECRET = 'super_secret_dev_key_mypaie_2026'
token = jwt.encode(
    {'user_id': 1, 'nom': 'Belhajjam', 'prenom': 'Soufiane', 
     'email': 'test@test.com', 'role': 'Collaborateur', 
     'matricule': '7042', 'id_structure': 28},
    JWT_SECRET, algorithm='HS256'
)

req = urllib.request.Request(
    'http://localhost:5001/api/collaborateur/ma-grille',
    headers={'Authorization': 'Bearer ' + token}
)

with urllib.request.urlopen(req, timeout=30) as r:
    data = json.loads(r.read())
    print('agent:', data.get('agent', {}).get('nom'))
    print('regle:', data.get('regle', {}).get('libelle'))
    kpis = data.get('kpis', {})
    print('kpis keys:', list(kpis.keys()))
    for k, v in kpis.items():
        valeur = v.get('valeur_reelle')
        prime = v.get('prime_kpi')
        malus = v.get('malus_pct')
        print(f'  {k}: valeur={valeur}, prime={prime}, malus={malus}')
    print('prime_brute_estimee:', data.get('prime_brute_estimee'))
    print('periode_calcul:', data.get('periode_calcul'))
