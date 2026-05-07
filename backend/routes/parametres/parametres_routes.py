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
    add_standard_kpi,
    get_mysql_project_mappings, add_mysql_project_mapping, delete_mysql_project_mapping
)
from services.parametres.structure_provider import (
    add_project, update_project, delete_project,
    add_operation, update_operation, delete_operation,
    add_file, update_file, delete_file,
    add_activity, update_activity, delete_activity,
    add_structure_mapping, delete_structure_mapping
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


@parametres_bp.route("/api/parametres/kpis-standards", methods=["POST"])
def endpoint_add_standard_kpi():
    """Ajoute un nouveau KPI au référentiel."""
    data = request.json or {}
    code = data.get("code")
    libelle = data.get("libelle")
    univers = data.get("univers")
    unite = data.get("unite")
    
    if not code or not libelle or not univers:
        return jsonify({"error": "Code, Libellé et Univers sont requis"}), 400
        
    try:
        res = add_standard_kpi(code, libelle, univers, unite)
        emit_update("kpi_standards_updated")
        return jsonify(res), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
    id_file = data.get("id_file")
    id_activite = data.get("id_activite")
    description = data.get("description")
    
    if not source_name or not id_projet:
        return jsonify({"error": "Les champs source_name et id_projet sont requis"}), 400
        
    try:
        f_id = int(id_file) if id_file and str(id_file).isdigit() else None
        a_id = int(id_activite) if id_activite and str(id_activite).isdigit() else None
        result = add_mysql_project_mapping(source_name, int(id_projet), f_id, a_id, description)
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

# --- ROUTES POUR LA GESTION DE LA STRUCTURE ---

@parametres_bp.route("/api/parametres/structure/projets", methods=["POST"])
def endpoint_add_project():
    data = request.json or {}
    try:
        res = add_project(data.get("nom"), data.get("code"))
        emit_update("structure_updated")
        return jsonify(res), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@parametres_bp.route("/api/parametres/structure/projets/<int:id>", methods=["PUT", "DELETE"])
def endpoint_manage_project(id):
    try:
        if request.method == "DELETE":
            res = delete_project(id)
        else:
            data = request.json or {}
            res = update_project(id, data.get("nom"), data.get("code"))
        emit_update("structure_updated")
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@parametres_bp.route("/api/parametres/structure/operations", methods=["POST"])
def endpoint_add_operation():
    data = request.json or {}
    try:
        res = add_operation(data.get("id_projet"), data.get("libelle"))
        emit_update("structure_updated")
        return jsonify(res), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@parametres_bp.route("/api/parametres/structure/operations/<int:id>", methods=["PUT", "DELETE"])
def endpoint_manage_operation(id):
    try:
        if request.method == "DELETE":
            res = delete_operation(id)
        else:
            data = request.json or {}
            res = update_operation(id, data.get("libelle"))
        emit_update("structure_updated")
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@parametres_bp.route("/api/parametres/structure/files", methods=["POST"])
def endpoint_add_file():
    data = request.json or {}
    try:
        res = add_file(data.get("libelle"))
        emit_update("structure_updated")
        return jsonify(res), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@parametres_bp.route("/api/parametres/structure/files/<int:id>", methods=["PUT", "DELETE"])
def endpoint_manage_file(id):
    try:
        if request.method == "DELETE":
            res = delete_file(id)
        else:
            data = request.json or {}
            res = update_file(id, data.get("libelle"))
        emit_update("structure_updated")
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@parametres_bp.route("/api/parametres/structure/activites", methods=["POST"])
def endpoint_add_activity():
    data = request.json or {}
    try:
        res = add_activity(data.get("libelle"))
        emit_update("structure_updated")
        return jsonify(res), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@parametres_bp.route("/api/parametres/structure/activites/<int:id>", methods=["PUT", "DELETE"])
def endpoint_manage_activity(id):
    try:
        if request.method == "DELETE":
            res = delete_activity(id)
        else:
            data = request.json or {}
            res = update_activity(id, data.get("libelle"))
        emit_update("structure_updated")
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@parametres_bp.route("/api/parametres/structure/mapping", methods=["POST"])
def endpoint_add_structure_mapping():
    data = request.json or {}
    try:
        res = add_structure_mapping(
            data.get("id_projet"), 
            data.get("id_operation"), 
            data.get("id_file"), 
            data.get("id_activite")
        )
        emit_update("structure_updated")
        return jsonify(res), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@parametres_bp.route("/api/parametres/structure/mapping/<int:id>", methods=["DELETE"])
def endpoint_delete_structure_mapping(id):
    try:
        res = delete_structure_mapping(id)
        emit_update("structure_updated")
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
