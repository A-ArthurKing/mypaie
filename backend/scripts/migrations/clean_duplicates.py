import os
import sys
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from config.db_mysql_connector import get_mysql_connection

load_dotenv('.env.docker')

def clean_table(cur, table_name, unique_col):
    print(f"Cleaning {table_name} by {unique_col}...")
    
    # Trouver l'ID min pour chaque valeur unique
    cur.execute(f"SELECT min(id) as m_id, {unique_col} FROM {table_name} GROUP BY {unique_col}")
    mins = cur.fetchall()
    min_map = {r[unique_col]: r['m_id'] for r in mins}
    
    # Récupérer tout
    cur.execute(f"SELECT id, {unique_col} FROM {table_name}")
    all_rows = cur.fetchall()
    
    updates = {}
    for r in all_rows:
        if r['id'] != min_map[r[unique_col]]:
            updates[r['id']] = min_map[r[unique_col]]
            
    if not updates:
        print("Rien à nettoyer dans les refs.")
    else:
        # Mettre à jour ref_structure_map
        for old_id, new_id in updates.items():
            if table_name == 'ref_operations':
                cur.execute("UPDATE IGNORE ref_structure_map SET id_operation = %s WHERE id_operation = %s", (new_id, old_id))
                cur.execute("UPDATE ref_employes SET id_operation = %s WHERE id_operation = %s", (new_id, old_id))
            elif table_name == 'ref_sous_projet':
                cur.execute("UPDATE IGNORE ref_structure_map SET id_sous_projet = %s WHERE id_sous_projet = %s", (new_id, old_id))
                cur.execute("UPDATE ref_employes SET id_sous_projet = %s WHERE id_sous_projet = %s", (new_id, old_id))
            elif table_name == 'ref_activites':
                cur.execute("UPDATE IGNORE ref_structure_map SET id_activite = %s WHERE id_activite = %s", (new_id, old_id))
                cur.execute("UPDATE ref_employes SET id_activite = %s WHERE id_activite = %s", (new_id, old_id))
                
        # Supprimer les doublons
        placeholders = ','.join(['%s']*len(updates))
        cur.execute(f"DELETE FROM {table_name} WHERE id IN ({placeholders})", list(updates.keys()))
        
    try:
        cur.execute(f"ALTER TABLE {table_name} ADD UNIQUE INDEX ({unique_col})")
    except Exception as e:
        print(f"Index existe peut-être: {e}")

def clean_structure_map(cur):
    print("Cleaning ref_structure_map...")
    # Find mins
    cur.execute("SELECT MIN(id) as m_id, id_projet, id_operation, id_sous_projet, id_activite FROM ref_structure_map GROUP BY id_projet, id_operation, id_sous_projet, id_activite")
    mins = cur.fetchall()
    
    # Store mapping
    correct_ids = {}
    for m in mins:
        key = f"{m['id_projet']}_{m['id_operation']}_{m['id_sous_projet']}_{m['id_activite']}"
        correct_ids[key] = m['m_id']
        
    cur.execute("SELECT id, id_projet, id_operation, id_sous_projet, id_activite FROM ref_structure_map")
    all_struct = cur.fetchall()
    
    updates = {}
    for s in all_struct:
        key = f"{s['id_projet']}_{s['id_operation']}_{s['id_sous_projet']}_{s['id_activite']}"
        if s['id'] != correct_ids[key]:
            updates[s['id']] = correct_ids[key]
            
    for old_id, new_id in updates.items():
        cur.execute("UPDATE ref_employes SET id_structure = %s WHERE id_structure = %s", (new_id, old_id))
        
    if updates:
        placeholders = ','.join(['%s']*len(updates))
        cur.execute(f"DELETE FROM ref_structure_map WHERE id IN ({placeholders})", list(updates.keys()))
        
    try:
        cur.execute("ALTER TABLE ref_structure_map ADD UNIQUE INDEX unq_struct (id_projet, id_operation, id_sous_projet, id_activite)")
    except Exception as e:
        pass


def run():
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            clean_table(cur, 'ref_operations', 'libelle')
            clean_table(cur, 'ref_sous_projet', 'libelle')
            clean_table(cur, 'ref_activites', 'libelle')
            clean_structure_map(cur)
        conn.commit()
        print("Nettoyage OK")
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

if __name__ == '__main__':
    run()