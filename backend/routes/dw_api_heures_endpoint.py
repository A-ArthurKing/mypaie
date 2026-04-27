"""
Fichier : dw_api_heures_endpoint.py
Rôle    : Serveur Flask exposant les endpoints REST pour les heures agents.
          Gère le CORS, la validation des paramètres et la gestion d'erreurs HTTP.
Dépend  : dw_api_heures_provider, Flask, flask-cors, python-dotenv
Module  : mypaie / backend
"""

# #region IMPORTS
import logging
import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from services.dw_api_heures_provider import get_heures_agents, get_equipes_distinctes, get_projets_distincts
from services.dw_api_qualite_provider import get_qualite_agents, get_qualite_stats_projets, get_qualite_stats_global
from services.dw_api_performance_provider import get_performance_pvcp
# #endregion

# #region CONFIGURATION
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Autorisation CORS uniquement depuis l'origine frontend déclarée dans .env
cors_origin = os.getenv("CORS_ORIGIN", "http://localhost:5569")
CORS(app, resources={r"/api/*": {"origins": cors_origin}})

FLASK_PORT = int(os.getenv("FLASK_PORT", 5000))
# #endregion


# #region ENDPOINTS
@app.route("/api/heures", methods=["GET"])
def endpoint_heures():
    """
    Retourne les heures des agents avec pagination et filtres optionnels.
    Paramètres query : date_debut, date_fin, matricule, equipe, limit, offset
    """
    # Lecture et validation des paramètres de filtrage
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


@app.route("/api/heures/equipes", methods=["GET"])
def endpoint_equipes():
    """Retourne la liste des équipes distinctes pour le filtre dropdown."""
    try:
        equipes = get_equipes_distinctes()
        return jsonify({"data": equipes}), 200
    except Exception as err:
        logger.error("Erreur endpoint /api/heures/equipes : %s", err)
        return jsonify({"error": "Erreur serveur lors de la récupération des équipes."}), 500


@app.route("/api/heures/projets", methods=["GET"])
def endpoint_projets():
    """Retourne la liste des projets distincts pour le filtre dropdown."""
    try:
        projets = get_projets_distincts()
        return jsonify({"data": projets}), 200
    except Exception as err:
        logger.error("Erreur endpoint /api/heures/projets : %s", err)
        return jsonify({"error": "Erreur serveur lors de la récupération des projets."}), 500


@app.route("/api/qualite", methods=["GET"])
def endpoint_qualite():
    """
    Retourne les notes qualité des agents avec pagination et filtres.
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

@app.route("/api/qualite/projets", methods=["GET"])
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


@app.route("/api/qualite/stats/global", methods=["GET"])
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


# #region PERFORMANCE
@app.route("/api/performance/pvcp", methods=["GET"])
def endpoint_performance_pvcp():
    """
    Retourne les données de performance consolidées.
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
            offset=offset
        )
        return jsonify(result), 200
    except Exception as err:
        logger.error("Erreur endpoint /api/performance/pvcp : %s", err)
        return jsonify({"error": "Erreur serveur lors de la récupération des données performance."}), 500
# #endregion


@app.route("/api/health", methods=["GET"])
def endpoint_health():
    """Endpoint de santé pour vérifier que le serveur Flask est actif."""
    return jsonify({"status": "ok"}), 200
# #endregion
