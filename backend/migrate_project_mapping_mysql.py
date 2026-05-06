"""
Migration script to create the ref_projets_mapping table in MySQL.
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
            # 1. Create project mapping table
            print("Creating ref_projets_mapping table...")
            sql = """
                CREATE TABLE IF NOT EXISTS ref_projets_mapping (
                    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    source_name VARCHAR(200) NOT NULL COMMENT 'Nom du projet dans la source (ex: BigQuery)',
                    id_projet INT UNSIGNED NOT NULL COMMENT 'Lien vers ref_projets.id',
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_project_source (source_name)
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
