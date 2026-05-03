"""
Fichier : agents_routes.py
Rôle    : Blueprint Flask — endpoint REST pour la liste des agents SIRH
          rattachés à une règle de prime.
Module  : mypaie / backend / routes / agents
"""

import logging
from flask import Blueprint, jsonify, request
from services.agents.sirh_agents_provider import get_agents_sirh
from services.agents.agents_data_provider import get_agents_manual_data, save_agent_manual_data
from services.regles_primes.dw_api_regles_provider import get_regle_by_id

logger = logging.getLogger(__name__)

agents_bp = Blueprint("agents", __name__)


@agents_bp.route("/api/regles/<int:regle_id>/agents", methods=["GET"])
def endpoint_get_agents(regle_id):
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
            sql_struct = "SELECT id_projet, id_operation, id_file, id_activite FROM ref_structure_map WHERE id = %s"
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
                    COALESCE(s.libelle, 'Confirmé') as statut,
                    g.id_statut,
                    COALESCE(g.sanction, 'Non') as sanction
                FROM ref_employes e
                JOIN ref_structure_map m ON e.id_structure = m.id
                LEFT JOIN ref_operations o ON m.id_operation = o.id
                LEFT JOIN ref_files f ON m.id_file = f.id
                LEFT JOIN ref_activites a ON m.id_activite = a.id
                LEFT JOIN matrice_primes_agents_gestion g 
                    ON e.matricule = g.agent_matricule AND g.matrice_id = %s
                LEFT JOIN ref_statuts s ON g.id_statut = s.id
                WHERE m.id_projet = %s AND m.id_operation = %s
            """
            params = [regle_id, struct['id_projet'], struct['id_operation']]

            # Filtrage optionnel par file et activité
            if struct['id_file']:
                sql += " AND m.id_file = %s"
                params.append(struct['id_file'])
            
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
        return jsonify({"success": True}), 200
    except Exception as e:
        logger.error("Erreur endpoint POST /api/regles/%s/agents/%s/data : %s", regle_id, matricule, e)
        return jsonify({"error": str(e)}), 500
