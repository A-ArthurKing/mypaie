"""
Fichier : db_sqlserver_connector.py
Rôle    : Fournit une connexion pymssql à la base SQL Server SIRH (QUALITE).
          Utilisé pour récupérer les données des employés depuis le SIRH interne.
Module  : mypaie / backend / config
"""

import os


def get_sirh_connection():
    """Retourne une connexion pymssql à la base SIRH SQL Server."""
    try:
        import pymssql
    except ImportError:
        raise RuntimeError(
            "pymssql n'est pas installé. Rebuilder le conteneur backend avec 'docker compose up --build backend'."
        )
    return pymssql.connect(
        server=os.getenv("SIRH_SERVER", "192.168.1.241"),
        user=os.getenv("SIRH_USER", "sa"),
        password=os.getenv("SIRH_PASSWORD", "sa"),
        database=os.getenv("SIRH_DATABASE", "QUALITE"),
        charset="UTF-8",
        as_dict=True,
    )
