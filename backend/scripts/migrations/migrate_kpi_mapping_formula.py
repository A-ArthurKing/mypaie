"""
Migration script to add formula support to matrice_kpis_mapping.
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
            # 1. Add columns
            print("Adding formula columns to matrice_kpis_mapping...")
            try:
                cursor.execute("ALTER TABLE matrice_kpis_mapping ADD COLUMN is_formula TINYINT(1) DEFAULT 0 AFTER source_column")
            except Exception as e:
                if "Duplicate column name" not in str(e): raise e
            
            try:
                cursor.execute("ALTER TABLE matrice_kpis_mapping ADD COLUMN formula TEXT NULL AFTER is_formula")
            except Exception as e:
                if "Duplicate column name" not in str(e): raise e

            # 2. Update source_column to be nullable if it's a formula
            print("Making source_column nullable...")
            cursor.execute("ALTER TABLE matrice_kpis_mapping MODIFY COLUMN source_column VARCHAR(100) NULL")

            connection.commit()
            print("Migration successful.")
    except Exception as e:
        print(f"Migration failed: {e}")
        connection.rollback()
    finally:
        connection.close()

if __name__ == "__main__":
    migrate()
