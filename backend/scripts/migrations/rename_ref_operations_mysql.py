"""
Migration : Renomme ref_operations en ref_operations dans la base MySQL gestionpaie.
À exécuter une seule fois sur les environnements existants.
"""
import sys, os
sys.path.insert(0, '/app')

from config.db_gestionpaie_connector import get_gestionpaie_connection

conn = get_gestionpaie_connection()
with conn:
    with conn.cursor() as cur:
        # Supprimer les contraintes FK qui pointent vers ref_operations
        cur.execute("""
            SELECT TABLE_NAME, CONSTRAINT_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE REFERENCED_TABLE_NAME = 'ref_operations'
              AND TABLE_SCHEMA = DATABASE()
        """)
        fk_rows = cur.fetchall()

        for row in fk_rows:
            tbl = row['TABLE_NAME']
            fk  = row['CONSTRAINT_NAME']
            print(f"  Dropping FK {fk} on {tbl}")
            cur.execute(f"ALTER TABLE `{tbl}` DROP FOREIGN KEY `{fk}`")

        # Renommer la table
        print("  Renaming ref_operations -> ref_operations")
        cur.execute("ALTER TABLE ref_operations RENAME TO ref_operations")

        # Recréer les contraintes FK avec le nouveau nom
        fk_defs = [
            ("ref_structure_map", "id_operation", "fk_strmap_operation"),
            ("ref_employes",      "id_operation", "fk_emp_operation"),
        ]
        for tbl, col, fk_name in fk_defs:
            print(f"  Recreating FK {fk_name} on {tbl}")
            cur.execute(f"""
                ALTER TABLE `{tbl}`
                ADD CONSTRAINT `{fk_name}`
                FOREIGN KEY (`{col}`) REFERENCES `ref_operations`(id)
                ON DELETE SET NULL
            """)

    conn.commit()
    print("Migration terminée avec succès.")
