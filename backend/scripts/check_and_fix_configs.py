"""
Script de vérification et correction des configs JSON des grilles de primes.
Corrige les statuts avec caractères corrompus (?, Ã©, etc.)
"""
import sys, json, re
sys.path.insert(0, '/app')
from config.db_mysql_connector import get_mysql_connection

# Mapping des valeurs corrompues vers les valeurs correctes
CORRECTIONS = {
    'D?butant':   'Débutant',
    'D©butant':   'Débutant',
    'DÃ©butant':  'Débutant',
    'Confirm?':   'Confirmé',
    'ConfirmÃ©':  'Confirmé',
    'S?nior':     'Sénior',
    'SÃ©nior':    'Sénior',
    'SÃ nior':    'Sénior',
    'Expert?':    'Expert',
}

def fix_statut_nom(nom):
    """Corrige un nom de statut corrompu."""
    if nom in CORRECTIONS:
        return CORRECTIONS[nom], True
    # Cherche aussi avec regex de caractères suspect
    original = nom
    for bad, good in CORRECTIONS.items():
        if nom == bad:
            return good, True
    return nom, False

def check_and_fix():
    conn = get_mysql_connection()
    cur = conn.cursor()
    cur.execute('SELECT id, matrice_id, est_active, content FROM matrice_primes_configs ORDER BY matrice_id, id')
    rows = cur.fetchall()
    
    fixes_needed = []
    
    for row in rows:
        config_id = row['id']
        matrice_id = row['matrice_id']
        active = row['est_active']
        raw_content = row['content']
        
        content = json.loads(raw_content) if isinstance(raw_content, str) else raw_content
        statuts = content.get('statuts', [])
        noms = [s.get('nom', '') for s in statuts]
        print(f"config_id={config_id} matrice_id={matrice_id} active={active} statuts={noms}")
        
        # Vérifier si des statuts sont corrompus
        modified = False
        for statut in statuts:
            nom_original = statut.get('nom', '')
            nom_corrige, was_fixed = fix_statut_nom(nom_original)
            if was_fixed:
                print(f"  -> CORRECTION: '{nom_original}' => '{nom_corrige}'")
                statut['nom'] = nom_corrige
                modified = True
        
        if modified:
            fixes_needed.append((config_id, json.dumps(content, ensure_ascii=False)))
    
    if fixes_needed:
        print(f"\n{len(fixes_needed)} config(s) à corriger. Application des corrections...")
        for config_id, new_content in fixes_needed:
            cur.execute('UPDATE matrice_primes_configs SET content = %s WHERE id = %s', (new_content, config_id))
        conn.commit()
        print("Corrections appliquées avec succès.")
    else:
        print("\nAucune correction nécessaire.")
    
    conn.close()

if __name__ == '__main__':
    check_and_fix()
