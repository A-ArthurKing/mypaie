"""
Fichier : parametres_routes.py
Rôle    : Blueprint Flask pour l'administration des paramètres (comme le mapping des projets).
Module  : mypaie / backend / routes / parametres
"""

import logging
from flask import Blueprint, jsonify, request
from services.parametres.mapping_provider import (
    get_mappings, add_mapping, delete_mapping,
    get_kpi_mappings, add_kpi_mapping, delete_kpi_mapping
)
from services.parametres.reference_provider import get_all_references

logger = logging.getLogger(__name__)

parametres_bp = Blueprint("parametres", __name__)

@parametres_bp.route("/api/parametres/references", methods=["GET"])
def endpoint_get_references():
    """Retourne les référentiels (opérations, files, activités, statuts)."""
    try:
        return jsonify(get_all_references()), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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


# --- ROUTES POUR LE MAPPING DES KPIS ---

@parametres_bp.route("/api/parametres/mapping-kpis", methods=["GET"])
def endpoint_get_kpi_mappings():
    """Liste tous les mappings de KPIs."""
    try:
        return jsonify({"data": get_kpi_mappings()}), 200
    except Exception as e:
        logger.error("Erreur GET kpi mappings: %s", e)
        return jsonify({"error": "Erreur lors de la récupération des mappings KPI"}), 500

@parametres_bp.route("/api/parametres/mapping-kpis", methods=["POST"])
def endpoint_post_kpi_mapping():
    """Ajoute ou met à jour un mapping de KPI."""
    data = request.json or {}
    source_name = data.get("source_name")
    standard_name = data.get("standard_name")
    description = data.get("description")
    
    if not source_name or not standard_name:
        return jsonify({"error": "Les champs source_name et standard_name sont requis"}), 400
        
    try:
        result = add_kpi_mapping(source_name, standard_name, description)
        return jsonify(result), 201
    except Exception as e:
        logger.error("Erreur POST kpi mapping: %s", e)
        return jsonify({"error": "Erreur lors de l'enregistrement du mapping KPI"}), 500

@parametres_bp.route("/api/parametres/mapping-kpis/<path:source_name>", methods=["DELETE"])
def endpoint_delete_kpi_mapping(source_name):
    """Supprime un mapping de KPI."""
    try:
        result = delete_kpi_mapping(source_name)
        return jsonify(result), 200
    except Exception as e:
        logger.error("Erreur DELETE kpi mapping: %s", e)
        return jsonify({"error": "Erreur lors de la suppression du mapping KPI"}), 500
