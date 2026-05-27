"""
Fichier : assiduite_provider.py
Role    : Service CRUD pour assiduite_mensuelle + audit trail complet.
          - Lecture mensuelle des donnees d assiduite de tous les agents actifs
          - Upsert avec tracabilite (historique + qui a modifie)
          - Gestion des justificatifs (upload fichier + DB)
          - Creation automatique a l ajout d un agent
Module  : mypaie / backend / modules / agents / services
"""

import logging
import os
import uuid
from datetime import datetime
from config.db_mysql_connector import get_mysql_connection
from tools.cache import get_cached, set_cached, invalidate

logger = logging.getLogger(__name__)

# Configuration upload
_SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR    = os.path.normpath(os.path.join(_SERVICES_DIR, '..', '..', '..', 'uploads', 'justificatifs'))

ALLOWED_MIME_TYPES = {
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 Mo

# Cache
_CACHE_PREFIX = "assiduite:"
_CACHE_TTL    = 120  # 2 minutes


def _cache_key(mois: str) -> str:
    return f"{_CACHE_PREFIX}{mois}"


# Lecture mensuelle

def get_assiduite_pour_mois(mois: str) -> list:
    cached = get_cached(_cache_key(mois))
    if cached is not None:
        return cached
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            sql = """
                SELECT
                    e.matricule, e.nom, e.prenom,
                    p.nom            AS projet,
                    o.libelle        AS operation,
                    COALESCE(am.abs_injustifie,   0) AS abs_injustifie,
                    COALESCE(am.retard,           0) AS retard,
                    COALESCE(am.abs_justifie,     0) AS abs_justifie,
                    COALESCE(am.cp_css,           0) AS cp_css,
                    COALESCE(am.jours_ouvres,    22) AS jours_ouvres,
                    COALESCE(am.jours_travailles, 0) AS jours_travailles,
                    COALESCE(am.is_overridden,    0) AS is_overridden,
                    am.synced_at                     AS synced_at,
                    am.updated_at                    AS derniere_maj
                FROM ref_employes e
                LEFT JOIN ref_structure_map m ON e.id_structure = m.id
                LEFT JOIN ref_projets       p ON m.id_projet    = p.id
                LEFT JOIN ref_operations    o ON m.id_operation = o.id
                LEFT JOIN assiduite_mensuelle am
                    ON am.matricule = e.matricule AND am.mois = %s
                WHERE e.actif = 1
                ORDER BY e.nom, e.prenom
            """
            cursor.execute(sql, (mois,))
            result = cursor.fetchall()
        set_cached(_cache_key(mois), result, _CACHE_TTL)
        return result
    except Exception as e:
        logger.error("Erreur get_assiduite_pour_mois [%s] : %s", mois, e)
        return []
    finally:
        if connection:
            connection.close()


# Upsert + tracabilite

def upsert_assiduite(matricule: str, mois: str, data: dict,
                     modifie_par: str = 'Systeme', modifie_par_id=None) -> dict:
    abs_injustifie = max(0, int(data.get('abs_injustifie', 0)))
    retard         = max(0, int(data.get('retard',         0)))
    abs_justifie   = max(0, int(data.get('abs_justifie',   0)))
    cp_css         = max(0, int(data.get('cp_css',         0)))
    jours_ouvres   = max(1, int(data.get('jours_ouvres',  22)))
    commentaire    = (data.get('commentaire') or '').strip() or None
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO assiduite_mensuelle
                    (matricule, mois, abs_injustifie, retard, abs_justifie,
                     cp_css, jours_ouvres, is_overridden)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 1)
                ON DUPLICATE KEY UPDATE
                    abs_injustifie = VALUES(abs_injustifie),
                    retard         = VALUES(retard),
                    abs_justifie   = VALUES(abs_justifie),
                    cp_css         = VALUES(cp_css),
                    jours_ouvres   = VALUES(jours_ouvres),
                    is_overridden  = 1,
                    updated_at     = CURRENT_TIMESTAMP
            """, (matricule, mois, abs_injustifie, retard, abs_justifie, cp_css, jours_ouvres))
            cursor.execute("""
                INSERT INTO assiduite_historique
                    (matricule, mois, abs_injustifie, retard, abs_justifie, cp_css,
                     jours_ouvres, commentaire, modifie_par, modifie_par_id, source)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'MANUEL')
            """, (matricule, mois, abs_injustifie, retard, abs_justifie, cp_css,
                  jours_ouvres, commentaire, modifie_par, modifie_par_id))
            historique_id = cursor.lastrowid
            connection.commit()
        invalidate(_cache_key(mois))
        return {
            "matricule":      matricule,
            "mois":           mois,
            "abs_injustifie": abs_injustifie,
            "retard":         retard,
            "abs_justifie":   abs_justifie,
            "cp_css":         cp_css,
            "jours_ouvres":   jours_ouvres,
            "is_overridden":  1,
            "historique_id":  historique_id,
        }
    except Exception as e:
        logger.error("Erreur upsert_assiduite [%s/%s] : %s", matricule, mois, e)
        raise e
    finally:
        if connection:
            connection.close()


# Historique

def _serialize_dt(val):
    if val is None:
        return None
    if hasattr(val, 'isoformat'):
        return val.isoformat()
    return str(val)


def get_historique_assiduite(matricule: str, mois: str) -> list:
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id, mois, abs_injustifie, retard, abs_justifie, cp_css,
                       jours_ouvres, commentaire, modifie_par, modifie_par_id, created_at
                FROM assiduite_historique
                WHERE matricule = %s AND mois = %s
                ORDER BY created_at DESC
            """, (matricule, mois))
            entries = cursor.fetchall()
            if not entries:
                return []
            ids = [e['id'] for e in entries]
            fmt = ','.join(['%s'] * len(ids))
            cursor.execute(f"""
                SELECT id, historique_id, nom_original, type_mime, taille_octets, uploaded_at
                FROM assiduite_justificatifs
                WHERE historique_id IN ({fmt})
                ORDER BY uploaded_at ASC
            """, tuple(ids))
            justifs_rows = cursor.fetchall()
        justifs_map = {}
        for j in justifs_rows:
            hid = j['historique_id']
            justifs_map.setdefault(hid, []).append({
                'id':            j['id'],
                'nom_original':  j['nom_original'],
                'type_mime':     j['type_mime'],
                'taille_octets': j['taille_octets'],
                'uploaded_at':   _serialize_dt(j['uploaded_at']),
            })
        return [
            {
                'id':             e['id'],
                'mois':           e['mois'],
                'abs_injustifie': e['abs_injustifie'],
                'retard':         e['retard'],
                'abs_justifie':   e['abs_justifie'],
                'cp_css':         e['cp_css'],
                'jours_ouvres':   e['jours_ouvres'],
                'commentaire':    e['commentaire'],
                'modifie_par':    e['modifie_par'],
                'created_at':     _serialize_dt(e['created_at']),
                'justificatifs':  justifs_map.get(e['id'], []),
            }
            for e in entries
        ]
    except Exception as e:
        logger.error("Erreur get_historique_assiduite [%s/%s] : %s", matricule, mois, e)
        return []
    finally:
        if connection:
            connection.close()


# Justificatifs

def upload_justificatif(historique_id: int, matricule: str, mois: str,
                        file_bytes: bytes, original_name: str, mime_type: str) -> dict:
    if len(file_bytes) > MAX_FILE_SIZE:
        raise ValueError("Fichier trop volumineux. Maximum autorise : 10 Mo.")
    if mime_type not in ALLOWED_MIME_TYPES:
        raise ValueError(
            f"Type de fichier non autorise : {mime_type}. "
            "Formats acceptes : PDF, JPEG, PNG, DOC, DOCX, XLS, XLSX."
        )
    ext          = os.path.splitext(original_name)[1].lower()
    nom_stockage = f"{uuid.uuid4().hex}{ext}"
    storage_dir  = os.path.join(UPLOAD_DIR, matricule, mois)
    os.makedirs(storage_dir, exist_ok=True)
    file_path = os.path.join(storage_dir, nom_stockage)
    with open(file_path, 'wb') as fh:
        fh.write(file_bytes)
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO assiduite_justificatifs
                    (historique_id, matricule, mois, nom_original, nom_stockage, type_mime, taille_octets)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (historique_id, matricule, mois, original_name, nom_stockage,
                  mime_type, len(file_bytes)))
            connection.commit()
            justif_id = cursor.lastrowid
        return {
            'id':            justif_id,
            'nom_original':  original_name,
            'type_mime':     mime_type,
            'taille_octets': len(file_bytes),
            'uploaded_at':   datetime.now().isoformat(),
        }
    except Exception as e:
        try:
            os.remove(file_path)
        except OSError:
            pass
        logger.error("Erreur upload_justificatif [%s/%s] : %s", matricule, mois, e)
        raise e
    finally:
        if connection:
            connection.close()


def get_justificatif_info(justif_id: int):
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id, nom_original, nom_stockage, matricule, mois, type_mime
                FROM assiduite_justificatifs WHERE id = %s
            """, (justif_id,))
            row = cursor.fetchone()
        if not row:
            return None
        return {
            'id':           row['id'],
            'nom_original': row['nom_original'],
            'nom_stockage': row['nom_stockage'],
            'type_mime':    row['type_mime'],
            'file_path':    os.path.join(UPLOAD_DIR, row['matricule'], row['mois'], row['nom_stockage']),
        }
    except Exception as e:
        logger.error("Erreur get_justificatif_info [%s] : %s", justif_id, e)
        return None
    finally:
        if connection:
            connection.close()


def delete_justificatif(justif_id: int) -> None:
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT nom_stockage, matricule, mois
                FROM assiduite_justificatifs WHERE id = %s
            """, (justif_id,))
            row = cursor.fetchone()
            if not row:
                raise ValueError(f"Justificatif {justif_id} introuvable.")
            file_path = os.path.join(UPLOAD_DIR, row['matricule'], row['mois'], row['nom_stockage'])
            cursor.execute("DELETE FROM assiduite_justificatifs WHERE id = %s", (justif_id,))
            connection.commit()
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except OSError as fe:
            logger.warning("Impossible de supprimer le fichier [%s] : %s", file_path, fe)
    except Exception as e:
        logger.error("Erreur delete_justificatif [%s] : %s", justif_id, e)
        raise e
    finally:
        if connection:
            connection.close()


# Auto-creation a l ajout d agent

def auto_create_assiduite_for_agent(matricule: str):
    mois = datetime.now().strftime("%Y-%m")
    connection = None
    try:
        connection = get_mysql_connection()
        with connection.cursor() as cursor:
            cursor.execute(
                "INSERT IGNORE INTO assiduite_mensuelle (matricule, mois) VALUES (%s, %s)",
                (matricule, mois)
            )
            connection.commit()
        invalidate(_cache_key(mois))
    except Exception as e:
        logger.warning("auto_create_assiduite_for_agent [%s] : %s", matricule, e)
    finally:
        if connection:
            connection.close()
