import os
import json
from decimal import Decimal
import jwt
from flask import Blueprint, request, jsonify
from config.db_mysql_connector import get_mysql_connection

collaborateur_bp = Blueprint('collaborateur', __name__)

JWT_SECRET = os.getenv('JWT_SECRET', 'super_secret_dev_key_mypaie_2026')


def _to_serializable(obj):
    """Convertit récursivement les Decimal en float pour la sérialisation JSON."""
    if isinstance(obj, dict):
        return {k: _to_serializable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_serializable(v) for v in obj]
    if isinstance(obj, Decimal):
        return float(obj)
    return obj


def _get_current_collaborateur(request):
    """Decode JWT and return payload if role=Collaborateur, else None."""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        if payload.get('role') != 'Collaborateur':
            return None
        return payload
    except jwt.InvalidTokenError:
        return None


@collaborateur_bp.route('/api/collaborateur/ma-grille', methods=['GET'])
def ma_grille():
    """
    Retourne la règle de prime active associée à la structure de l'agent connecté,
    ainsi que sa config (paliers + configs actives).
    """
    collab = _get_current_collaborateur(request)
    if not collab:
        return jsonify({"error": "Non autorisé"}), 401

    matricule = collab.get('matricule')
    id_structure = collab.get('id_structure')

    if not id_structure:
        return jsonify({"grille": None, "message": "Aucune structure associée à ce collaborateur"})

    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            # 1. Trouver la règle active pour cette structure
            cur.execute(
                """SELECT id, code, libelle, description, description_kpi,
                          periodicite, grille_objectifs, periode_debut, periode_fin
                   FROM matrice_primes
                   WHERE id_structure = %s AND actif = 1
                   ORDER BY periode_debut DESC
                   LIMIT 1""",
                (id_structure,)
            )
            regle = cur.fetchone()

            if not regle:
                return jsonify({
                    "grille": None,
                    "message": "Aucune règle de prime active pour votre structure"
                })

            # 2. Récupérer la config active de cette règle
            cur.execute(
                """SELECT mpc.id, mpc.libelle, mpc.grille_nom, mpc.content,
                          mpc.est_active, mpc.grille_ordre
                   FROM matrice_primes_configs mpc
                   WHERE mpc.matrice_id = %s AND mpc.est_active = 1
                   ORDER BY mpc.grille_ordre ASC
                   LIMIT 1""",
                (regle['id'],)
            )
            config_active = cur.fetchone()

            # 3. Données du collaborateur
            cur.execute(
                """SELECT re.matricule, re.nom, re.prenom, re.prime_langue, re.statut
                   FROM ref_employes re
                   WHERE re.matricule = %s
                   LIMIT 1""",
                (matricule,)
            )
            agent_info = cur.fetchone()

            grille_objectifs = regle.get('grille_objectifs')
            if grille_objectifs and isinstance(grille_objectifs, str):
                try:
                    grille_objectifs = json.loads(grille_objectifs)
                except Exception:
                    grille_objectifs = None

            # Désérialiser le content JSON de la config active
            config_content = None
            if config_active:
                raw_content = config_active.get('content')
                if raw_content and isinstance(raw_content, str):
                    try:
                        config_content = json.loads(raw_content)
                    except Exception:
                        config_content = None
                elif isinstance(raw_content, dict):
                    config_content = raw_content

            agent_serializable = _to_serializable(agent_info or {})

            return jsonify({
                "agent": agent_serializable,
                "regle": {
                    "id": regle['id'],
                    "code": regle['code'],
                    "libelle": regle['libelle'],
                    "description": regle['description'],
                    "description_kpi": regle['description_kpi'],
                    "periodicite": regle['periodicite'],
                    "periode_debut": str(regle['periode_debut']) if regle['periode_debut'] else None,
                    "periode_fin": str(regle['periode_fin']) if regle['periode_fin'] else None,
                    "grille_objectifs": grille_objectifs,
                    "config": {
                        "id": config_active['id'] if config_active else None,
                        "libelle": config_active['libelle'] if config_active else None,
                        "grille_nom": config_active['grille_nom'] if config_active else None,
                        "content": config_content
                    } if config_active else None
                }
            })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()
