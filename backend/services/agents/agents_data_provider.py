"""
Fichier : agents_data_provider.py
Rôle    : Service de gestion des données manuelles (statut, sanction) des agents.
Module  : mypaie / backend / services / agents
"""

import logging
from config.db_mysql_connector import get_mysql_connection

logger = logging.getLogger(__name__)

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
