"""
Fichier : dw_api_regles_provider.py
Rôle    : Service de gestion des règles de primes dans la base MySQL.
Module  : mypaie / backend / services / regles_primes
"""

import logging
import uuid
from datetime import datetime
from config.db_mysql_connector import get_mysql_connection

logger = logging.getLogger(__name__)


def get_regle_by_id(regle_id: int) -> dict | None:
    """
    Récupère une règle par son ID depuis la table matrice_primes.
    Retourne None si non trouvée.
    """
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            sql = """
                SELECT id, code, libelle, projet, periodicite, description,
                       periode_debut, periode_fin, actif, created_at, updated_at
                FROM matrice_primes
                WHERE id = %s
            """
            cursor.execute(sql, (regle_id,))
            row = cursor.fetchone()
            if not row:
                return None
            return {
                "id": row["id"],
                "code": row["code"],
                "nom": row["libelle"],
                "projet": row["projet"],
                "periodicite": row["periodicite"],
                "description": row["description"],
                "periode_debut": str(row["periode_debut"]) if row["periode_debut"] else None,
                "periode_fin": str(row["periode_fin"]) if row["periode_fin"] else None,
                "actif": bool(row["actif"]),
                "created_at": str(row["created_at"]) if row["created_at"] else None,
                "updated_at": str(row["updated_at"]) if row["updated_at"] else None,
            }
    except Exception as e:
        logger.error(f"Erreur lors de la récupération de la règle {regle_id}: {e}")
        raise e
    finally:
        if connection:
            connection.close()


def get_regles() -> list:
    """
    Récupère toutes les règles depuis la table matrice_primes.
    """
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            sql = """
                SELECT id, code, libelle, projet, periodicite, description,
                       periode_debut, actif, created_at
                FROM matrice_primes
                ORDER BY created_at DESC
            """
            cursor.execute(sql)
            rows = cursor.fetchall()
            regles = []
            for row in rows:
                regles.append({
                    "id": row["id"],
                    "code": row["code"],
                    "nom": row["libelle"],
                    "projet": row["projet"],
                    "periodicite": row["periodicite"],
                    "description": row["description"],
                    "periode_debut": str(row["periode_debut"]) if row["periode_debut"] else None,
                    "actif": bool(row["actif"]),
                    "created_at": str(row["created_at"]) if row["created_at"] else None,
                })
            return regles
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des règles: {e}")
        raise e
    finally:
        if connection:
            connection.close()


def create_regle(data: dict):
    """
    Insère une nouvelle règle dans la table matrice_primes.
    Retourne l'ID et le code de la règle créée.
    """
    nom         = data.get("nom", "Sans nom")
    projet      = data.get("projet", "")
    periodicite = data.get("periodicite", "mensuelle")
    description = data.get("description", "")

    code          = f"REGLE_{uuid.uuid4().hex[:8].upper()}"
    periode_debut = datetime.now().strftime("%Y-%m-%d")

    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            sql = """
                INSERT INTO matrice_primes
                (code, libelle, projet, periodicite, description, periode_debut, actif)
                VALUES (%s, %s, %s, %s, %s, %s, 1)
            """
            cursor.execute(sql, (code, nom, projet, periodicite, description, periode_debut))
            connection.commit()
            return {"id": cursor.lastrowid, "code": code, "nom": nom, "projet": projet, "status": "success"}
    except Exception as e:
        logger.error(f"Erreur lors de la création de la règle: {e}")
        raise e
    finally:
        if connection:
            connection.close()
