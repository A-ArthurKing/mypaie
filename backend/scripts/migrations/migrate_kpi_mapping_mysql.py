"""
Migration script to create the matrice_kpis_mapping table in MySQL.
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
            # 1. Create mapping table
            print("Creating matrice_kpis_mapping table...")
            sql = """
                CREATE TABLE IF NOT EXISTS matrice_kpis_mapping (
                    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    univers ENUM('PERF', 'QUALITE', 'HEURES') NOT NULL,
                    source_table VARCHAR(200) NOT NULL COMMENT 'Table/Vue source dans BigQuery',
                    source_column VARCHAR(100) NOT NULL COMMENT 'Nom de la colonne source',
                    standard_kpi_code VARCHAR(30) NOT NULL COMMENT 'Lien vers matrice_kpis.code',
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_source_mapping (source_table, source_column, univers)
                ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
            """
            cursor.execute(sql)
            
            connection.commit()
            print("Migration successful.")
    except Exception as e:
        print(f"Migration failed: {e}")
        connection.rollback()
    finally:
        connection.close()

if __name__ == "__main__":
    migrate()
