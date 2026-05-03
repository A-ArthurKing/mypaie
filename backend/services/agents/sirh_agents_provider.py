"""
Fichier : sirh_agents_provider.py
Rôle    : Requête la base SIRH SQL Server pour récupérer les agents
          d'une opération donnée (filtrée par libel_bus).
Module  : mypaie / backend / services / agents
"""

import logging
from config.db_sqlserver_connector import get_sirh_connection

logger = logging.getLogger(__name__)


def get_agents_sirh(projet_filter: str = None, operations_list: list = None) -> list:
    """
    Retourne les agents depuis la base SIRH.
    Si operations_list est fourni, filtre par une liste d'opérations.
    Sinon, si projet_filter est fourni, filtre par libel_bus contenant cette valeur.
    """
    connection = None
    try:
        connection = get_sirh_connection()
        with connection.cursor() as cursor:
            sql = """
                SELECT
                    e.Ref_employ   AS matricule,
                    e.firstname    AS prenom,
                    e.lastname     AS nom,
                    b.libel_bus    AS operation,
                    s.libel_serv   AS service,
                    f.libel_func   AS fonction
                FROM sirh_poste AS p
                LEFT JOIN sirh_employ AS e
                    ON CAST(p.Ref_employ AS VARCHAR(50)) = CAST(e.mat AS VARCHAR(50))
                LEFT JOIN sirh_business AS b ON p.id_bus = b.id_bus
                LEFT JOIN sirh_service  AS s ON p.id_serv = s.id_serv
                LEFT JOIN sirh_fonction AS f ON p.id_func = f.id_func
                WHERE e.Ref_employ IS NOT NULL
            """
            
            if operations_list:
                # Filtrage par liste d'opérations (Mapping Projet)
                placeholders = ', '.join(['%s'] * len(operations_list))
                sql += f" AND b.libel_bus IN ({placeholders})"
                cursor.execute(sql, tuple(operations_list))
            elif projet_filter:
                # Filtrage classique par chaîne
                sql += " AND b.libel_bus LIKE %s"
                cursor.execute(sql, (f"%{projet_filter}%",))
            else:
                cursor.execute(sql)

            rows = cursor.fetchall()
            # Normaliser les champs en strings propres
            return [
                {
                    "matricule":  str(r.get("matricule") or "").strip(),
                    "prenom":     str(r.get("prenom")    or "").strip(),
                    "nom":        str(r.get("nom")       or "").strip(),
                    "operation":  str(r.get("operation") or "").strip(),
                }
                for r in rows
            ]
    except Exception as e:
        logger.error("Erreur récupération agents SIRH : %s", e)
        raise e
    finally:
        if connection:
            connection.close()
