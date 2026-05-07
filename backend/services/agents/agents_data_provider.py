"""
Fichier : agents_data_provider.py
Rôle    : Service de gestion des données manuelles (statut, sanction) des agents.
Module  : mypaie / backend / services / agents
"""

import logging
from config.db_mysql_connector import get_mysql_connection
from tools.cache import get_cached, set_cached, invalidate

logger = logging.getLogger(__name__)

_CACHE_KEY_AGENTS = "agents:gestion"
_CACHE_TTL_AGENTS = 300  # 5 minutes

def get_agents_manual_data(matrice_id: int) -> list:
    """
    Récupère la liste complète des agents enregistrés en local pour une règle.
    """
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            sql = "SELECT agent_matricule as matricule, nom, prenom, operation, statut, sanction, file, activite FROM matrice_primes_agents_data WHERE matrice_id = %s"
            cursor.execute(sql, (matrice_id,))
            return cursor.fetchall()
    except Exception as e:
        logger.error(f"Erreur get_agents_manual_data : {e}")
        return []
    finally:
        if connection:
            connection.close()

def save_agent_manual_data(matrice_id: int, matricule: str, data: dict):
    """
    Sauvegarde ou met à jour les données complètes d'un agent en local.
    """
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            sql = """
                INSERT INTO matrice_primes_agents_gestion (matrice_id, agent_matricule, id_statut, sanction)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE 
                    id_statut = VALUES(id_statut), 
                    sanction = VALUES(sanction)
            """
            cursor.execute(sql, (
                matrice_id, 
                matricule, 
                data.get('id_statut'), 
                data.get('sanction', 'Non')
            ))
            connection.commit()
    except Exception as e:
        logger.error(f"Erreur save_agent_manual_data : {e}")
        raise e
    finally:
        if connection:
            connection.close()

def get_all_agents_gestion() -> list:
    """
    Récupère la liste de tous les agents pour la page de gestion globale.
    Résultat mis en cache 5 min — invalidé automatiquement sur toute mutation.
    """
    cached = get_cached(_CACHE_KEY_AGENTS)
    if cached is not None:
        logger.debug("Cache HIT [%s]", _CACHE_KEY_AGENTS)
        return cached

    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            sql = """
                SELECT 
                    e.matricule, e.nom, e.prenom,
                    p.nom as projet,
                    o.libelle as operation,
                    f.libelle as file,
                    a.libelle as activite,
                    e.id_statut,
                    s.libelle as statut,
                    e.prime_langue
                FROM ref_employes e
                LEFT JOIN ref_structure_map m ON e.id_structure = m.id
                LEFT JOIN ref_projets p ON m.id_projet = p.id
                LEFT JOIN ref_operations o ON m.id_operation = o.id
                LEFT JOIN ref_files f ON m.id_file = f.id
                LEFT JOIN ref_activites a ON m.id_activite = a.id
                LEFT JOIN ref_statuts s ON e.id_statut = s.id
                ORDER BY e.nom, e.prenom
            """
            cursor.execute(sql)
            result = cursor.fetchall()
        set_cached(_CACHE_KEY_AGENTS, result, _CACHE_TTL_AGENTS)
        return result
    except Exception as e:
        logger.error(f"Erreur get_all_agents_gestion : {e}")
        return []
    finally:
        if connection:
            connection.close()

def update_agent_global_statut(matricule: str, id_statut: int):
    """
    Met à jour le statut global d'un agent.
    """
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            sql = "UPDATE ref_employes SET id_statut = %s WHERE matricule = %s"
            cursor.execute(sql, (id_statut, matricule))
            connection.commit()
        invalidate(_CACHE_KEY_AGENTS)
    except Exception as e:
        logger.error(f"Erreur update_agent_global_statut : {e}")
        raise e
    finally:
        if connection:
            connection.close()


def add_agent(matricule: str, nom: str, prenom: str, id_structure: int, id_statut=None, prime_langue=0) -> dict:
    """
    Ajoute un nouvel agent dans ref_employes et retourne l'enregistrement enrichi.
    """
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            sql_insert = """
                INSERT INTO ref_employes (matricule, nom, prenom, id_structure, id_statut, prime_langue)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            cursor.execute(sql_insert, (matricule, nom, prenom, id_structure, id_statut or None, prime_langue))
            connection.commit()

            sql_get = """
                SELECT
                    e.matricule, e.nom, e.prenom,
                    p.nom  AS projet,
                    o.libelle AS operation,
                    f.libelle AS file,
                    a.libelle AS activite,
                    e.id_statut,
                    s.libelle AS statut,
                    e.prime_langue
                FROM ref_employes e
                LEFT JOIN ref_structure_map m ON e.id_structure = m.id
                LEFT JOIN ref_projets     p ON m.id_projet    = p.id
                LEFT JOIN ref_operations  o ON m.id_operation = o.id
                LEFT JOIN ref_files       f ON m.id_file      = f.id
                LEFT JOIN ref_activites   a ON m.id_activite  = a.id
                LEFT JOIN ref_statuts     s ON e.id_statut    = s.id
                WHERE e.matricule = %s
            """
            cursor.execute(sql_get, (matricule,))
            result = cursor.fetchone()
        invalidate(_CACHE_KEY_AGENTS)
        return result
    except Exception as e:
        logger.error(f"Erreur add_agent : {e}")
        raise e
    finally:
        if connection:
            connection.close()


def update_agent(matricule: str, nom: str, prenom: str, id_structure: int, id_statut=None, prime_langue=0) -> dict:
    """
    Met à jour les informations d'un agent existant et retourne l'enregistrement enrichi.
    """
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            sql_update = """
                UPDATE ref_employes
                SET nom = %s, prenom = %s, id_structure = %s, id_statut = %s, prime_langue = %s
                WHERE matricule = %s
            """
            cursor.execute(sql_update, (nom, prenom, id_structure, id_statut or None, prime_langue, matricule))
            connection.commit()

            sql_get = """
                SELECT
                    e.matricule, e.nom, e.prenom,
                    p.nom  AS projet,
                    o.libelle AS operation,
                    f.libelle AS file,
                    a.libelle AS activite,
                    e.id_statut,
                    s.libelle AS statut,
                    e.prime_langue
                FROM ref_employes e
                LEFT JOIN ref_structure_map m ON e.id_structure = m.id
                LEFT JOIN ref_projets     p ON m.id_projet    = p.id
                LEFT JOIN ref_operations  o ON m.id_operation = o.id
                LEFT JOIN ref_files       f ON m.id_file      = f.id
                LEFT JOIN ref_activites   a ON m.id_activite  = a.id
                LEFT JOIN ref_statuts     s ON e.id_statut    = s.id
                WHERE e.matricule = %s
            """
            cursor.execute(sql_get, (matricule,))
            result = cursor.fetchone()
        invalidate(_CACHE_KEY_AGENTS)
        return result
    except Exception as e:
        logger.error(f"Erreur update_agent : {e}")
        raise e
    finally:
        if connection:
            connection.close()


def delete_agent(matricule: str):
    """
    Supprime un agent de ref_employes.
    """
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM ref_employes WHERE matricule = %s", (matricule,))
            connection.commit()
        invalidate(_CACHE_KEY_AGENTS)
    except Exception as e:
        logger.error(f"Erreur delete_agent : {e}")
        raise e
    finally:
        if connection:
            connection.close()
