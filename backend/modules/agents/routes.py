"""
Fichier : agents_routes.py
Rôle    : Blueprint Flask — endpoint REST pour la liste des agents SIRH
          rattachés à une règle de prime.
Module  : mypaie / backend / routes / agents
"""

import logging
from flask import Blueprint, jsonify, request, Response
import json
from modules.agents.services.sirh_agents_provider import get_agents_sirh
from modules.agents.services.gemini_agent_provider import process_chat_message, process_chat_message_stream
from modules.agents.services.agents_data_provider import (
    get_agents_manual_data, 
    save_agent_manual_data,
    get_all_agents_gestion,
    update_agent_global_statut,
    add_agent,
    update_agent,
    delete_agent,
)
from modules.agents.services.ai_history_provider import (
    create_conversation,
    get_conversations,
    get_messages,
    add_message,
    lock_conversation,
    truncate_conversation,
    delete_conversation
)
from modules.regles_primes.services.dw_api_regles_provider import get_regle_by_id
from modules.agents.services.assiduite_provider import (
    get_assiduite_pour_mois,
    upsert_assiduite,
    get_historique_assiduite,
    upload_justificatif,
    get_justificatif_info,
    delete_justificatif,
)
from modules.agents.services.assiduite_sync_provider import sync_assiduite_pour_mois
from modules.agents.services.assiduite_calendrier_provider import get_calendrier_agent
from modules.agents.services.assiduite_calendrier_provider import get_calendrier_agent
from core.socket import emit_update

import os
import jwt as _pyjwt
JWT_SECRET = os.getenv('JWT_SECRET', 'super_secret_dev_key_mypaie_2026')

logger = logging.getLogger(__name__)


def _get_current_user_info():
    """Decode JWT Bearer token pour identifier l'utilisateur courant. Non-bloquant."""
    try:
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return 'Système', None
        payload = _pyjwt.decode(auth[7:], JWT_SECRET, algorithms=['HS256'])
        full = f"{payload.get('prenom', '')} {payload.get('nom', '')}".strip() or 'Utilisateur'
        return full, payload.get('user_id')
    except Exception:
        return 'Système', None

agents_bp = Blueprint("agents", __name__)

MAX_MESSAGES_PER_CONV = 40

@agents_bp.route("/api/agents/chat", methods=["POST"])
def endpoint_agent_chat():
    """
    Endpoint pour le chat de l'assistant IA (Gemini).
    Attend un JSON : { "message": "...", "regle_id": 12, "conversation_id": 1 (optionnel) }
    """
    try:
        data = request.json
        if not data or not data.get("message"):
            return jsonify({"error": "Message manquant"}), 400
        
        message = data.get("message")
        regle_id = data.get("regle_id")
        conversation_id = data.get("conversation_id")
        
        if not regle_id:
            return jsonify({"error": "regle_id est requis"}), 400

        # Si aucune conversation en cours, on en crée une
        if not conversation_id:
            conversation_id = create_conversation(regle_id)
            # Ajout du message de bienvenue automatique
            add_message(conversation_id, "bot", "Bonjour ! Je suis l'assistant IA de myPaie. Je peux répondre à vos questions sur cette règle de prime, ses objectifs (KPIs) et ses paramètres. Comment puis-je vous aider ?")

        # Vérifier le nombre de messages (bloquer si > MAX_MESSAGES_PER_CONV)
        history_db = get_messages(conversation_id)
        if len(history_db) >= MAX_MESSAGES_PER_CONV:
            lock_conversation(conversation_id)
            return jsonify({
                "response": "Cette conversation a atteint la limite de mémoire pour garantir la précision des réponses. Veuillez démarrer une nouvelle conversation.",
                "is_locked": True,
                "conversation_id": conversation_id
            }), 200

        add_message(conversation_id, "user", message)

        def generate():
            full_bot_response = ""
            is_locked = len(history_db) + 2 >= MAX_MESSAGES_PER_CONV
            if is_locked:
                lock_conversation(conversation_id)

            meta = {"conversation_id": conversation_id, "is_locked": is_locked}
            yield f"data: {json.dumps({'meta': meta})}\n\n"

            for chunk in process_chat_message_stream(message, regle_id, history_db):
                full_bot_response += chunk
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            
            add_message(conversation_id, "bot", full_bot_response)
            yield f"data: {json.dumps({'done': True})}\n\n"

        return Response(generate(), mimetype='text/event-stream')

    except Exception as e:
        logger.error("Erreur endpoint POST /api/agents/chat : %s", e)
        return jsonify({"error": str(e)}), 500

@agents_bp.route("/api/regles/<int:regle_id>/conversations", methods=["GET"])
def endpoint_get_conversations(regle_id):
    """Retourne l'historique des conversations pour une règle donnée."""
    try:
        convs = get_conversations(regle_id)
        return jsonify({"data": convs}), 200
    except Exception as e:
        logger.error("Erreur GET conversations : %s", e)
        return jsonify({"error": str(e)}), 500

@agents_bp.route("/api/conversations/<int:conv_id>/messages", methods=["GET"])
def endpoint_get_messages(conv_id):
    """Retourne tous les messages d'une conversation spécifique."""
    try:
        msgs = get_messages(conv_id)
        return jsonify({"data": msgs}), 200
    except Exception as e:
        logger.error("Erreur GET messages : %s", e)
        return jsonify({"error": str(e)}), 500

@agents_bp.route("/api/conversations/<int:conv_id>/messages/<int:msg_id>/truncate", methods=["DELETE"])
def endpoint_truncate_messages(conv_id, msg_id):
    """Supprime tous les messages à partir d'un message donné pour permettre de l'éditer."""
    try:
        truncate_conversation(conv_id, msg_id)
        return jsonify({"success": True}), 200
    except Exception as e:
        logger.error("Erreur DELETE messages truncate : %s", e)
        return jsonify({"error": str(e)}), 500

@agents_bp.route("/api/conversations/<int:conv_id>", methods=["DELETE"])
def endpoint_delete_conversation(conv_id):
    """Supprime complètement une conversation et ses messages."""
    try:
        delete_conversation(conv_id)
        return jsonify({"success": True}), 200
    except Exception as e:
        logger.error("Erreur DELETE conversation : %s", e)
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
            poste=data.get('poste', 'AGENT'),
            salaire_net=data.get('salaire_net'),
            taux_horaire=data.get('taux_horaire', 22.91)
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
            poste=data.get('poste', 'AGENT'),
            salaire_net=data.get('salaire_net'),
            taux_horaire=data.get('taux_horaire', 22.91)
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


# ─── Assiduité ────────────────────────────────────────────────────────────────

@agents_bp.route("/api/assiduite", methods=["GET"])
def endpoint_get_assiduite():
    """
    Retourne la liste des agents avec leurs données d'assiduité pour un mois.
    Query param : mois=YYYY-MM  (défaut = mois courant)
    """
    try:
        from datetime import datetime
        mois = request.args.get("mois") or datetime.now().strftime("%Y-%m")
        # Validation format
        from datetime import datetime as _dt
        _dt.strptime(mois, "%Y-%m")
        data = get_assiduite_pour_mois(mois)
        return jsonify({"data": data, "mois": mois}), 200
    except ValueError:
        return jsonify({"error": "Format de mois invalide. Attendu : YYYY-MM"}), 400
    except Exception as e:
        logger.error("Erreur endpoint GET /api/assiduite : %s", e)
        return jsonify({"error": str(e)}), 500


@agents_bp.route("/api/assiduite/<matricule>", methods=["PUT"])
def endpoint_upsert_assiduite(matricule):
    """
    Crée ou met à jour la ligne d'assiduité pour (matricule, mois).
    Enregistre aussi une entrée dans assiduite_historique avec l'identité de l'auteur.
    Body JSON : { mois, abs_injustifie, retard, abs_justifie, cp_css, jours_ouvres, commentaire? }
    """
    try:
        body = request.json or {}
        mois = body.get("mois")
        if not mois:
            return jsonify({"error": "Champ 'mois' obligatoire"}), 400
        from datetime import datetime as _dt
        _dt.strptime(mois, "%Y-%m")
        modifie_par, modifie_par_id = _get_current_user_info()
        result = upsert_assiduite(matricule, mois, body,
                                   modifie_par=modifie_par,
                                   modifie_par_id=modifie_par_id)
        emit_update("assiduite_updated", {"matricule": matricule, "mois": mois})
        return jsonify({"success": True, "data": result}), 200
    except ValueError:
        return jsonify({"error": "Format de mois invalide. Attendu : YYYY-MM"}), 400
    except Exception as e:
        logger.error("Erreur endpoint PUT /api/assiduite/%s : %s", matricule, e)
        return jsonify({"error": str(e)}), 500


@agents_bp.route("/api/assiduite/<matricule>/historique", methods=["GET"])
def endpoint_get_historique_assiduite(matricule):
    """
    Retourne l'historique des modifications d'assiduité pour (matricule, mois).
    Query param : mois=YYYY-MM  (défaut = mois courant)
    """
    try:
        from datetime import datetime as _dt
        mois = request.args.get("mois") or _dt.now().strftime("%Y-%m")
        _dt.strptime(mois, "%Y-%m")
        data = get_historique_assiduite(matricule, mois)
        return jsonify({"data": data, "matricule": matricule, "mois": mois}), 200
    except ValueError:
        return jsonify({"error": "Format de mois invalide. Attendu : YYYY-MM"}), 400
    except Exception as e:
        logger.error("Erreur GET /api/assiduite/%s/historique : %s", matricule, e)
        return jsonify({"error": str(e)}), 500


@agents_bp.route("/api/assiduite/historique/<int:historique_id>/justificatif", methods=["POST"])
def endpoint_upload_justificatif(historique_id):
    """
    Upload d'un fichier justificatif pour une entrée d'historique.
    Form-data : fichier (file), matricule (str), mois (str YYYY-MM)
    """
    try:
        if 'fichier' not in request.files:
            return jsonify({"error": "Aucun fichier fourni (champ 'fichier')"}), 400
        file = request.files['fichier']
        if not file or not file.filename:
            return jsonify({"error": "Fichier invalide"}), 400
        matricule = request.form.get('matricule', '').strip()
        mois      = request.form.get('mois', '').strip()
        if not matricule or not mois:
            return jsonify({"error": "Champs 'matricule' et 'mois' obligatoires"}), 400
        file_bytes = file.read()
        mime_type  = file.content_type or 'application/octet-stream'
        result = upload_justificatif(historique_id, matricule, mois,
                                     file_bytes, file.filename, mime_type)
        return jsonify({"success": True, "data": result}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error("Erreur POST /api/assiduite/historique/%s/justificatif : %s", historique_id, e)
        return jsonify({"error": str(e)}), 500


@agents_bp.route("/api/assiduite/justificatif/<int:justif_id>/download", methods=["GET"])
def endpoint_download_justificatif(justif_id):
    """Téléchargement d'un justificatif."""
    try:
        from flask import send_file
        info = get_justificatif_info(justif_id)
        if not info:
            return jsonify({"error": "Justificatif introuvable"}), 404
        if not os.path.exists(info['file_path']):
            return jsonify({"error": "Fichier non disponible sur le serveur"}), 404
        return send_file(
            info['file_path'],
            mimetype=info['type_mime'],
            as_attachment=True,
            download_name=info['nom_original']
        )
    except Exception as e:
        logger.error("Erreur GET /api/assiduite/justificatif/%s/download : %s", justif_id, e)
        return jsonify({"error": str(e)}), 500


@agents_bp.route("/api/assiduite/justificatif/<int:justif_id>", methods=["DELETE"])
def endpoint_delete_justificatif(justif_id):
    """Suppression d'un justificatif (fichier + enregistrement)."""
    try:
        delete_justificatif(justif_id)
        return jsonify({"success": True}), 200
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        logger.error("Erreur DELETE /api/assiduite/justificatif/%s : %s", justif_id, e)
        return jsonify({"error": str(e)}), 500


# ─── Synchronisation automatique ─────────────────────────────────────────────

@agents_bp.route("/api/assiduite/sync", methods=["POST"])
def endpoint_sync_assiduite():
    """
    Déclenche la synchronisation automatique de assiduite_mensuelle pour un mois
    donné, en lisant les données depuis gestionpaie (heures_corrigees + heures_ecart).

    Body JSON : { "mois": "YYYY-MM" }

    Accès restreint : rôle super_admin uniquement.

    Returns:
        {
            "success": true,
            "mois":    "YYYY-MM",
            "stats":   {
                "updated":            <int>,
                "skipped_overridden": <int>,
                "skipped_no_data":    <int>,
                "errors":             [...]
            }
        }
    """
    try:
        # ── Contrôle d'accès ──────────────────────────────────────────────────
        try:
            auth = request.headers.get('Authorization', '')
            if not auth.startswith('Bearer '):
                return jsonify({"error": "Authentification requise"}), 401
            payload = _pyjwt.decode(auth[7:], JWT_SECRET, algorithms=['HS256'])
            role = payload.get('role', '')
        except Exception:
            return jsonify({"error": "Token invalide ou expiré"}), 401

        if role != 'super_admin':
            return jsonify({"error": "Accès réservé aux super-administrateurs"}), 403

        # ── Validation du mois ────────────────────────────────────────────────
        body = request.json or {}
        mois = (body.get('mois') or '').strip()
        if not mois:
            return jsonify({"error": "Champ 'mois' obligatoire (format YYYY-MM)"}), 400
        from datetime import datetime as _dt
        try:
            _dt.strptime(mois, "%Y-%m")
        except ValueError:
            return jsonify({"error": "Format de mois invalide. Attendu : YYYY-MM"}), 400

        # ── Synchronisation ───────────────────────────────────────────────────
        stats = sync_assiduite_pour_mois(mois)

        # Notifier les clients connectés en temps réel
        emit_update("assiduite_synced", {"mois": mois, "stats": stats})

        return jsonify({"success": True, "mois": mois, "stats": stats}), 200

    except Exception as e:
        logger.error("Erreur POST /api/assiduite/sync : %s", e)
        return jsonify({"error": str(e)}), 500


# ─── Calendrier journalier ────────────────────────────────────────────────────

@agents_bp.route("/api/assiduite/<matricule>/calendrier", methods=["GET"])
def endpoint_get_calendrier_agent(matricule):
    """
    Retourne le détail journalier de l'assiduité d'un agent pour un mois donné,
    en lisant directement depuis gestionpaie (heures_corrigees + heures_ecart).

    Query param : mois=YYYY-MM  (défaut = mois courant)

    Returns:
        { matricule, mois, stats: {...}, jours: [{date, statut, is_retard, …}] }
    """
    try:
        from datetime import datetime as _dt
        import pymysql
        mois = request.args.get("mois") or _dt.now().strftime("%Y-%m")
        _dt.strptime(mois, "%Y-%m")
        data = get_calendrier_agent(matricule, mois)
        return jsonify(data), 200
    except ValueError:
        return jsonify({"error": "Format de mois invalide. Attendu : YYYY-MM"}), 400
    except pymysql.err.OperationalError as e:
        logger.warning("GestionPaie inaccessible pour calendrier agent %s : %s", matricule, e)
        return jsonify({"error": "Source de données GestionPaie inaccessible", "disponible": False}), 503
    except Exception as e:
        logger.error("Erreur GET /api/assiduite/%s/calendrier : %s", matricule, e)
        return jsonify({"error": str(e)}), 500
