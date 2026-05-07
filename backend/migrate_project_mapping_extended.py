"""
Migration script to add file and activity to ref_projets_mapping.
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
            # 1. Add id_file and id_activite columns
            print("Adding id_file and id_activite columns to ref_projets_mapping...")
            try:
                cursor.execute("ALTER TABLE ref_projets_mapping ADD COLUMN id_file INT UNSIGNED NULL AFTER id_projet")
                print("Column id_file added.")
            except Exception as e:
                if "Duplicate column name" in str(e): print("Column id_file already exists.")
                else: raise e
            
            try:
                cursor.execute("ALTER TABLE ref_projets_mapping ADD COLUMN id_activite INT UNSIGNED NULL AFTER id_file")
                print("Column id_activite added.")
            except Exception as e:
                if "Duplicate column name" in str(e): print("Column id_activite already exists.")
                else: raise e

            connection.commit()
            print("Migration successful.")
    except Exception as e:
        print(f"Migration failed: {e}")
        connection.rollback()
    finally:
        connection.close()

if __name__ == "__main__":
    migrate()
