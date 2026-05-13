
from config.db_mysql_connector import get_mysql_connection

def migrate_to_structure_map():
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            # 1. Identifier toutes les combinaisons uniques existantes chez les employés
            print("Collecte des combinaisons structurelles...")
            cur.execute("""
                SELECT DISTINCT id_operation, id_file, id_activite 
                FROM ref_employes 
                WHERE id_operation IS NOT NULL
            """)
            combos = cur.fetchall()
            
            # On récupère l'ID du projet PVCP (le seul pour l'instant)
            cur.execute("SELECT id FROM ref_projets WHERE nom = 'PVCP'")
            res_projet = cur.fetchone()
            id_projet_pvcp = res_projet['id'] if res_projet else 1

            # 2. Insérer ces combinaisons dans ref_structure_map
            print(f"Insertion de {len(combos)} combinaisons dans le Cerveau (map)...")
            for c in combos:
                cur.execute("""
                    INSERT IGNORE INTO ref_structure_map (id_projet, id_operation, id_file, id_activite)
                    VALUES (%s, %s, %s, %s)
                """, (id_projet_pvcp, c['id_operation'], c['id_file'], c['id_activite']))
            
            conn.commit()

            # 3. Mettre à jour ref_employes avec le nouvel id_structure
            print("Liaison des employés à la structure map...")
            cur.execute("""
                UPDATE ref_employes e
                JOIN ref_structure_map m ON 
                    m.id_projet = %s AND 
                    m.id_operation = e.id_operation AND 
                    (m.id_file = e.id_file OR (m.id_file IS NULL AND e.id_file IS NULL)) AND 
                    (m.id_activite = e.id_activite OR (m.id_activite IS NULL AND e.id_activite IS NULL))
                SET e.id_structure = m.id
            """, (id_projet_pvcp,))

            # 4. Mettre à jour matrice_primes (Regle 2 notamment)
            print("Liaison des règles à la structure map...")
            cur.execute("""
                UPDATE matrice_primes p
                JOIN ref_structure_map m ON 
                    m.id_projet = %s AND 
                    m.id_operation = p.id_operation AND 
                    (m.id_file = p.id_file OR (m.id_file IS NULL AND p.id_file IS NULL)) AND 
                    (m.id_activite = p.id_activite OR (m.id_activite IS NULL AND p.id_activite IS NULL))
                SET p.id_structure = m.id
            """, (id_projet_pvcp,))

            conn.commit()
            print("Migration terminée avec succès.")
            
    except Exception as e:
        print(f"Erreur migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_to_structure_map()
