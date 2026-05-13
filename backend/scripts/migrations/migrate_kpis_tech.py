"""
Migration script to enrich matrice_kpis with technical keys and universes.
"""
import os
from dotenv import load_dotenv
from config.db_mysql_connector import get_mysql_connection

load_dotenv()

def migrate():
    connection = get_mysql_connection()
    try:
        with connection.cursor() as cursor:
            # 1. Add columns if they don't exist
            print("Adding tech columns to matrice_kpis...")
            try:
                cursor.execute("ALTER TABLE matrice_kpis ADD COLUMN univers ENUM('PERF', 'QUALITE', 'HEURES') NOT NULL DEFAULT 'PERF' AFTER unite")
            except Exception as e:
                if "Duplicate column name" not in str(e): raise e
            
            try:
                cursor.execute("ALTER TABLE matrice_kpis ADD COLUMN tech_key VARCHAR(50) NULL COMMENT 'Clé technique dans le DW' AFTER univers")
            except Exception as e:
                if "Duplicate column name" not in str(e): raise e

            # 2. Update existing standard KPIs
            print("Updating standard KPIs...")
            updates = [
                ("CSAT", "QUALITE", "csat_moyen"),
                ("CONV", "PERF", "taux_conversion_calc"),
                ("CA", "PERF", "chiffre_affaire"),
                ("APPELS", "PERF", "in_call_nbr"),
                ("DMT", "PERF", "dmt"),
                ("LOGGED", "HEURES", "logged_min")
            ]
            for code, univers, tech_key in updates:
                cursor.execute("UPDATE matrice_kpis SET univers = %s, tech_key = %s WHERE code = %s", (univers, tech_key, code))

            # 3. Add missing KPIs for Hours
            print("Adding missing 'Heures HP'...")
            cursor.execute("""
                INSERT INTO matrice_kpis (code, libelle, unite, univers, tech_key) 
                VALUES ('HEURE_HP', 'Heures Produites (HP)', 'h', 'HEURES', 'heure_hp')
                ON DUPLICATE KEY UPDATE univers='HEURES', tech_key='heure_hp'
            """)
            
            connection.commit()
            print("Migration successful.")
    except Exception as e:
        print(f"Migration failed: {e}")
        connection.rollback()
    finally:
        connection.close()

if __name__ == "__main__":
    migrate()
