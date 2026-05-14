
from config.db_mysql_connector import get_mysql_connection

def add_new_agents():
    # Format: (matricule, nom, prenom, operation, file, activite)
    new_agents = [
        # CP NEERLANDO APSO
        ('10022', 'EL JADIDI', 'YOUSSEF', 'CP NEERLANDO APSO', 'CP', 'SA'),
        ('12537', 'RHILA', 'MONTACIR', 'CP NEERLANDO APSO', 'CP', 'SA'),
        ('12878', 'BEN OMAR', 'KHALID', 'CP NEERLANDO APSO', 'CP', 'SA'),
        ('12490', 'OUZGNI', 'AICHA', 'CP NEERLANDO APSO', 'CP', 'SA'),
        ('12825', 'BOJADA', 'OMAR', 'CP NEERLANDO APSO', 'CP', 'SA'),
        
        # CP GERMANO
        ('10017', 'EZZIN', 'HICHAM', 'CP GERMANO', 'CP', 'SA'),
        ('10852', 'SATIANE', 'SOUFIAN', 'CP GERMANO', 'CP', 'SA'),
        ('10363', 'MILOUDI', 'YASSIR', 'CP GERMANO', 'CP', 'SE'),
        ('10733', 'LOUMOU', 'AYOUB', 'CP GERMANO', 'CP', 'SE'),
        ('10245', 'HACHAD', 'DRISS', 'CP GERMANO', 'CP', 'SE'),
        ('11475', 'EL HOSAYNY', 'OUALID', 'CP GERMANO', 'CP', 'SE'),
        ('11481', 'ABARGUIH', 'SAID', 'CP GERMANO', 'CP', 'SE'),
        ('11536', 'TAOUFIQ', 'MOHAMMED', 'CP GERMANO', 'CP', 'SE'),
        ('10016', 'NIMIROU', 'ALAE', 'CP GERMANO', 'CP', 'APSO'),
        ('10021', 'LAHMAR', 'YOUNESS', 'CP GERMANO', 'CP', 'APSO'),
        ('10362', 'SEFRI', 'YOUNESS', 'CP GERMANO', 'CP', 'APSO'),
        
        # CP Belgique
        ('2689', 'fnitiz', 'abdelfatah', 'CP Belgique', 'CP', 'SA-SE'),
        ('9399', 'NHILI', 'AMINE', 'CP Belgique', 'CP', 'SA-SE'),
        ('11370', 'LAHMAR', 'MOHAMMED', 'CP Belgique', 'CP', 'SA-SE'),
        ('11902', 'DAOUAH', 'ALLAE', 'CP Belgique', 'CP', 'SA-SE')
    ]

    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            # Maps
            cur.execute("SELECT id, libelle FROM ref_operations")
            ops = {r['libelle']: r['id'] for r in cur.fetchall()}
            cur.execute("SELECT id, libelle FROM ref_sous_projet")
            files = {r['libelle']: r['id'] for r in cur.fetchall()}
            cur.execute("SELECT id, libelle FROM ref_activites")
            acts = {r['libelle']: r['id'] for r in cur.fetchall()}

            sql = """
                INSERT INTO ref_employes (matricule, nom, prenom, id_operation, id_sous_projet, id_activite)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE 
                    nom=VALUES(nom), prenom=VALUES(prenom), 
                    id_operation=VALUES(id_operation), id_sous_projet=VALUES(id_sous_projet), id_activite=VALUES(id_activite)
            """
            data = []
            for m, n, p, op, f, act in new_agents:
                data.append((m, n, p, ops.get(op), files.get(f), acts.get(act)))
            
            cur.executemany(sql, data)
            conn.commit()
            print(f"Ajout de {len(data)} nouveaux employes reussi.")
    finally:
        conn.close()

if __name__ == "__main__":
    add_new_agents()
