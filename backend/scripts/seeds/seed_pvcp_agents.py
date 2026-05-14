import os
import sys
from dotenv import load_dotenv

# Add current directory to path to allow absolute imports if run from here
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config.db_mysql_connector import get_mysql_connection

load_dotenv('.env.docker')

data_raw = """DAMBITA	EZECHIEL LE GRAND	11056	PVCP-APEN	PV	SE
DIRA	NOUR ESSABAH	11856	PVCP-APEN	PV	SE
EL JIRARI	HAJAR	11857	PVCP-APEN	PV	SE
IRNAT	SALIM	10773	PVCP-APEN	PV	SE
KALEMO	ANGE MARIE KAMBILI	11528	PVCP-APEN	PV	SE
KETTO	ANNA PIERRE NEW EVA	11545	PVCP-APEN	PV	SE
MIAYOKA	CHRIST ROILFAIT	11253	PVCP-APEN	PV	SE
TEDMOURI	SAFAE	9410	PVCP-APEN	PV	SE
KHERRAKI	OUMAIMA	6497	PVCP-APEN	PV	SA
AIT BELAID	FATIMA ZAHRA	11904	PVCP-APEN	CP	SA
EL BRINI	OUMAIMA	9701	PVCP-APEN	CP	SA
MITAHIRIHASAMBARANA	ROVASOA FIFALIANA	12524	PVCP-APEN	CP	SA
OULDLABBAR	KHALID	12529	PVCP-APEN	CP	SA
OBA BANDZA	RUTH BERCHANTIE	11249	PVCP-APEN	CP	PARK
RSISIB	SALMA	11903	PVCP-APEN	CP	PARK
ZAKI	IMANE	10070	PVCP-APEN	CP	PARK
BABINGUI BABOU	BERPHONSIA NOUTERSE	12747	PVCP-APEN	CP	SE
BESSI	LOIC	12640	PVCP-APEN	CP	SE
BIOGHE NANH	PAUL ELIE	12741	PVCP-APEN	CP	SE
BOUROBOU	DANIELA MORILLE	12746	PVCP-APEN	CP	SE
NGOUMTSA NONGNY	INES	12743	PVCP-APEN	CP	SE
TAKASSI	RENE	11250	PVCP-APEN	CP	SE
BAYO	EMMANUELA FATIM	12862	PVCP-APEN	CP	BO
KWOMO MOGO	ANGE DRUCILE	9995	PVCP-APEN	CP	BO
MIRINIOUI	MAJDA	12541	PVCP-APEN	CP	BO
MPIKA	FELICIA YHAN MAURICE	12860	PVCP-APEN	CP	BO
ZAROUAL	HIND	12864	PVCP-APEN	CP	BO
Belhajjam	Soufiane	7042	PVCP-APSO	CP	APSO
EL BENAYE	RAJAE	10569	PVCP-APSO	CP	APSO
jebari	siham	7893	PVCP-APSO	CP	APSO
kebe	merry sow	7795	PVCP-APSO	CP	APSO
OKILI AMOGHO LOLE	BRUXIA FRANCELINE	9964	PVCP-APSO	CP	APSO
fnitiz	abdelfatah	2689	CP Belgique	CP	SA-SE
NHILI	AMINE	9399	CP Belgique	CP	SA-SE
LAHMAR	MOHAMMED	11370	CP Belgique	CP	SA-SE
DAOUAH	ALLAE	11902	CP Belgique	CP	SA-SE
EZZIN	HICHAM	10017	CP GERMANO	CP	SA
SATIANE	SOUFIAN	10852	CP GERMANO	CP	SA
MILOUDI	YASSIR	10363	CP GERMANO	CP	SE
LOUMOU	AYOUB	10733	CP GERMANO	CP	SE
HACHAD	DRISS	10245	CP GERMANO	CP	SE
EL HOSAYNY	OUALID	11475	CP GERMANO	CP	SE
ABARGUIH	SAID	11481	CP GERMANO	CP	SE
TAOUFIQ	MOHAMMED	11536	CP GERMANO	CP	SE
NIMIROU	ALAE	10016	CP GERMANO	CP	APSO
LAHMAR	YOUNESS	10021	CP GERMANO	CP	APSO
SEFRI	YOUNESS	10362	CP GERMANO	CP	APSO
EL JADIDI	YOUSSEF	10022	CP NEERLANDO APSO	CP	SA
RHILA	MONTACIR	12537	CP NEERLANDO APSO	CP	SA
BEN OMAR	KHALID	12878	CP NEERLANDO APSO	CP	SA
OUZGNI	AICHA	12490	CP NEERLANDO APSO	CP	SA
BOJADA	OMAR	12825	CP NEERLANDO APSO	CP	SA"""

def seed_db():
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            # 1. Insert Target Project "PVCP"
            cur.execute("INSERT IGNORE INTO ref_projets (nom, code) VALUES ('PVCP', 'PVCP')")
            cur.execute("SELECT id FROM ref_projets WHERE nom = 'PVCP'")
            id_projet = cur.fetchone()['id']

            agents = []
            for line in data_raw.strip().split('\n'):
                parts = line.split('\t')
                if len(parts) == 6:
                    nom, prenom, matricule, operation, file_val, activite = parts
                    agents.append({
                        "nom": nom.strip(),
                        "prenom": prenom.strip(),
                        "matricule": matricule.strip(),
                        "operation": operation.strip(),
                        "file": file_val.strip(),
                        "activite": activite.strip()
                    })

            # 2. Extract unique dimensions
            operations = set(a['operation'] for a in agents)
            files = set(a['file'] for a in agents)
            activites = set(a['activite'] for a in agents)

            # 3. Insert unique dimensions
            for op in operations:
                cur.execute("INSERT IGNORE INTO ref_operations (libelle) VALUES (%s)", (op,))
            for f in files:
                cur.execute("INSERT IGNORE INTO ref_sous_projet (libelle) VALUES (%s)", (f,))
            for act in activites:
                cur.execute("INSERT IGNORE INTO ref_activites (libelle) VALUES (%s)", (act,))

            # 4. Fetch IDs
            cur.execute("SELECT id, libelle FROM ref_operations")
            ops_map = {r['libelle']: r['id'] for r in cur.fetchall()}
            cur.execute("SELECT id, libelle FROM ref_sous_projet")
            files_map = {r['libelle']: r['id'] for r in cur.fetchall()}
            cur.execute("SELECT id, libelle FROM ref_activites")
            acts_map = {r['libelle']: r['id'] for r in cur.fetchall()}

            # 5. Insert structure map & employees
            for a in agents:
                id_op = ops_map[a['operation']]
                id_sous_projet = files_map[a['file']]
                id_act = acts_map[a['activite']]

                # Insert into ref_structure_map
                cur.execute("""
                    INSERT IGNORE INTO ref_structure_map (id_projet, id_operation, id_sous_projet, id_activite)
                    VALUES (%s, %s, %s, %s)
                """, (id_projet, id_op, id_sous_projet, id_act))
                
                # Fetch id_structure
                cur.execute("""
                    SELECT id FROM ref_structure_map 
                    WHERE id_projet = %s AND id_operation = %s AND id_sous_projet = %s AND id_activite = %s
                """, (id_projet, id_op, id_sous_projet, id_act))
                
                res = cur.fetchone()
                id_structure = res['id'] if res else None

                # Insert employee
                cur.execute("""
                    INSERT INTO ref_employes (matricule, nom, prenom, id_operation, id_sous_projet, id_activite, id_structure)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE 
                        nom=VALUES(nom), prenom=VALUES(prenom), 
                        id_operation=VALUES(id_operation), id_sous_projet=VALUES(id_sous_projet), 
                        id_activite=VALUES(id_activite), id_structure=VALUES(id_structure)
                """, (a['matricule'], a['nom'], a['prenom'], id_op, id_sous_projet, id_act, id_structure))

            conn.commit()
            print(f"Successfully seeded {len(agents)} agents and structure map.")
            
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    seed_db()