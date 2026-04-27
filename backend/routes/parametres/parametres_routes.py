"""
Fichier : parametres_routes.py
Rôle    : Blueprint Flask pour l'administration des paramètres (comme le mapping des projets).
Module  : mypaie / backend / routes / parametres
"""

import logging
from flask import Blueprint, jsonify, request
from services.parametres.mapping_provider import get_mappings, add_mapping, delete_mapping

logger = logging.getLogger(__name__)

parametres_bp = Blueprint("parametres", __name__)

@parametres_bp.route("/api/parametres/mapping-projets", methods=["GET"])
def endpoint_get_mappings():
    """Liste tous les mappings de projets."""
    try:
        return jsonify({"data": get_mappings()}), 200
    except Exception as e:
        logger.error("Erreur GET mappings: %s", e)
        return jsonify({"error": "Erreur lors de la récupération des mappings"}), 500

@parametres_bp.route("/api/parametres/mapping-projets", methods=["POST"])
def endpoint_post_mapping():
    """Ajoute ou met à jour un mapping de projet."""
    data = request.json or {}
    source_name = data.get("source_name")
    standard_name = data.get("standard_name")
    
    if not source_name or not standard_name:
        return jsonify({"error": "Les champs source_name et standard_name sont requis"}), 400
        
    try:
        result = add_mapping(source_name, standard_name)
        return jsonify(result), 201
    except Exception as e:
        logger.error("Erreur POST mapping: %s", e)
        return jsonify({"error": "Erreur lors de l'enregistrement du mapping"}), 500

@parametres_bp.route("/api/parametres/mapping-projets/<path:source_name>", methods=["DELETE"])
def endpoint_delete_mapping(source_name):
    """Supprime un mapping."""
    try:
        result = delete_mapping(source_name)
        return jsonify(result), 200
    except Exception as e:
        logger.error("Erreur DELETE mapping: %s", e)
        return jsonify({"error": "Erreur lors de la suppression du mapping"}), 500
