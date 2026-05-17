"""
Fichier : parametres_routes.py
Rôle    : Blueprint Flask pour l'administration des paramètres de la plateforme
          (structure organisationnelle, mapping projets, registre KPIs, introspection BQ).
Module  : mypaie / backend / routes / parametres
"""

import logging
from flask import Blueprint, jsonify, request
from modules.parametres.services.mapping_provider import (
    get_mappings, delete_mapping,
    get_mysql_project_mappings, add_mysql_project_mapping, delete_mysql_project_mapping,
    get_all_kpis_with_status, toggle_kpi_actif,
    add_kpi_registry_item, update_kpi_registry_item, delete_kpi_registry_item,
    get_etl_sources, get_kpi_mappings_by_source
)
from modules.parametres.services.structure_provider import (
    add_project, update_project, delete_project,
    add_operation, update_operation, delete_operation,
    add_sous_projet, update_sous_projet, delete_sous_projet,
    add_activity, update_activity, delete_activity,
    add_structure_mapping, delete_structure_mapping
)
from modules.parametres.services.reference_provider import get_all_references, invalidate_references_cache
from modules.parametres.services.dw_api_introspection_provider import list_bigquery_tables, list_table_columns, get_unique_column_values
from modules.parametres.services.ai_config_provider import suggest_kpi_label, _fallback_label
from core.socket import emit_update

logger = logging.getLogger(__name__)

parametres_bp = Blueprint("parametres", __name__)


def _emit_structure_update():
    """Invalide le cache référentiels ET émet l'évènement temps-réel."""
    invalidate_references_cache()
    emit_update("structure_updated")


# ==================================================================
#  INTROSPECTION BIGQUERY
# ==================================================================

@parametres_bp.route("/api/parametres/introspection/tables", methods=["GET"])
def endpoint_list_tables():
    """Liste les tables/vues BigQuery disponibles."""
    try:
        return jsonify({"data": list_bigquery_tables()}), 200
    except Exception as e:
        logger.error("Erreur introspection tables: %s", e)
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/introspection/columns", methods=["GET"])
def endpoint_list_columns():
    """Liste les colonnes d'une table BigQuery."""
    table_id = request.args.get("table")
    if not table_id:
        return jsonify({"error": "Paramètre 'table' requis"}), 400
    try:
        return jsonify({"data": list_table_columns(table_id)}), 200
    except Exception as e:
        logger.error("Erreur introspection colonnes '%s': %s", table_id, e)
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/introspection/unique-values", methods=["GET"])
def endpoint_unique_values():
    """Récupère les valeurs uniques d'une colonne BigQuery."""
    table_id = request.args.get("table")
    column_name = request.args.get("column")
    if not table_id or not column_name:
        return jsonify({"error": "Paramètres 'table' et 'column' requis"}), 400
    try:
        return jsonify({"data": get_unique_column_values(table_id, column_name)}), 200
    except Exception as e:
        logger.error("Erreur unique-values '%s.%s': %s", table_id, column_name, e)
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/introspection/projets-bruts", methods=["GET"])
def endpoint_projets_bruts():
    """
    Récupère la liste des noms de projets bruts présents dans la table Gold
    (paie_performance_mensuelle.projet). Utilisé par le formulaire Mapping Projets.
    """
    try:
        data = get_unique_column_values("paie_performance_mensuelle", "projet")
        return jsonify({"data": data}), 200
    except Exception as e:
        logger.error("Erreur récupération projets bruts: %s", e)
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/introspection/gold-kpis", methods=["GET"])
def endpoint_discover_gold_kpis():
    """
    Découvre dynamiquement les KPIs disponibles dans la couche Gold BigQuery.
    Optionnel: ?projet=PVCP_PERFORMANCE
    """
    try:
        from modules.parametres.services.introspection_provider import discover_gold_kpis
        projet = request.args.get("projet")
        return jsonify({"data": discover_gold_kpis(projet)}), 200
    except Exception as e:
        logger.error("Erreur découverte gold-kpis: %s", e)
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/introspection/gold-kpis/sync", methods=["POST"])
def endpoint_sync_gold_kpis():
    """
    Synchronise les KPIs découverts dans BigQuery avec la table MySQL config_kpis.
    Les KPIs inexistants dans MySQL sont ajoutés avec un libellé généré par le fallback IA.
    """
    from modules.parametres.services.introspection_provider import discover_gold_kpis
    from config.db_mysql_connector import get_mysql_connection

    try:
        kpis_bq = discover_gold_kpis()
        if not kpis_bq:
            return jsonify({"message": "Aucun KPI trouvé dans BigQuery.", "inserted": 0}), 200

        conn = get_mysql_connection()
        try:
            with conn.cursor() as cur:
                inserted = 0
                for kpi in kpis_bq:
                    code   = kpi["kpi_code"]
                    univers = kpi["univers"]
                    # Utilise le fallback enrichi (patterns call center) plutôt que .title() brut
                    fallback = _fallback_label(code)
                    cur.execute(
                        "INSERT IGNORE INTO config_kpis (code_kpi, libelle, univers, is_active) VALUES (%s, %s, %s, 1)",
                        (code, fallback["libelle"], univers)
                    )
                    inserted += cur.rowcount
                conn.commit()

            invalidate_references_cache()
            emit_update("kpi_registry_updated")
            return jsonify({"message": f"{inserted} nouveaux KPIs synchronisés.", "inserted": inserted}), 200
        finally:
            conn.close()
    except Exception as e:
        logger.error("Erreur synchronisation KPIs: %s", e)
        return jsonify({"error": str(e)}), 500


# ==================================================================
#  REGISTRE KPI  (IMPORTANT : suggest-label AVANT <code>)
# ==================================================================

@parametres_bp.route("/api/parametres/kpis-registry/suggest-label", methods=["GET"])
def endpoint_suggest_kpi_label():
    """Suggère un libellé métier et une description via Gemini IA."""
    code   = request.args.get("code")
    univers = request.args.get("univers", "PERF")
    if not code:
        return jsonify({"error": "Paramètre 'code' requis"}), 400
    try:
        return jsonify(suggest_kpi_label(code, univers)), 200
    except Exception as e:
        logger.error("Erreur suggest-label '%s': %s", code, e)
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/kpis-registry", methods=["GET"])
def endpoint_kpis_registry():
    """Liste tous les KPIs configurés (config_kpis)."""
    try:
        return jsonify({"data": get_all_kpis_with_status()}), 200
    except Exception as e:
        logger.error("Erreur GET kpis-registry: %s", e)
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/kpis-registry", methods=["POST"])
def endpoint_add_kpi_registry():
    """Ajoute un nouveau KPI au dictionnaire applicatif."""
    data    = request.json or {}
    code    = data.get("code")
    libelle = data.get("libelle")
    univers = data.get("univers")
    if not code or not libelle or not univers:
        return jsonify({"error": "Les champs code, libelle et univers sont requis"}), 400
    try:
        res = add_kpi_registry_item(
            code, libelle, univers,
            kpi_type=data.get("type", "VIRTUAL"),
            formule=data.get("formule"),
            description=data.get("description")
        )
        invalidate_references_cache()
        emit_update("kpi_registry_updated")
        return jsonify(res), 201
    except Exception as e:
        logger.error("Erreur POST kpis-registry: %s", e)
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/kpis-registry/<code>/toggle", methods=["PATCH"])
def endpoint_toggle_kpi(code):
    """Bascule le flag actif/inactif d'un KPI."""
    try:
        result = toggle_kpi_actif(code)
        invalidate_references_cache()
        emit_update("kpi_registry_updated")
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error("Erreur PATCH toggle kpi '%s': %s", code, e)
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/kpis-registry/<code>", methods=["PATCH"])
def endpoint_update_kpi_registry(code):
    """Met à jour les informations d'un KPI du dictionnaire."""
    data = request.json or {}
    try:
        res = update_kpi_registry_item(
            code=code,
            libelle=data.get("libelle"),
            description=data.get("description"),
            formule=data.get("formule"),
            univers=data.get("univers")
        )
        invalidate_references_cache()
        emit_update("kpi_registry_updated")
        return jsonify(res), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error("Erreur PATCH kpis-registry '%s': %s", code, e)
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/kpis-registry/<code>", methods=["DELETE"])
def endpoint_delete_kpi_registry(code):
    """Supprime un KPI du dictionnaire."""
    try:
        res = delete_kpi_registry_item(code)
        invalidate_references_cache()
        emit_update("kpi_registry_updated")
        return jsonify(res), 200
    except Exception as e:
        logger.error("Erreur DELETE kpis-registry '%s': %s", code, e)
        return jsonify({"error": str(e)}), 500


# ==================================================================
#  MAPPING PROJETS
# ==================================================================

@parametres_bp.route("/api/parametres/mapping-projets", methods=["GET"])
def endpoint_get_mappings():
    """Liste tous les mappings projet brut → projet standard (MySQL)."""
    try:
        return jsonify({"data": get_mysql_project_mappings()}), 200
    except Exception as e:
        logger.error("Erreur GET mapping-projets: %s", e)
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/mapping-projets", methods=["POST"])
def endpoint_post_mapping():
    """Enregistre un nouveau mapping projet brut → projet standard."""
    data        = request.json or {}
    source_name = data.get("source_name", "").strip()
    id_projet   = data.get("id_projet")
    if not source_name or not id_projet:
        return jsonify({"error": "Les champs source_name et id_projet sont requis"}), 400
    try:
        f_id   = int(data["id_sous_projet"]) if data.get("id_sous_projet") else None
        a_id   = int(data["id_activite"])    if data.get("id_activite")    else None
        result = add_mysql_project_mapping(source_name, int(id_projet), f_id, a_id, data.get("description"))
        emit_update("mapping_projets_updated")
        return jsonify(result), 201
    except Exception as e:
        logger.error("Erreur POST mapping-projets: %s", e)
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/mapping-projets/<int:mapping_id>", methods=["DELETE"])
def endpoint_delete_mapping(mapping_id):
    """Supprime un mapping projet."""
    try:
        result = delete_mysql_project_mapping(mapping_id)
        emit_update("mapping_projets_updated")
        return jsonify(result), 200
    except Exception as e:
        logger.error("Erreur DELETE mapping-projets #%d: %s", mapping_id, e)
        return jsonify({"error": str(e)}), 500


# ==================================================================
#  REFERENTIELS
# ==================================================================

@parametres_bp.route("/api/parametres/references", methods=["GET"])
def endpoint_get_references():
    """Retourne tous les référentiels (projets, opérations, files, activités, KPIs)."""
    try:
        return jsonify(get_all_references()), 200
    except Exception as e:
        logger.error("Erreur GET references: %s", e)
        return jsonify({"error": str(e)}), 500


# ==================================================================
#  SOURCES ETL  (lecture seule - configuration avancee)
# ==================================================================

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
    """Retourne les mappings KPI associés à une source ETL donnée."""
    try:
        return jsonify({"data": get_kpi_mappings_by_source(source_table)}), 200
    except Exception as e:
        logger.error("Erreur GET etl-source-mappings '%s': %s", source_table, e)
        return jsonify({"error": str(e)}), 500


# ==================================================================
#  STRUCTURE ORGANISATIONNELLE
# ==================================================================

# === Projets ===

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
            res = update_project(id, data.get("nom"), data.get("code"))
        _emit_structure_update()
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# === Operations ===

@parametres_bp.route("/api/parametres/structure/operations", methods=["POST"])
def endpoint_add_operation():
    data = request.json or {}
    try:
        res = add_operation(data.get("libelle"), data.get("id_projet"))
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
            res = update_operation(id, data.get("libelle"))
        _emit_structure_update()
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# === Sous-Projets / Files ===

@parametres_bp.route("/api/parametres/structure/sous-projets", methods=["POST"])
@parametres_bp.route("/api/parametres/structure/files", methods=["POST"])
def endpoint_add_sous_projet():
    data = request.json or {}
    try:
        res = add_sous_projet(data.get("libelle"))
        _emit_structure_update()
        return jsonify(res), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@parametres_bp.route("/api/parametres/structure/sous-projets/<int:id>", methods=["PUT", "DELETE"])
@parametres_bp.route("/api/parametres/structure/files/<int:id>", methods=["PUT", "DELETE"])
def endpoint_manage_sous_projet(id):
    try:
        if request.method == "DELETE":
            res = delete_sous_projet(id)
        else:
            data = request.json or {}
            res = update_sous_projet(id, data.get("libelle"))
        _emit_structure_update()
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# === Activites ===

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
            res = update_activity(id, data.get("libelle"))
        _emit_structure_update()
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# === Mapping Structurel (projet / operation / file / activite) ===

@parametres_bp.route("/api/parametres/structure/mapping", methods=["POST"])
def endpoint_add_structure_mapping():
    data = request.json or {}
    try:
        res = add_structure_mapping(
            data.get("id_projet"),
            data.get("id_operation"),
            data.get("id_sous_projet"),
            data.get("id_activite")
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