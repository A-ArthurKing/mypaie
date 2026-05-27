"""
Migration 010 - Assiduite Auto-Sync
Ajoute les colonnes nécessaires au système de synchronisation automatique :
  - assiduite_mensuelle.is_overridden  : protège la ligne d'une surcharge auto
  - assiduite_mensuelle.jours_travailles : J.TRAV calculé depuis gestionpaie
  - assiduite_mensuelle.synced_at      : horodatage de la dernière synchro auto
  - assiduite_historique.source        : origine de la modification (MANUEL | AUTO_SYNC)
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from config.db_mysql_connector import get_mysql_connection

MIGRATIONS = [
    (
        "assiduite_mensuelle",
        "is_overridden",
        "ALTER TABLE assiduite_mensuelle ADD COLUMN is_overridden tinyint(1) NOT NULL DEFAULT 0 "
        "COMMENT '1 = modifie manuellement par la RH, protege de la synchro auto'",
    ),
    (
        "assiduite_mensuelle",
        "jours_travailles",
        "ALTER TABLE assiduite_mensuelle ADD COLUMN jours_travailles tinyint unsigned NOT NULL DEFAULT 0 "
        "COMMENT 'J.TRAV calcule depuis gestionpaie.heures_corrigees'",
    ),
    (
        "assiduite_mensuelle",
        "synced_at",
        "ALTER TABLE assiduite_mensuelle ADD COLUMN synced_at timestamp NULL DEFAULT NULL "
        "COMMENT 'Derniere synchro automatique depuis gestionpaie'",
    ),
    (
        "assiduite_historique",
        "source",
        "ALTER TABLE assiduite_historique ADD COLUMN source varchar(20) NOT NULL DEFAULT 'MANUEL' "
        "COMMENT 'Origine de la modification : MANUEL ou AUTO_SYNC'",
    ),
]


def column_exists(cursor, table: str, column: str) -> bool:
    cursor.execute(
        "SELECT COUNT(*) AS n FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s",
        (table, column),
    )
    return cursor.fetchone()["n"] > 0


def run():
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            for table, col, ddl in MIGRATIONS:
                if column_exists(cur, table, col):
                    print(f"  [SKIP]  {table}.{col} existe deja")
                else:
                    cur.execute(ddl)
                    print(f"  [OK]    {table}.{col} ajoute")
        conn.commit()
        print("Migration 010 terminee avec succes.")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
