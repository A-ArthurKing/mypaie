"""
Fichier : regles_primes_routes.py
Rôle    : Blueprint Flask exposant les endpoints REST pour les règles de primes.
          Gère la validation des paramètres et la gestion d'erreurs HTTP.
Module  : mypaie / backend / routes / regles_primes
"""

import logging
from flask import Blueprint, jsonify, request
from services.regles_primes.dw_api_regles_provider import create_regle, get_regles, get_regle_by_id

logger = logging.getLogger(__name__)

regles_primes_bp = Blueprint("regles_primes", __name__)


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
        return jsonify(result), 201
    except Exception as err:
        logger.error("Erreur endpoint POST /api/regles : %s", err)
        return jsonify({"error": "Erreur lors de la création de la règle."}), 500
