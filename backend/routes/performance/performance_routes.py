"""
Fichier : performance_routes.py
Rôle    : Blueprint Flask exposant les endpoints REST pour les données de performance.
          Gère la validation des paramètres et la gestion d'erreurs HTTP.
Module  : mypaie / backend / routes / performance
"""

import logging
from flask import Blueprint, jsonify, request
from services.performance.dw_api_performance_provider import get_performance_pvcp

logger = logging.getLogger(__name__)

performance_bp = Blueprint("performance", __name__)


@performance_bp.route("/api/performance/pvcp", methods=["GET"])
def endpoint_performance_pvcp():
    """
    Retourne les données de performance consolidées.
    Paramètres query : date_debut, date_fin, agent, granularity, limit, offset
    """
    date_debut  = request.args.get("date_debut")
    date_fin    = request.args.get("date_fin")
    agent       = request.args.get("agent")
    granularity = request.args.get("granularity", "total")

    try:
        limit  = min(int(request.args.get("limit", 500)), 1000)
        offset = max(int(request.args.get("offset", 0)), 0)
    except ValueError:
        return jsonify({"error": "Les paramètres limit et offset doivent être des entiers."}), 400

    try:
        result = get_performance_pvcp(
            date_debut=date_debut,
            date_fin=date_fin,
            agent=agent,
            granularity=granularity,
            limit=limit,
            offset=offset,
        )
        return jsonify(result), 200
    except Exception as err:
        logger.error("Erreur endpoint /api/performance/pvcp : %s", err)
        return jsonify({"error": "Erreur serveur lors de la récupération des données performance."}), 500
