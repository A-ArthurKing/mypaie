"""
Fichier : notes_qualite_routes.py
Rôle    : Blueprint Flask exposant les endpoints REST pour les notes qualité.
          Gère la validation des paramètres et la gestion d'erreurs HTTP.
Module  : mypaie / backend / routes / notes_qualite
"""

import logging
from flask import Blueprint, jsonify, request
from modules.notes_qualite.services.dw_api_qualite_provider import (
    get_qualite_agents,
    get_qualite_stats_projets,
    get_qualite_stats_global,
    get_qualite_totaux_par_matricule,
)

logger = logging.getLogger(__name__)

notes_qualite_bp = Blueprint("notes_qualite", __name__)


@notes_qualite_bp.route("/api/qualite", methods=["GET"])
def endpoint_qualite():
    """
    Retourne les notes qualité des agents avec pagination et filtres.
    Paramètres query : date_debut, date_fin, agent, projet, limit, offset
    """
    date_debut = request.args.get("date_debut")
    date_fin   = request.args.get("date_fin")
    agent      = request.args.get("agent")
    projet     = request.args.get("projet")

    try:
        limit  = min(int(request.args.get("limit", 500)), 1000)
        offset = max(int(request.args.get("offset", 0)), 0)
    except ValueError:
        return jsonify({"error": "Les paramètres limit et offset doivent être des entiers."}), 400

    try:
        result = get_qualite_agents(
            date_debut=date_debut,
            date_fin=date_fin,
            agent=agent,
            projet=projet,
            limit=limit,
            offset=offset,
        )
        return jsonify(result), 200
    except Exception as err:
        logger.error("Erreur endpoint /api/qualite : %s", err)
        return jsonify({"error": "Erreur serveur lors de la récupération des données qualité."}), 500


@notes_qualite_bp.route("/api/qualite/totaux", methods=["GET"])
def endpoint_qualite_totaux():
    """
    Retourne la moyenne des notes qualité agrégée par matricule.
    Paramètres query :
      - date_debut, date_fin
      - matricules  : CSV de matricules
      - agents_map  : JSON optionnel { nom_normalise: matricule } pour fallback
                      quand matricule IS NULL dans paie_qualite
    """
    import json as _json
    date_debut = request.args.get("date_debut")
    date_fin   = request.args.get("date_fin")
    matricules_raw = request.args.get("matricules", "")
    matricules = [m.strip() for m in matricules_raw.split(",") if m.strip()]

    # Mapping optionnel nom_agent_normalisé → matricule (fallback si matricule IS NULL en BQ)
    nom_matricule_map = {}
    agents_map_raw = request.args.get("agents_map", "")
    if agents_map_raw:
        try:
            nom_matricule_map = _json.loads(agents_map_raw)
        except (ValueError, TypeError):
            logger.warning("agents_map JSON invalide — fallback par nom désactivé.")

    if not matricules and not nom_matricule_map:
        return jsonify({"error": "Le paramètre 'matricules' est requis."}), 400

    try:
        result = get_qualite_totaux_par_matricule(date_debut, date_fin, matricules, nom_matricule_map)
        return jsonify({"data": result}), 200
    except Exception as err:
        logger.error("Erreur endpoint /api/qualite/totaux : %s", err)
        return jsonify({"error": "Erreur serveur lors du calcul des totaux qualité."}), 500


@notes_qualite_bp.route("/api/qualite/projets", methods=["GET"])
def endpoint_qualite_projets():
    """
    Retourne les statistiques agrégées par projet pour la qualité.
    """
    date_debut = request.args.get("date_debut")
    date_fin   = request.args.get("date_fin")

    try:
        stats = get_qualite_stats_projets(date_debut=date_debut, date_fin=date_fin)
        return jsonify({"data": stats}), 200
    except Exception as err:
        logger.error("Erreur endpoint /api/qualite/projets : %s", err)
        return jsonify({"error": "Erreur serveur lors de la récupération des stats projets."}), 500


@notes_qualite_bp.route("/api/qualite/stats/global", methods=["GET"])
def endpoint_qualite_stats_global():
    """
    Retourne les statistiques globales (typologies et sous-typologies).
    """
    date_debut = request.args.get("date_debut")
    date_fin   = request.args.get("date_fin")

    try:
        stats = get_qualite_stats_global(date_debut=date_debut, date_fin=date_fin)
        return jsonify(stats), 200
    except Exception as err:
        logger.error("Erreur endpoint /api/qualite/stats/global : %s", err)
        return jsonify({"error": "Erreur serveur lors de la récupération des stats globales."}), 500
