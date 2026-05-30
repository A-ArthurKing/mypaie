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


def _normalize_metric_keys(grille: dict) -> dict:
    """
    Normalise les metric_key des indicateurs vers les code_kpi canoniques de config_kpis.
    Garantit la cohérence entre la grille JSON et les clés retournées par le moteur KPI.
    Non-fatal : en cas d'erreur, retourne la grille inchangée.
    """
    if not grille or 'indicateurs' not in grille:
        return grille
    try:
        import json as _json
        import pymysql
        conn = get_mysql_connection()
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute("SELECT code_kpi, bq_kpi_codes FROM config_kpis WHERE is_active = 1")
            rows = cur.fetchall()
        conn.close()

        # Index casse-insensible : code_kpi.upper() → code_kpi canonique
        code_index = {r['code_kpi'].upper(): r['code_kpi'] for r in rows}
        # Index secondaire : bq_kpi_code.upper() → code_kpi canonique
        bq_index = {}
        for r in rows:
            raw = r.get('bq_kpi_codes')
            codes = _json.loads(raw) if isinstance(raw, str) else (raw or [])
            for bq_code in codes:
                bq_index[bq_code.upper()] = r['code_kpi']

        for ind in grille.get('indicateurs', []):
            mk = ind.get('metric_key', '')
            if not mk:
                continue
            mk_upper = mk.upper()
            if mk_upper in code_index:
                ind['metric_key'] = code_index[mk_upper]
            elif mk_upper in bq_index:
                ind['metric_key'] = bq_index[mk_upper]
            else:
                logger.warning("[normalize_metric_keys] metric_key '%s' non reconnu dans config_kpis — conservé tel quel", mk)
    except Exception as e:
        logger.warning("[normalize_metric_keys] Normalisation ignorée (non-fatale) : %s", e)
    return grille


def get_regle_by_id(regle_id: int) -> dict | None:
    """
    Récupère une règle par son ID depuis la table matrice_primes.
    Retourne None si non trouvée.
    """
    import json
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            sql = """
                SELECT 
                    mp.id, mp.code, mp.libelle, mp.id_structure, mp.sirh_filtre, mp.periodicite, mp.description,
                    mp.periode_debut, mp.periode_fin, mp.actif, mp.created_at, mp.updated_at,
                    mp.grille_objectifs, mp.formule_lisible,
                    rp.nom AS libelle_projet
                FROM matrice_primes mp
                LEFT JOIN ref_structure_map rsm ON rsm.id = mp.id_structure
                LEFT JOIN ref_projets       rp  ON rp.id  = rsm.id_projet
                WHERE mp.id = %s
            """
            cursor.execute(sql, (regle_id,))
            row = cursor.fetchone()
            if not row:
                return None
                
            grille_objectifs = None
            if row.get("grille_objectifs"):
                try:
                    grille_objectifs = json.loads(row["grille_objectifs"]) if isinstance(row["grille_objectifs"], str) else row["grille_objectifs"]
                except json.JSONDecodeError:
                    logger.warning("Erreur décodage JSON pour grille_objectifs de la règle %s", regle_id)

            # 3. Récupérer la config active si elle existe
            sql_config = "SELECT content FROM matrice_primes_configs WHERE matrice_id = %s AND est_active = 1 LIMIT 1"
            cursor.execute(sql_config, (regle_id,))
            config_row = cursor.fetchone()
            if config_row:
                config_content = json.loads(config_row["content"]) if isinstance(config_row["content"], str) else config_row["content"]
                # Fusionner la config active dans grille_objectifs
                if not grille_objectifs:
                    grille_objectifs = {}
                grille_objectifs.update(config_content)

            return {
                "id": row["id"],
                "code": row["code"],
                "nom": row["libelle"],
                "projet": row.get("libelle_projet"),
                "id_structure": row.get("id_structure"),
                "sirh_filtre": row.get("sirh_filtre"),
                "periodicite": row["periodicite"],
                "description": row["description"],
                "periode_debut": str(row["periode_debut"]) if row["periode_debut"] else None,
                "periode_fin": str(row["periode_fin"]) if row["periode_fin"] else None,
                "actif": bool(row["actif"]),
                "grille_objectifs": grille_objectifs,
                "formule_lisible": row.get("formule_lisible"),
                "created_at": str(row["created_at"]) if row["created_at"] else None,
                "updated_at": str(row["updated_at"]) if row["updated_at"] else None,
            }
    except Exception as e:
        logger.error(f"Erreur lors de la récupération de la règle {regle_id}: {e}")
        raise e
    finally:
        if connection:
            connection.close()


def update_regle_grille(regle_id: int, grille_objectifs: dict):
    """
    Met à jour grille_objectifs et dérive + persiste formule_lisible en même temps.
    La formule est recalculée à chaque sauvegarde de grille → toujours synchrone.
    """
    import json
    from modules.regles_primes.services.calculation_engine import build_formule_lisible
    # Normaliser les metric_key vers les code_kpi canoniques avant sauvegarde
    grille_objectifs = _normalize_metric_keys(grille_objectifs)
    formule_lisible  = build_formule_lisible(grille_objectifs)
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            sql = """
                UPDATE matrice_primes 
                SET grille_objectifs = %s, formule_lisible = %s
                WHERE id = %s
            """
            cursor.execute(sql, (json.dumps(grille_objectifs), formule_lisible or None, regle_id))
            connection.commit()
            return {"status": "success", "message": "Grille mise à jour"}
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour de la grille pour la règle {regle_id}: {e}")
        raise e
    finally:
        if connection:
            connection.close()


# #region CONFIGURATIONS DE GRILLES (VERSIONS)
def get_regle_configs(regle_id: int) -> list:
    """Récupère toutes les versions de grilles pour une règle donnée."""
    import json
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            sql = "SELECT id, libelle, content, est_active, created_at, grille_uuid, grille_nom, grille_ordre FROM matrice_primes_configs WHERE matrice_id = %s ORDER BY grille_ordre ASC, created_at DESC"
            cursor.execute(sql, (regle_id,))
            rows = cursor.fetchall()
            for r in rows:
                if isinstance(r["content"], str):
                    r["content"] = json.loads(r["content"])
                r["created_at"] = str(r["created_at"])
            return rows
    finally:
        if connection: connection.close()

def create_regle_config(regle_id: int, libelle: str, content: dict, activate: bool = False, grille_uuid: str = None, grille_nom: str = None):
    """Crée une nouvelle version de grille d'objectifs."""
    import json
    # Normaliser les metric_key vers les code_kpi canoniques avant sauvegarde
    content = _normalize_metric_keys(content)
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            # Si on active celle-ci, on désactive les autres DU MÊME GROUPE (ou toutes ?)
            # L'utilisateur semble vouloir que chaque grille puisse être active ?
            # Habituellement, une seule grille est active pour le calcul final.
            # Mais si on a plusieurs grilles, peut-être qu'elles s'additionnent ?
            # Pour l'instant, restons sur une désactivation globale ou par grille.
            if activate:
                # Si on veut plusieurs grilles actives en même temps, on ne désactive que celles du même uuid.
                # Mais le système de calcul actuel attend probablement une seule grille.
                # Restons sur "Une seule active par règle" pour l'instant pour éviter les conflits de calcul.
                cursor.execute("UPDATE matrice_primes_configs SET est_active = 0 WHERE matrice_id = %s", (regle_id,))
            
            sql = "INSERT INTO matrice_primes_configs (matrice_id, libelle, content, est_active, grille_uuid, grille_nom) VALUES (%s, %s, %s, %s, %s, %s)"
            cursor.execute(sql, (regle_id, libelle, json.dumps(content), 1 if activate else 0, grille_uuid, grille_nom))
            connection.commit()
            return {"id": cursor.lastrowid, "status": "success"}
    finally:
        if connection: connection.close()

def set_active_config(regle_id: int, config_id: int):
    """Définit une configuration comme étant l'active pour la règle."""
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            # 1. Tout désactiver
            cursor.execute("UPDATE matrice_primes_configs SET est_active = 0 WHERE matrice_id = %s", (regle_id,))
            # 2. Activer la cible
            cursor.execute("UPDATE matrice_primes_configs SET est_active = 1 WHERE id = %s AND matrice_id = %s", (config_id, regle_id))
            connection.commit()
            return {"status": "success"}
    finally:
        if connection: connection.close()

def update_grilles_order(regle_id: int, orders: list):
    """
    Met à jour l'ordre des grilles. 
    orders: liste de {'uuid': '...', 'ordre': 0}
    """
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            for item in orders:
                sql = "UPDATE matrice_primes_configs SET grille_ordre = %s WHERE matrice_id = %s AND grille_uuid = %s"
                cursor.execute(sql, (item['ordre'], regle_id, item['uuid']))
            connection.commit()
            return {"status": "success"}
    finally:
        if connection: connection.close()

def delete_grille(regle_id: int, grille_uuid: str):
    """Supprime toutes les versions d'une grille (identifiées par son uuid) pour une règle donnée."""
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            if grille_uuid == 'null':
                cursor.execute(
                    "DELETE FROM matrice_primes_configs WHERE matrice_id = %s AND grille_uuid IS NULL",
                    (regle_id,)
                )
            else:
                cursor.execute(
                    "DELETE FROM matrice_primes_configs WHERE matrice_id = %s AND grille_uuid = %s",
                    (regle_id, grille_uuid)
                )
            connection.commit()
            return {"status": "success", "deleted": cursor.rowcount}
    finally:
        if connection: connection.close()

def delete_regle_config(regle_id: int, config_id: int):
    """Supprime une version spécifique d'une grille (identifiée par son id config)."""
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            cursor.execute(
                "DELETE FROM matrice_primes_configs WHERE matrice_id = %s AND id = %s",
                (regle_id, config_id)
            )
            connection.commit()
            return {"status": "success", "deleted": cursor.rowcount}
    finally:
        if connection: connection.close()
# #endregion

def get_regles() -> list:
    """
    Récupère toutes les règles depuis matrice_primes, enrichies des labels
    de structure (projet, opération, file, activité) via ref_structure_map.
    """
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            sql = """
                SELECT
                    mp.id, mp.code, mp.libelle, mp.id_structure,
                    mp.periodicite, mp.description,
                    mp.periode_debut, mp.actif, mp.created_at,
                    rp.nom        AS libelle_projet,
                    ro.libelle    AS libelle_operation,
                    rf.libelle    AS libelle_sous_projet,
                    ra.libelle    AS libelle_activite
                FROM matrice_primes mp
                LEFT JOIN ref_structure_map rsm ON rsm.id = mp.id_structure
                LEFT JOIN ref_projets       rp  ON rp.id  = rsm.id_projet
                LEFT JOIN ref_operations    ro  ON ro.id  = rsm.id_operation
                LEFT JOIN ref_sous_projet         rf  ON rf.id  = rsm.id_sous_projet
                LEFT JOIN ref_activites     ra  ON ra.id  = rsm.id_activite
                ORDER BY mp.created_at DESC
            """
            cursor.execute(sql)
            rows = cursor.fetchall()
            regles = []
            for row in rows:
                regles.append({
                    "id": row["id"],
                    "code": row["code"],
                    "nom": row["libelle"],
                    "id_structure": row.get("id_structure"),
                    "periodicite": row["periodicite"],
                    "description": row["description"],
                    "periode_debut": str(row["periode_debut"]) if row["periode_debut"] else None,
                    "actif": bool(row["actif"]),
                    "created_at": str(row["created_at"]) if row["created_at"] else None,
                    "libelle_projet": row.get("libelle_projet"),
                    "libelle_operation": row.get("libelle_operation"),
                    "libelle_sous_projet": row.get("libelle_sous_projet"),
                    "libelle_activite": row.get("libelle_activite"),
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
    """
    import json
    nom               = data.get("nom", "Sans nom")
    id_structure      = data.get("id_structure") or None
    periodicite       = data.get("periodicite", "mensuelle")
    description       = data.get("description", "")
    grille_objectifs  = data.get("grille_objectifs")

    code          = f"REGLE_{uuid.uuid4().hex[:8].upper()}"
    periode_debut = datetime.now().strftime("%Y-%m-%d")

    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            # Le système utilise désormais id_structure (Cerveau) pour les jointures.
            sql = """
                INSERT INTO matrice_primes
                (code, libelle, id_structure, periodicite, description, periode_debut, grille_objectifs, actif)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 1)
            """
            grille_json = json.dumps(grille_objectifs) if grille_objectifs else None
            cursor.execute(sql, (code, nom, id_structure, periodicite, description, periode_debut, grille_json))
            connection.commit()
            return {"id": cursor.lastrowid, "code": code, "nom": nom, "status": "success"}
    except Exception as e:
        logger.error(f"Erreur lors de la création de la règle: {e}")
        raise e
    finally:
        if connection:
            connection.close()


def update_regle(regle_id: int, data: dict):
    """
    Met à jour les informations générales d'une règle.
    """
    nom          = data.get("nom")
    id_structure = data.get("id_structure") or None
    periodicite  = data.get("periodicite")
    description  = data.get("description")

    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            sql = """
                UPDATE matrice_primes
                SET libelle = %s, id_structure = %s, periodicite = %s, description = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """
            cursor.execute(sql, (nom, id_structure, periodicite, description, regle_id))
            connection.commit()
            return {"status": "success", "message": "Règle mise à jour"}
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour de la règle {regle_id}: {e}")
        raise e
    finally:
        if connection:
            connection.close()


def delete_regle(regle_id: int):
    """
    Supprime une règle de la base MySQL.
    """
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            # Note: Si des tables dépendent de cette règle, il faudrait gérer les suppressions en cascade ou contraintes.
            sql = "DELETE FROM matrice_primes WHERE id = %s"
            cursor.execute(sql, (regle_id,))
            connection.commit()
            return {"status": "success", "message": "Règle supprimée"}
    except Exception as e:
        logger.error(f"Erreur lors de la suppression de la règle {regle_id}: {e}")
        raise e
    finally:
        if connection:
            connection.close()
