import os
import sys
from dotenv import load_dotenv

# Add current directory to path to allow absolute imports if run from here
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config.db_mysql_connector import get_mysql_connection

load_dotenv('.env.docker')

data_raw = """AJAJI	YOUSSEF	11963
AKERMOUCH	NAJLAA	11165
ASSIDI	ZINEB	11218
BAKKAS	YOUSSEF	12253
OUBAKI	REDA	11382
ZANG MIKUE	JOSE RODOLFO MBOMIO	12252
ZIANI	MOHAMMED	12196
TAOUIL	YOUSSEF	12461
ITUMBELA ISEKEMANGA	JEAN-BAPTISTE	2466
HADDAR	AYA	12913"""

def seed_db():
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            # 1. Insert Project "VENUM"
            cur.execute("INSERT IGNORE INTO ref_projets (nom, code) VALUES ('VENUM', 'VENUM')")
            cur.execute("SELECT id FROM ref_projets WHERE nom = 'VENUM'")
            id_projet = cur.fetchone()['id']

            # Insert operations and files with generic placeholders if not supplied
            cur.execute("INSERT IGNORE INTO ref_operations (libelle) VALUES ('VENUM')")
            cur.execute("INSERT IGNORE INTO ref_files (libelle) VALUES ('-')")
            cur.execute("INSERT IGNORE INTO ref_activites (libelle) VALUES ('-')")
            
            cur.execute("SELECT id FROM ref_operations WHERE libelle = 'VENUM'")
            id_op = cur.fetchone()['id']
            cur.execute("SELECT id FROM ref_files WHERE libelle = '-'")
            id_file = cur.fetchone()['id']
            cur.execute("SELECT id FROM ref_activites WHERE libelle = '-'")
            id_act = cur.fetchone()['id']

            cur.execute("""
                INSERT IGNORE INTO ref_structure_map (id_projet, id_operation, id_file, id_activite)
                VALUES (%s, %s, %s, %s)
            """, (id_projet, id_op, id_file, id_act))
            
            cur.execute("""
                SELECT id FROM ref_structure_map 
                WHERE id_projet = %s AND id_operation = %s AND id_file = %s AND id_activite = %s
            """, (id_projet, id_op, id_file, id_act))
            
            id_structure = cur.fetchone()['id']

            lines = data_raw.strip().split('\n')
            for line in lines:
                parts = line.split('\t')
                nom, prenom, matricule = parts[0], parts[1], parts[2]
                
                cur.execute("""
                    INSERT INTO ref_employes (matricule, nom, prenom, id_operation, id_file, id_activite, id_structure)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE 
                        nom=VALUES(nom), prenom=VALUES(prenom), 
                        id_operation=VALUES(id_operation), id_file=VALUES(id_file), 
                        id_activite=VALUES(id_activite), id_structure=VALUES(id_structure)
                """, (matricule.strip(), nom.strip(), prenom.strip(), id_op, id_file, id_act, id_structure))

            conn.commit()
            print(f"Successfully seeded {len(lines)} VENUM agents.")
            
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    seed_db()