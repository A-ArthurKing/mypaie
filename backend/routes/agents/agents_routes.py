"""
Fichier : agents_routes.py
Rôle    : Blueprint Flask — endpoint REST pour la liste des agents SIRH
          rattachés à une règle de prime.
Module  : mypaie / backend / routes / agents
"""

import logging
from flask import Blueprint, jsonify, request
from services.agents.sirh_agents_provider import get_agents_sirh
from services.agents.gemini_agent_provider import process_chat_message
from services.agents.agents_data_provider import (
    get_agents_manual_data, 
    save_agent_manual_data,
    get_all_agents_gestion,
    update_agent_global_statut,
    add_agent,
    update_agent,
    delete_agent,
)
from services.regles_primes.dw_api_regles_provider import get_regle_by_id

agents_bp = Blueprint("agents", __name__)


@agents_bp.route("/api/agents/chat", methods=["POST"])
def endpoint_agent_chat():
    """
    Endpoint pour le chat de l'assistant IA (Gemini).
    Attend un JSON : { "message": "...", "regle_id": 12 (optionnel), "history": [...] (optionnel) }
    """
    try:
        data = request.json
        if not data or not data.get("message"):
            return jsonify({"error": "Message manquant"}), 400
        
        message = data.get("message")
        regle_id = data.get("regle_id")
        history = data.get("history", [])
        
        result = process_chat_message(message, regle_id, history)
        return jsonify(result), 200
        
    except Exception as e:
        logger.error("Erreur endpoint POST /api/agents/chat : %s", e)
        return jsonify({"error": str(e)}), 500


@agents_bp.route("/api/regles/<int:regle_id>/agents", methods=["GET"])
def endpoint_get_agents_for_regle(regle_id):
    """
    Retourne la liste des agents filtrés par la structure de la règle.
    """
    from config.db_mysql_connector import get_mysql_connection
    try:
        regle = get_regle_by_id(regle_id)
        if not regle:
            return jsonify({"error": "Règle non trouvée"}), 404
        
        id_structure = regle.get("id_structure")

        mysql_conn = get_mysql_connection()
        with mysql_conn.cursor() as cur:
            # 1. Récupérer les critères de la structure de la règle
            sql_struct = "SELECT id_projet, id_operation, id_sous_projet, id_activite FROM ref_structure_map WHERE id = %s"
            cur.execute(sql_struct, (id_structure,))
            struct = cur.fetchone()
            
            # 2. Si pas de structure, on retourne vide ou tout (selon le besoin)
            if not struct:
                return jsonify({"data": []}), 200

            # 3. Récupérer les agents qui matchent cette branche de structure
            sql = """
                SELECT 
                    e.matricule, e.nom, e.prenom, 
                    o.libelle as operation, 
                    f.libelle as file, 
                    a.libelle as activite,
                    COALESCE(s.libelle, sg.libelle, 'Confirmé') as statut,
                    COALESCE(g.id_statut, e.id_statut) as id_statut,
                    COALESCE(g.sanction, 'Non') as sanction,
                    e.prime_langue
                FROM ref_employes e
                JOIN ref_structure_map m ON e.id_structure = m.id
                LEFT JOIN ref_operations o ON m.id_operation = o.id
                LEFT JOIN ref_sous_projet f ON m.id_sous_projet = f.id
                LEFT JOIN ref_activites a ON m.id_activite = a.id
                LEFT JOIN matrice_primes_agents_gestion g 
                    ON e.matricule = g.agent_matricule AND g.matrice_id = %s
                LEFT JOIN matrice_statuts s ON g.id_statut = s.id
                LEFT JOIN matrice_statuts sg ON e.id_statut = sg.id
                WHERE m.id_projet = %s AND m.id_operation = %s
            """
            params = [regle_id, struct['id_projet'], struct['id_operation']]

            # Filtrage optionnel par file et activité
            if struct['id_sous_projet']:
                sql += " AND m.id_sous_projet = %s"
                params.append(struct['id_sous_projet'])
            
            if struct['id_activite']:
                sql += " AND m.id_activite = %s"
                params.append(struct['id_activite'])

            cur.execute(sql, tuple(params))
            agents = cur.fetchall()
            
        mysql_conn.close()
        return jsonify({"data": agents}), 200
    except Exception as e:
        logger.error("Erreur endpoint GET /api/regles/%s/agents : %s", regle_id, e)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        logger.error("Erreur endpoint GET /api/regles/%s/agents : %s", regle_id, e)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        logger.error("Erreur endpoint GET /api/regles/%s/agents : %s", regle_id, e)
        return jsonify({"error": str(e)}), 500


@agents_bp.route("/api/regles/<int:regle_id>/agents/<matricule>/data", methods=["POST"])
def endpoint_save_agent_data(regle_id, matricule):
    """
    Sauvegarde les données manuelles (statut, sanction) pour un agent spécifique.
    """
    try:
        data = request.json
        save_agent_manual_data(regle_id, matricule, data)
        emit_update("agent_data_updated", {"matricule": matricule, "regle_id": regle_id})
        return jsonify({"success": True}), 200
    except Exception as e:
        logger.error("Erreur endpoint POST /api/regles/%s/agents/%s/data : %s", regle_id, matricule, e)
        return jsonify({"error": str(e)}), 500


@agents_bp.route("/api/agents/gestion", methods=["GET"])
def endpoint_get_all_agents_gestion():
    """
    Retourne la liste de tous les agents pour la page de gestion globale.
    """
    try:
        agents = get_all_agents_gestion()
        return jsonify({"data": agents}), 200
    except Exception as e:
        logger.error("Erreur endpoint GET /api/agents/gestion : %s", e)
        return jsonify({"error": str(e)}), 500


@agents_bp.route("/api/agents/<matricule>/statut", methods=["POST"])
def endpoint_update_agent_global_statut(matricule):
    """
    Met à jour le statut global d'un agent.
    """
    try:
        data = request.json
        id_statut = data.get("id_statut")
        if id_statut is None:
            return jsonify({"error": "id_statut manquant"}), 400
        
        update_agent_global_statut(matricule, id_statut)
        emit_update("agent_updated", {"matricule": matricule})
        return jsonify({"success": True}), 200
    except Exception as e:
        logger.error("Erreur endpoint POST /api/agents/%s/statut : %s", matricule, e)
        return jsonify({"error": str(e)}), 500


@agents_bp.route("/api/agents", methods=["POST"])
def endpoint_add_agent():
    """
    Ajoute un nouvel agent dans le SIRH (ref_employes).
    """
    try:
        data = request.json or {}
        required = ['matricule', 'nom', 'prenom', 'id_structure']
        for field in required:
            if not data.get(field):
                return jsonify({"error": f"Champ obligatoire manquant : {field}"}), 400

        agent = add_agent(
            matricule=data['matricule'],
            nom=data['nom'],
            prenom=data['prenom'],
            id_structure=int(data['id_structure']),
            id_statut=data.get('id_statut') or None,
            prime_langue=data.get('prime_langue', 0),
        )
        emit_update("agent_created", {"matricule": data['matricule']})
        return jsonify({"success": True, "agent": agent}), 201
    except Exception as e:
        logger.error("Erreur endpoint POST /api/agents : %s", e)
        return jsonify({"error": str(e)}), 500


@agents_bp.route("/api/agents/<matricule>", methods=["PUT"])
def endpoint_update_agent(matricule):
    """
    Met à jour les informations d'un agent existant.
    """
    try:
        data = request.json or {}
        required = ['nom', 'prenom', 'id_structure']
        for field in required:
            if not data.get(field):
                return jsonify({"error": f"Champ obligatoire manquant : {field}"}), 400

        agent = update_agent(
            matricule=matricule,
            nom=data['nom'],
            prenom=data['prenom'],
            id_structure=int(data['id_structure']),
            id_statut=data.get('id_statut') or None,
            prime_langue=data.get('prime_langue', 0),
        )
        emit_update("agent_updated", {"matricule": matricule})
        return jsonify({"success": True, "agent": agent}), 200
    except Exception as e:
        logger.error("Erreur endpoint PUT /api/agents/%s : %s", matricule, e)
        return jsonify({"error": str(e)}), 500


@agents_bp.route("/api/agents/<matricule>", methods=["DELETE"])
def endpoint_delete_agent(matricule):
    """
    Supprime un agent du SIRH.
    """
    try:
        delete_agent(matricule)
        emit_update("agent_deleted", {"matricule": matricule})
        return jsonify({"success": True}), 200
    except Exception as e:
        logger.error("Erreur endpoint DELETE /api/agents/%s : %s", matricule, e)
        return jsonify({"error": str(e)}), 500
