"""
Fichier : heures_agents_routes.py
Rôle    : Blueprint Flask exposant les endpoints REST pour les heures agents.
          Gère la validation des paramètres et la gestion d'erreurs HTTP.
Module  : mypaie / backend / routes / heures_agents
"""

import logging
from flask import Blueprint, jsonify, request
from modules.heures_agents.services.dw_api_heures_provider import (
    get_heures_agents,
    get_equipes_distinctes,
    get_projets_distincts,
    get_totaux_par_matricule,
)

logger = logging.getLogger(__name__)

heures_agents_bp = Blueprint("heures_agents", __name__)


@heures_agents_bp.route("/api/heures", methods=["GET"])
def endpoint_heures():
    """
    Retourne les heures des agents avec pagination et filtres optionnels.
    Paramètres query : date_debut, date_fin, matricule, equipe, projet, limit, offset
    """
    date_debut = request.args.get("date_debut")
    date_fin   = request.args.get("date_fin")
    matricule  = request.args.get("matricule")
    equipe     = request.args.get("equipe")
    projet     = request.args.get("projet")

    try:
        limit  = min(int(request.args.get("limit", 500)), 1000)
        offset = max(int(request.args.get("offset", 0)), 0)
    except ValueError:
        return jsonify({"error": "Les paramètres limit et offset doivent être des entiers."}), 400

    try:
        result = get_heures_agents(
            date_debut=date_debut,
            date_fin=date_fin,
            matricule=matricule,
            equipe=equipe,
            projet=projet,
            limit=limit,
            offset=offset,
        )
        return jsonify(result), 200
    except Exception as err:
        logger.error("Erreur endpoint /api/heures : %s", err)
        return jsonify({"error": "Erreur serveur lors de la récupération des données."}), 500


@heures_agents_bp.route("/api/heures/equipes", methods=["GET"])
def endpoint_equipes():
    """Retourne la liste des équipes distinctes pour le filtre dropdown."""
    try:
        equipes = get_equipes_distinctes()
        return jsonify({"data": equipes}), 200
    except Exception as err:
        logger.error("Erreur endpoint /api/heures/equipes : %s", err)
        return jsonify({"error": "Erreur serveur lors de la récupération des équipes."}), 500


@heures_agents_bp.route("/api/heures/projets", methods=["GET"])
def endpoint_projets():
    """Retourne la liste des projets distincts pour le filtre dropdown."""
    try:
        projets = get_projets_distincts()
        return jsonify({"data": projets}), 200
    except Exception as err:
        logger.error("Erreur endpoint /api/heures/projets : %s", err)
        return jsonify({"error": "Erreur serveur lors de la récupération des projets."}), 500


@heures_agents_bp.route("/api/heures/totaux", methods=["GET"])
def endpoint_totaux():
    """
    Retourne le détail des heures (hp, ht, hf, hc, total) agrégé par matricule.
    Paramètres query : date_debut, date_fin, matricules (CSV : '10773,11056,9410')
    Réponse : { "data": { "10773": { "hp": 100, "ht": 200, ... }, ... } }
    """
    date_debut  = request.args.get("date_debut")
    date_fin    = request.args.get("date_fin")
    matricules_raw = request.args.get("matricules", "")
    matricules = [m.strip() for m in matricules_raw.split(",") if m.strip()]

    if not matricules:
        return jsonify({"error": "Le paramètre 'matricules' est requis (CSV)."}), 400

    try:
        result = get_totaux_par_matricule(date_debut, date_fin, matricules)
        return jsonify({"data": result}), 200
    except Exception as err:
        logger.error("Erreur endpoint /api/heures/totaux : %s", err)
        return jsonify({"error": "Erreur serveur lors du calcul des totaux."}), 500
