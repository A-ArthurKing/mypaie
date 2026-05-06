"""
Fichier : parametres_routes.py
Rôle    : Blueprint Flask pour l'administration des paramètres (comme le mapping des projets).
Module  : mypaie / backend / routes / parametres
"""

import logging
from flask import Blueprint, jsonify, request
from services.parametres.mapping_provider import (
    get_mappings, add_mapping, delete_mapping,
    get_kpi_mappings, add_kpi_mapping, delete_kpi_mapping,
    get_mysql_kpi_mappings, add_mysql_kpi_mapping, delete_mysql_kpi_mapping,
    get_mysql_project_mappings, add_mysql_project_mapping, delete_mysql_project_mapping
)
from services.parametres.reference_provider import get_all_references
from services.parametres.dw_api_introspection_provider import list_bigquery_tables, list_table_columns, get_unique_column_values
from tools.socket_io import emit_update

logger = logging.getLogger(__name__)

parametres_bp = Blueprint("parametres", __name__)

# --- INTROSPECTION BIGQUERY ---

@parametres_bp.route("/api/parametres/introspection/tables", methods=["GET"])
def endpoint_list_tables():
    """Liste les tables/vues BigQuery."""
    return jsonify({"data": list_bigquery_tables()}), 200

@parametres_bp.route("/api/parametres/introspection/columns", methods=["GET"])
def endpoint_list_columns():
    """Liste les colonnes d'une table BigQuery."""
    table_id = request.args.get("table")
    if not table_id:
        return jsonify({"error": "Paramètre 'table' requis"}), 400
    return jsonify({"data": list_table_columns(table_id)}), 200


@parametres_bp.route("/api/parametres/introspection/unique-values", methods=["GET"])
def endpoint_unique_values():
    """Récupère les valeurs uniques d'une colonne."""
    table_id = request.args.get("table")
    column_name = request.args.get("column")
    if not table_id or not column_name:
        return jsonify({"error": "Paramètres 'table' et 'column' requis"}), 400
    return jsonify({"data": get_unique_column_values(table_id, column_name)}), 200


@parametres_bp.route("/api/parametres/references", methods=["GET"])
def endpoint_get_references():
    """Retourne les référentiels (opérations, files, activités, statuts)."""
    try:
        return jsonify(get_all_references()), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/mapping-projets", methods=["GET"])
def endpoint_get_mappings():
    """Liste tous les mappings de projets (MySQL)."""
    try:
        return jsonify({"data": get_mysql_project_mappings()}), 200
    except Exception as e:
        logger.error("Erreur GET mappings: %s", e)
        return jsonify({"error": "Erreur lors de la récupération des mappings"}), 500

@parametres_bp.route("/api/parametres/mapping-projets", methods=["POST"])
def endpoint_post_mapping():
    """Ajoute ou met à jour un mapping de projet (MySQL)."""
    data = request.json or {}
    source_name = data.get("source_name")
    id_projet = data.get("id_projet")
    description = data.get("description")
    
    if not source_name or not id_projet:
        return jsonify({"error": "Les champs source_name et id_projet sont requis"}), 400
        
    try:
        result = add_mysql_project_mapping(source_name, int(id_projet), description)
        emit_update("mapping_projets_updated")
        return jsonify(result), 201
    except Exception as e:
        logger.error("Erreur POST mapping: %s", e)
        return jsonify({"error": "Erreur lors de l'enregistrement du mapping"}), 500

@parametres_bp.route("/api/parametres/mapping-projets/<int:mapping_id>", methods=["DELETE"])
def endpoint_delete_mapping(mapping_id):
    """Supprime un mapping (MySQL)."""
    try:
        result = delete_mysql_project_mapping(mapping_id)
        emit_update("mapping_projets_updated")
        return jsonify(result), 200
    except Exception as e:
        logger.error("Erreur DELETE mapping: %s", e)
        return jsonify({"error": "Erreur lors de la suppression du mapping"}), 500


# --- ROUTES POUR LE MAPPING DES KPIS (MYSQL) ---

@parametres_bp.route("/api/parametres/mapping-kpis", methods=["GET"])
def endpoint_get_kpi_mappings():
    """Liste tous les mappings de KPIs (MySQL)."""
    try:
        return jsonify({"data": get_mysql_kpi_mappings()}), 200
    except Exception as e:
        logger.error("Erreur GET kpi mappings: %s", e)
        return jsonify({"error": "Erreur lors de la récupération des mappings KPI"}), 500

@parametres_bp.route("/api/parametres/mapping-kpis", methods=["POST"])
def endpoint_post_kpi_mapping():
    """Ajoute ou met à jour un mapping de KPI (MySQL)."""
    data = request.json or {}
    univers = data.get("univers")
    source_table = data.get("source_table")
    source_column = data.get("source_column")
    standard_kpi_code = data.get("standard_kpi_code")
    id_projet = data.get("id_projet")
    description = data.get("description")
    is_formula = data.get("is_formula", False)
    formula = data.get("formula")
    
    if not univers or not source_table or not standard_kpi_code:
        return jsonify({"error": "Tous les champs sont requis (univers, table, kpi standard)"}), 400
        
    try:
        proj_id = int(id_projet) if id_projet and str(id_projet).isdigit() else None
        result = add_mysql_kpi_mapping(univers, source_table, source_column, standard_kpi_code, proj_id, description, is_formula, formula)
        emit_update("mapping_kpis_updated")
        return jsonify(result), 201
    except Exception as e:
        logger.error("Erreur POST kpi mapping: %s", e)
        return jsonify({"error": "Erreur lors de l'enregistrement du mapping KPI"}), 500

@parametres_bp.route("/api/parametres/mapping-kpis/<int:mapping_id>", methods=["DELETE"])
def endpoint_delete_kpi_mapping(mapping_id):
    """Supprime un mapping de KPI (MySQL)."""
    try:
        result = delete_mysql_kpi_mapping(mapping_id)
        emit_update("mapping_kpis_updated")
        return jsonify(result), 200
    except Exception as e:
        logger.error("Erreur DELETE kpi mapping: %s", e)
        return jsonify({"error": "Erreur lors de la suppression du mapping KPI"}), 500
