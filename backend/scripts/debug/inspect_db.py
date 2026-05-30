import sys; sys.path.insert(0, "/app")
from config.db_gestionpaie_connector import get_gestionpaie_connection

def inspect_db():
    print("--- CONNEXION A GESTIONPAIE (192.168.1.17) ---")
    try:
        conn = get_gestionpaie_connection()
        with conn.cursor() as cur:
            # 1. Liste des tables
            cur.execute("SHOW TABLES")
            tables = [r.popitem()[1] for r in cur.fetchall()]
            print(f"Tables trouvées ({len(tables)}):", ", ".join(tables))
            
            # 2. Structure de heures_corrigees
            if "heures_corrigees" in tables:
                print("\n--- SCHEMA DE 'heures_corrigees' ---")
                cur.execute("DESCRIBE heures_corrigees")
                for r in cur.fetchall():
                    print(f"{r['Field']} : {r['Type']}")
                
                print("\n--- EXEMPLE DE LIGNES (heures_corrigees) ---")
                cur.execute("SELECT * FROM heures_corrigees ORDER BY date_import DESC LIMIT 2")
                for r in cur.fetchall():
                    print(r)
                    
            # 3. Structure d'autres tables prometteuses (comme plannings, absences, retards)
            for tb in ["plannings", "absences", "pointages"]:
                if tb in tables:
                    print(f"\n--- SCHEMA DE '{tb}' ---")
                    cur.execute(f"DESCRIBE {tb}")
                    for r in cur.fetchall():
                        print(f"{r['Field']} : {r['Type']}")
        conn.close()
    except Exception as e:
        print("Erreur:", e)

if __name__ == "__main__":
    inspect_db()
