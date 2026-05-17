"""
Fichier : api/parametres/routes.py
Rôle    : Blueprint Flask pour l'administration des paramètres (mapping, structure, KPIs).
Module  : mypaie / backend / api / parametres
"""

import logging
from flask import Blueprint, jsonify, request
from services.parametres.mapping_provider import (
    get_mappings, delete_mapping,
    get_mysql_project_mappings, add_mysql_project_mapping, delete_mysql_project_mapping,
    get_all_kpis_with_status, toggle_kpi_actif
)
from services.parametres.structure_provider import (
    add_project, update_project, delete_project,
    add_operation, update_operation, delete_operation,
    add_sous_projet, update_sous_projet, delete_sous_projet,
    add_activity, update_activity, delete_activity,
    add_structure_mapping, delete_structure_mapping,
)
from services.parametres.reference_provider import get_all_references, invalidate_references_cache
from services.parametres.introspection_provider import list_bigquery_tables, list_table_columns, get_unique_column_values, discover_gold_kpis
from core.socket import emit_update

logger = logging.getLogger(__name__)

parametres_bp = Blueprint("parametres", __name__)


def _emit_structure_update():
    """Invalide le cache référentiels ET émet l'évènement temps-réel."""
    invalidate_references_cache()
    emit_update("structure_updated")


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
    table_id    = request.args.get("table")
    column_name = request.args.get("column")
    if not table_id or not column_name:
        return jsonify({"error": "Paramètres 'table' et 'column' requis"}), 400
    return jsonify({"data": get_unique_column_values(table_id, column_name)}), 200

# ===== Découverte Dynamique des KPIs (Pont Data-App) =====
# Avec la nouvelle architecture "Metadata-Driven", l'application ne s'appuie plus sur une table 
# de mapping technique (qui a été supprimée de MySQL). Elle est devenue "aveugle" par défaut.
# Pour lister les KPIs existants (pour peupler les menus déroulants lors de la création d'une grille),
# l'UI doit interroger directement la couche "Gold" de BigQuery.
# 
# Cette route interroge les tables de synthèse (paie_performance_mensuelle / paie_qualite_mensuelle)
# pour récupérer dynamiquement la liste fraîche de tous les kpi_code générés par les ETLs.
# Elle accepte un paramètre optionnel ?projet= pour filtrer les résultats.
@parametres_bp.route("/api/parametres/introspection/gold-kpis", methods=["GET"])
def endpoint_discover_gold_kpis():
    projet = request.args.get("projet")
    # Appelle le provider BQ pour scanner les tables Gold (très léger et rapide)
    return jsonify({"data": discover_gold_kpis(projet)}), 200

# --- KPIs STANDARDS ---

@parametres_bp.route("/api/parametres/kpis-standards", methods=["POST"])
def endpoint_add_standard_kpi():
    """Ajoute un nouveau KPI au référentiel."""
    data    = request.json or {}
    code    = data.get("code")
    libelle = data.get("libelle")
    univers = data.get("univers")
    unite   = data.get("unite")

    if not code or not libelle or not univers:
        return jsonify({"error": "Code, Libellé et Univers sont requis"}), 400

    try:
        res = add_standard_kpi(code, libelle, univers, unite)
        invalidate_references_cache()
        emit_update("kpi_standards_updated")
        return jsonify(res), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/kpis-standards/<code>", methods=["PATCH"])
def endpoint_update_standard_kpi(code):
    """Met à jour le libellé et l'unité d'un KPI standard existant."""
    data    = request.json or {}
    libelle = data.get("libelle")
    unite   = data.get("unite")
    if not libelle:
        return jsonify({"error": "Le libellé est requis"}), 400
    try:
        res = update_standard_kpi(code, libelle, unite)
        invalidate_references_cache()
        emit_update("kpi_standards_updated")
        return jsonify(res), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- REFERENCES ---

@parametres_bp.route("/api/parametres/references", methods=["GET"])
def endpoint_get_references():
    """Retourne les référentiels (opérations, files, activités, statuts)."""
    try:
        return jsonify(get_all_references()), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- MAPPING PROJETS ---

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
    data        = request.json or {}
    source_name = data.get("source_name")
    id_projet   = data.get("id_projet")
    id_sous_projet     = data.get("id_sous_projet")
    id_activite = data.get("id_activite")
    description = data.get("description")

    if not source_name or not id_projet:
        return jsonify({"error": "Les champs source_name et id_projet sont requis"}), 400

    try:
        f_id   = int(id_sous_projet)     if id_sous_projet     and str(id_sous_projet).isdigit()     else None
        a_id   = int(id_activite) if id_activite and str(id_activite).isdigit() else None
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


# --- MAPPING KPIs ---

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
    data              = request.json or {}
    univers           = data.get("univers")
    source_table      = data.get("source_table")
    source_column     = data.get("source_column")
    standard_kpi_code = data.get("standard_kpi_code")
    id_projet         = data.get("id_projet")
    description       = data.get("description")
    is_formula        = data.get("is_formula", False)
    formula           = data.get("formula")

    if not univers or not source_table or not standard_kpi_code:
        return jsonify({"error": "Tous les champs sont requis (univers, table, kpi standard)"}), 400

    try:
        proj_id = int(id_projet) if id_projet and str(id_projet).isdigit() else None
        result  = add_mysql_kpi_mapping(univers, source_table, source_column, standard_kpi_code, proj_id, description, is_formula, formula)
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


# --- KPI REGISTRY : catalogue + toggle actif ---

@parametres_bp.route("/api/parametres/kpis-registry", methods=["GET"])
def endpoint_kpis_registry():
    """Liste tous les KPIs standards avec leur statut actif et le nombre de mappings."""
    try:
        return jsonify({"data": get_all_kpis_with_status()}), 200
    except Exception as e:
        logger.error("Erreur GET kpis-registry: %s", e)
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/kpis-registry/<code>/toggle", methods=["PATCH"])
def endpoint_toggle_kpi(code):
    """Bascule le flag actif d'un KPI (actif ↔ inactif)."""
    try:
        result = toggle_kpi_actif(code)
        invalidate_references_cache()
        emit_update("kpi_registry_updated")
        return jsonify(result), 200
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        logger.error("Erreur PATCH toggle kpi '%s': %s", code, e)
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/etl-sources", methods=["GET"])
def endpoint_etl_sources():
    """Liste les sources ETL configurées (ref_etl_config)."""
    try:
        return jsonify({"data": get_etl_sources()}), 200
    except Exception as e:
        logger.error("Erreur GET etl-sources: %s", e)
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/etl-sources/<path:source_table>/mappings", methods=["GET"])
def endpoint_etl_source_mappings(source_table):
    """Retourne les mappings KPI d'une source ETL donnée."""
    try:
        return jsonify({"data": get_kpi_mappings_by_source(source_table)}), 200
    except Exception as e:
        logger.error("Erreur GET etl-source-mappings '%s': %s", source_table, e)
        return jsonify({"error": str(e)}), 500


# --- STRUCTURE ---

@parametres_bp.route("/api/parametres/structure/projets", methods=["POST"])
def endpoint_add_project():
    data = request.json or {}
    try:
        res = add_project(data.get("nom"), data.get("code"))
        _emit_structure_update()
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
            res  = update_project(id, data.get("nom"), data.get("code"))
        _emit_structure_update()
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/structure/operations", methods=["POST"])
def endpoint_add_operation():
    data = request.json or {}
    try:
        res = add_operation(data.get("id_projet"), data.get("libelle"))
        _emit_structure_update()
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
            res  = update_operation(id, data.get("libelle"))
        _emit_structure_update()
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/structure/sous-projets", methods=["POST"])
def endpoint_add_file():
    data = request.json or {}
    try:
        res = add_sous_projet(data.get("libelle"))
        _emit_structure_update()
        return jsonify(res), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/structure/sous-projets/<int:id>", methods=["PUT", "DELETE"])
def endpoint_manage_file(id):
    try:
        if request.method == "DELETE":
            res = delete_sous_projet(id)
        else:
            data = request.json or {}
            res  = update_sous_projet(id, data.get("libelle"))
        _emit_structure_update()
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/structure/activites", methods=["POST"])
def endpoint_add_activity():
    data = request.json or {}
    try:
        res = add_activity(data.get("libelle"))
        _emit_structure_update()
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
            res  = update_activity(id, data.get("libelle"))
        _emit_structure_update()
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
            data.get("id_sous_projet"),
            data.get("id_activite"),
        )
        _emit_structure_update()
        return jsonify(res), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/structure/mapping/<int:id>", methods=["DELETE"])
def endpoint_delete_structure_mapping(id):
    try:
        res = delete_structure_mapping(id)
        _emit_structure_update()
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
