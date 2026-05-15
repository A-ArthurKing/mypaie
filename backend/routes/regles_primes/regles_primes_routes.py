"""
Fichier : regles_primes_routes.py
Rôle    : Blueprint Flask exposant les endpoints REST pour les règles de primes.
          Gère la validation des paramètres et la gestion d'erreurs HTTP.
Module  : mypaie / backend / routes / regles_primes
"""

import logging
from flask import Blueprint, jsonify, request
from core.socket import emit_update
from services.regles_primes.dw_api_regles_provider import (
    create_regle, get_regles, get_regle_by_id, update_regle_grille,
    get_regle_configs, create_regle_config, set_active_config,
    update_regle, delete_regle, delete_grille
)

logger = logging.getLogger(__name__)

regles_primes_bp = Blueprint("regles_primes", __name__)

# --- GESTION DES VERSIONS DE GRILLES ---

@regles_primes_bp.route("/api/regles/<int:regle_id>/configs", methods=["GET"])
def endpoint_get_regle_configs(regle_id):
    try:
        return jsonify({"data": get_regle_configs(regle_id)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@regles_primes_bp.route("/api/regles/<int:regle_id>/configs", methods=["POST"])
def endpoint_post_regle_config(regle_id):
    try:
        data = request.json
        res = create_regle_config(
            regle_id, 
            data.get("libelle"), 
            data.get("content"), 
            data.get("activate", False),
            data.get("grille_uuid"),
            data.get("grille_nom")
        )
        emit_update("regle_configs_updated", {"regle_id": regle_id})
        return jsonify(res), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@regles_primes_bp.route("/api/regles/<int:regle_id>/configs/<int:config_id>/activate", methods=["POST"])
def endpoint_activate_config(regle_id, config_id):
    try:
        res = set_active_config(regle_id, config_id)
        emit_update("regle_configs_updated", {"regle_id": regle_id})
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@regles_primes_bp.route("/api/regles/<int:regle_id>/grilles/order", methods=["PATCH"])
def endpoint_update_grilles_order(regle_id):
    try:
        from services.regles_primes.dw_api_regles_provider import update_grilles_order
        data = request.json
        orders = data.get("orders", [])
        res = update_grilles_order(regle_id, orders)
        emit_update("regle_configs_updated", {"regle_id": regle_id})
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@regles_primes_bp.route("/api/regles/<int:regle_id>/grilles/<grille_uuid>", methods=["DELETE"])
def endpoint_delete_grille(regle_id, grille_uuid):
    try:
        res = delete_grille(regle_id, grille_uuid)
        emit_update("regle_configs_updated", {"regle_id": regle_id})
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@regles_primes_bp.route("/api/regles/<int:regle_id>", methods=["GET"])
def endpoint_get_regle(regle_id):
    """
    Retourne le détail d'une règle par son ID.
    """
    try:
        regle = get_regle_by_id(regle_id)
        if regle is None:
            return jsonify({"error": "Règle non trouvée."}), 404
        return jsonify(regle), 200
    except Exception as err:
        logger.error("Erreur endpoint GET /api/regles/%s : %s", regle_id, err)
        return jsonify({"error": "Erreur lors de la récupération de la règle."}), 500


@regles_primes_bp.route("/api/regles", methods=["GET"])
def endpoint_get_regles():
    """
    Retourne toutes les règles de primes depuis la base MySQL.
    """
    try:
        regles = get_regles()
        return jsonify(regles), 200
    except Exception as err:
        logger.error("Erreur endpoint GET /api/regles : %s", err)
        return jsonify({"error": "Erreur lors de la récupération des règles."}), 500


@regles_primes_bp.route("/api/regles/<int:regle_id>/grille", methods=["PATCH"])
def endpoint_update_regle_grille(regle_id):
    """
    Met à jour la matrice (grille JSON) des objectifs d'une règle.
    """
    try:
        data = request.json
        if not data or "grille_objectifs" not in data:
            return jsonify({"error": "Le champ grille_objectifs est requis."}), 400
        
        result = update_regle_grille(regle_id, data["grille_objectifs"])
        emit_update("regle_updated", {"regle_id": regle_id})
        return jsonify(result), 200
    except Exception as err:
        logger.error("Erreur endpoint PATCH /api/regles/%s/grille : %s", regle_id, err)
        return jsonify({"error": "Erreur lors de la mise à jour de la grille."}), 500

@regles_primes_bp.route("/api/regles/<int:regle_id>", methods=["PUT"])
def endpoint_update_regle(regle_id):
    """
    Met à jour les infos d'une règle (libellé, projet, etc.).
    """
    try:
        data = request.json
        if not data:
            return jsonify({"error": "Aucune donnée fournie."}), 400
        result = update_regle(regle_id, data)
        emit_update("regle_updated", {"regle_id": regle_id})
        return jsonify(result), 200
    except Exception as err:
        logger.error("Erreur endpoint PUT /api/regles/%s : %s", regle_id, err)
        return jsonify({"error": "Erreur lors de la mise à jour de la règle."}), 500


@regles_primes_bp.route("/api/regles/<int:regle_id>", methods=["DELETE"])
def endpoint_delete_regle(regle_id):
    """
    Supprime une règle.
    """
    try:
        result = delete_regle(regle_id)
        emit_update("regle_deleted", {"regle_id": regle_id})
        return jsonify(result), 200
    except Exception as err:
        logger.error("Erreur endpoint DELETE /api/regles/%s : %s", regle_id, err)
        return jsonify({"error": "Erreur lors de la suppression de la règle."}), 500


@regles_primes_bp.route("/api/regles", methods=["POST"])
def endpoint_create_regle():
    """
    Crée une nouvelle règle de prime dans la base MySQL.
    """
    try:
        data = request.json
        if not data:
            return jsonify({"error": "Aucune donnée fournie."}), 400
        result = create_regle(data)
        emit_update("regle_created")
        return jsonify(result), 201
    except Exception as err:
        logger.error("Erreur endpoint POST /api/regles : %s", err)
        return jsonify({"error": "Erreur lors de la création de la règle."}), 500
