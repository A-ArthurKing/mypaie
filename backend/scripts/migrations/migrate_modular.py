
from config.db_mysql_connector import get_mysql_connection
import logging

def migrate_agents():
    agents = [
        ('11056', 'DAMBITA', 'EZECHIEL LE GRAND', 'PVCP-APEN', 'PV', 'SE'),
        ('11856', 'DIRA', 'NOUR ESSABAH', 'PVCP-APEN', 'PV', 'SE'),
        ('11857', 'EL JIRARI', 'HAJAR', 'PVCP-APEN', 'PV', 'SE'),
        ('10773', 'IRNAT', 'SALIM', 'PVCP-APEN', 'PV', 'SE'),
        ('11528', 'KALEMO', 'ANGE MARIE KAMBILI', 'PVCP-APEN', 'PV', 'SE'),
        ('11545', 'KETTO', 'ANNA PIERRE NEW EVA', 'PVCP-APEN', 'PV', 'SE'),
        ('11253', 'MIAYOKA', 'CHRIST ROILFAIT', 'PVCP-APEN', 'PV', 'SE'),
        ('9410', 'TEDMOURI', 'SAFAE', 'PVCP-APEN', 'PV', 'SE'),
        ('6497', 'KHERRAKI', 'OUMAIMA', 'PVCP-APEN', 'PV', 'SA'),
        ('11904', 'AIT BELAID', 'FATIMA ZAHRA', 'PVCP-APEN', 'CP', 'SA'),
        ('9701', 'EL BRINI', 'OUMAIMA', 'PVCP-APEN', 'CP', 'SA'),
        ('12524', 'MITAHIRIHASAMBARANA', 'ROVASOA FIFALIANA', 'PVCP-APEN', 'CP', 'SA'),
        ('12529', 'OULDLABBAR', 'KHALID', 'PVCP-APEN', 'CP', 'SA'),
        ('11249', 'OBA BANDZA', 'RUTH BERCHANTIE', 'PVCP-APEN', 'CP', 'PARK'),
        ('11903', 'RSISIB', 'SALMA', 'PVCP-APEN', 'CP', 'PARK'),
        ('10070', 'ZAKI', 'IMANE', 'PVCP-APEN', 'CP', 'PARK'),
        ('12747', 'BABINGUI BABOU', 'BERPHONSIA NOUTERSE', 'PVCP-APEN', 'CP', 'SE'),
        ('12640', 'BESSI', 'LOIC', 'PVCP-APEN', 'CP', 'SE'),
        ('12741', 'BIOGHE NANH', 'PAUL ELIE', 'PVCP-APEN', 'CP', 'SE'),
        ('12746', 'BOUROBOU', 'DANIELA MORILLE', 'PVCP-APEN', 'CP', 'SE'),
        ('12743', 'NGOUMTSA NONGNY', 'INES', 'PVCP-APEN', 'CP', 'SE'),
        ('11250', 'TAKASSI', 'RENE', 'PVCP-APEN', 'CP', 'SE'),
        ('12862', 'BAYO', 'EMMANUELA FATIM', 'PVCP-APEN', 'CP', 'BO'),
        ('9995', 'KWOMO MOGO', 'ANGE DRUCILE', 'PVCP-APEN', 'CP', 'BO'),
        ('12541', 'MIRINIOUI', 'MAJDA', 'PVCP-APEN', 'CP', 'BO'),
        ('12860', 'MPIKA', 'FELICIA YHAN MAURICE', 'PVCP-APEN', 'CP', 'BO'),
        ('12864', 'ZAROUAL', 'HIND', 'PVCP-APEN', 'CP', 'BO'),
        ('7042', 'Belhajjam', 'Soufiane', 'PVCP-APSO', 'CP', 'APSO'),
        ('10569', 'EL BENAYE', 'RAJAE', 'PVCP-APSO', 'CP', 'APSO'),
        ('7893', 'jebari', 'siham', 'PVCP-APSO', 'CP', 'APSO'),
        ('7795', 'kebe', 'merry sow', 'PVCP-APSO', 'CP', 'APSO'),
        ('9964', 'OKILI AMOGHO LOLE', 'BRUXIA FRANCELINE', 'PVCP-APSO', 'CP', 'APSO')
    ]

    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            # Récupérer les maps Libellé -> ID
            cur.execute("SELECT id, libelle FROM ref_operations")
            ops = {r['libelle']: r['id'] for r in cur.fetchall()}
            
            cur.execute("SELECT id, libelle FROM ref_sous_projet")
            files = {r['libelle']: r['id'] for r in cur.fetchall()}
            
            cur.execute("SELECT id, libelle FROM ref_activites")
            acts = {r['libelle']: r['id'] for r in cur.fetchall()}

            # Insérer les employés
            sql = """
                INSERT INTO ref_employes (matricule, nom, prenom, id_operation, id_sous_projet, id_activite)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE 
                    nom=VALUES(nom), prenom=VALUES(prenom), 
                    id_operation=VALUES(id_operation), id_sous_projet=VALUES(id_sous_projet), id_activite=VALUES(id_activite)
            """
            data = []
            for m, n, p, op, f, act in agents:
                data.append((m, n, p, ops.get(op), files.get(f), acts.get(act)))
            
            cur.executemany(sql, data)
            conn.commit()
            print(f"Migration de {len(data)} employés terminée.")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_agents()
