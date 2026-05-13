"""
Migration script to add project scoping to matrice_kpis_mapping.
"""
import os
import sys
from dotenv import load_dotenv

# Add current directory to path to allow absolute imports if run from here
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config.db_mysql_connector import get_mysql_connection

load_dotenv('.env')

def migrate():
    connection = get_mysql_connection()
    try:
        with connection.cursor() as cursor:
            # 1. Add id_projet column
            print("Adding id_projet column to matrice_kpis_mapping...")
            try:
                cursor.execute("ALTER TABLE matrice_kpis_mapping ADD COLUMN id_projet INT UNSIGNED NULL AFTER standard_kpi_code")
            except Exception as e:
                if "Duplicate column name" not in str(e): raise e

            # 2. Update Unique Key
            print("Updating unique constraint...")
            try:
                cursor.execute("ALTER TABLE matrice_kpis_mapping DROP INDEX uq_source_mapping")
            except:
                pass
            
            # The new unique key includes id_projet (NULL allowed in unique keys in MySQL, but we want to avoid duplicates)
            # Actually, NULL in unique keys is tricky. We'll use COALESCE or just accept multiple globals?
            # Better: (source_table, source_column, univers, id_projet) where id_projet can be NULL.
            cursor.execute("ALTER TABLE matrice_kpis_mapping ADD UNIQUE KEY uq_source_scoped (source_table, source_column, univers, id_projet)")

            connection.commit()
            print("Migration successful.")
    except Exception as e:
        print(f"Migration failed: {e}")
        connection.rollback()
    finally:
        connection.close()

if __name__ == "__main__":
    migrate()
