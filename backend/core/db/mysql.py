"""
Fichier : core/db/mysql.py
Rôle    : Fournit une connexion PyMySQL à la base mypaie_config.
          Utilisé par le moteur de calcul des primes et objectifs.
Module  : mypaie / backend / core / db
"""

import os
import pymysql
import pymysql.cursors


def get_mysql_connection():
    """Retourne une connexion PyMySQL à mypaie_config (DictCursor)."""
    return pymysql.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        port=int(os.getenv("MYSQL_PORT", 3306)),
        user=os.getenv("MYSQL_USER", "mypaie"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DATABASE", "mypaie_config"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
    )
