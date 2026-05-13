"""
Fichier : core/db/gestionpaie.py
Rôle    : Fournit une connexion PyMySQL à la base gestionpaie (source des heures agents).
          Base MySQL externe hébergeant les tables heures_corrigees, conges, etc.
Module  : mypaie / backend / core / db
"""

import os
import pymysql
import pymysql.cursors


def get_gestionpaie_connection():
    """Retourne une connexion PyMySQL à la base gestionpaie (DictCursor)."""
    return pymysql.connect(
        host=os.getenv("GESTIONPAIE_HOST", "192.168.1.17"),
        port=int(os.getenv("GESTIONPAIE_PORT", 3306)),
        user=os.getenv("GESTIONPAIE_USER", "gestion_paie"),
        password=os.getenv("GESTIONPAIE_PASSWORD", ""),
        database=os.getenv("GESTIONPAIE_DATABASE", "gestionpaie"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
        connect_timeout=10,
    )
