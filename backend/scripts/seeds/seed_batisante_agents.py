import os
import sys
from dotenv import load_dotenv

# Add current directory to path to allow absolute imports if run from here
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config.db_mysql_connector import get_mysql_connection

load_dotenv('.env.docker')

data_raw = """ABBAD	SALMA	11977
ABOUKS	SALIMA	12830
AIT MESSAOUD	REDA	12302
AKENDENGUEY	JOHANNA GERALDINE	11959
BENSLIMANE	TAHA	12292
BOUALLOU	REDA	10738
BOUKHRISSATE	CHAIMAE	10838
EL AMOURI	MAHA	12711
GOYE	PRINCE HUBNER	12710
KINDA VALINQUI	UILLIACK DENZEL	12325
KONGOLO MANDE	JOEL	12731
MAYORDOME	WILLIAM MARIETTE BOUSSINA	12729
MPASSI MEN	TIRI	12291
N GORAN DALLY	WILLIAM STEPHANE	12295
RBILA	DOUAE	12539
SAMIE	GEMA JESSICA	12730
YADERE KPEMWEI	KARL CEDRIC	12783
YAKEZI KOURSI	ABOUBAKAR	12626"""

def seed_db():
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            # 1. Insert Project "BATISANTE"
            cur.execute("INSERT IGNORE INTO ref_projets (nom, code) VALUES ('BATISANTE', 'BATISANTE')")
            cur.execute("SELECT id FROM ref_projets WHERE nom = 'BATISANTE'")
            id_projet = cur.fetchone()['id']

            # Insert operations and files with generic placeholders if not supplied
            cur.execute("INSERT IGNORE INTO ref_operations (libelle) VALUES ('BATISANTE')")
            cur.execute("INSERT IGNORE INTO ref_sous_projet (libelle) VALUES ('-')")
            cur.execute("INSERT IGNORE INTO ref_activites (libelle) VALUES ('-')")
            
            cur.execute("SELECT id FROM ref_operations WHERE libelle = 'BATISANTE'")
            id_op = cur.fetchone()['id']
            cur.execute("SELECT id FROM ref_sous_projet WHERE libelle = '-'")
            id_sous_projet = cur.fetchone()['id']
            cur.execute("SELECT id FROM ref_activites WHERE libelle = '-'")
            id_act = cur.fetchone()['id']

            cur.execute("""
                INSERT IGNORE INTO ref_structure_map (id_projet, id_operation, id_sous_projet, id_activite)
                VALUES (%s, %s, %s, %s)
            """, (id_projet, id_op, id_sous_projet, id_act))
            
            cur.execute("""
                SELECT id FROM ref_structure_map 
                WHERE id_projet = %s AND id_operation = %s AND id_sous_projet = %s AND id_activite = %s
            """, (id_projet, id_op, id_sous_projet, id_act))
            
            id_structure = cur.fetchone()['id']

            lines = data_raw.strip().split('\n')
            for line in lines:
                parts = line.split('\t')
                nom, prenom, matricule = parts[0], parts[1], parts[2]
                
                cur.execute("""
                    INSERT INTO ref_employes (matricule, nom, prenom, id_operation, id_sous_projet, id_activite, id_structure)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE 
                        nom=VALUES(nom), prenom=VALUES(prenom), 
                        id_operation=VALUES(id_operation), id_sous_projet=VALUES(id_sous_projet), 
                        id_activite=VALUES(id_activite), id_structure=VALUES(id_structure)
                """, (matricule.strip(), nom.strip(), prenom.strip(), id_op, id_sous_projet, id_act, id_structure))

            conn.commit()
            print(f"Successfully seeded {len(lines)} BATISANTE agents.")
            
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    seed_db()