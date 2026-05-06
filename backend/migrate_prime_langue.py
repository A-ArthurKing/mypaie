"""
Migration script to add prime_langue to ref_employes.
"""
import os
from dotenv import load_dotenv
from config.db_mysql_connector import get_mysql_connection

load_dotenv()

def migrate():
    connection = get_mysql_connection()
    try:
        with connection.cursor() as cursor:
            # 1. Add column
            print("Adding prime_langue column...")
            try:
                cursor.execute("ALTER TABLE ref_employes ADD COLUMN prime_langue FLOAT DEFAULT 0")
                print("Column added.")
            except Exception as e:
                if "Duplicate column name" in str(e):
                    print("Column already exists.")
                else:
                    raise e

            # 2. Update existing data
            print("Updating prime_langue for 'CP NEERLANDO APSO'...")
            sql_update = """
                UPDATE ref_employes e
                JOIN ref_structure_map m ON e.id_structure = m.id
                JOIN ref_operations o ON m.id_operation = o.id
                SET e.prime_langue = 800
                WHERE o.libelle = 'CP NEERLANDO APSO'
            """
            cursor.execute(sql_update)
            print(f"Updated {cursor.rowcount} agents.")
            
            connection.commit()
            print("Migration successful.")
    except Exception as e:
        print(f"Migration failed: {e}")
        connection.rollback()
    finally:
        connection.close()

if __name__ == "__main__":
    migrate()
