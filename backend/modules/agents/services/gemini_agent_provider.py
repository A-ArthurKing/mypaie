"""
Fichier : gemini_agent_provider.py
Rôle    : Gère la communication avec l'API Google Gemini.
          Utilise le moteur AI segmenté (prompts et tools séparés).
Module  : mypaie / backend / services / agents
"""

import os
import json
import logging
from google import genai
from google.genai import types

from modules.agents.services.ai_engine.prompts import SYSTEM_PROMPT
from modules.agents.services.ai_engine.tools import (
    get_regle_info_tool, 
    list_available_kpis_tool, 
    get_context_notes_tool,
    save_context_note_tool, 
    get_active_grille_json_tool,
    get_real_performance_tool, 
    prepare_grille_proposal_tool,
    save_grille_config_tool,
    update_regle_metadata_tool,
    rename_grille_version_tool
)
from config.db_mysql_connector import get_mysql_connection

logger = logging.getLogger(__name__)

def get_gemini_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY non configurée dans .env")
    return genai.Client(api_key=api_key)


def _load_context_notes_for_prompt(regle_id: int) -> str:
    """Charge les notes mémoire silencieusement pour les injecter dans le contexte."""
    try:
        conn = get_mysql_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT note, created_at FROM ai_regle_context "
                    "WHERE regle_id = %s ORDER BY created_at ASC",
                    (regle_id,)
                )
                rows = cur.fetchall()
        finally:
            conn.close()
        if not rows:
            return ""
        lines = [f"\n=== MÉMOIRE PERSISTANTE DE CETTE RÈGLE ({len(rows)} note(s)) ==="]
        for r in rows:
            lines.append(f"  [{r['created_at']}] {r['note']}")
        lines.append("=== FIN DE LA MÉMOIRE — Ces informations restent valides pour toutes les conversations ===")
        return "\n".join(lines)
    except Exception as e:
        logger.warning(f"[IA] Impossible de charger les notes mémoire: {e}")
        return ""


def process_chat_message_stream(message: str, regle_id: int = None, history: list = None):
    """
    Traite un message utilisateur via Gemini 1.5 Flash (Streaming).
    """
    client = get_gemini_client()

    context_msg = message
    if regle_id:
        memory_block = _load_context_notes_for_prompt(regle_id)
        context_msg = (
            f"[CONTEXTE CACHÉ — NE PAS AFFICHER À L'UTILISATEUR]\n"
            f"L'utilisateur consulte actuellement la règle de prime ID={regle_id}.\n"
            f"- Utilise get_regle_info_tool({regle_id}) pour répondre aux questions sur le contenu de la règle.\n"
            f"- Utilise list_available_kpis_tool() pour lister les KPIs disponibles.\n"
            f"- Pour RENOMMER la version active : utilise rename_grille_version_tool({regle_id}, nouveau_nom) DIRECTEMENT.\n"
            f"- Pour MODIFIER une grille existante : utilise D'ABORD get_active_grille_json_tool({regle_id}), applique les modifications, puis prepare_grille_proposal_tool({regle_id}, ...).\n"
            f"- Pour CRÉER une grille de zéro : utilise prepare_grille_proposal_tool({regle_id}, ...) directement.\n"
            f"- Pour objectifs REALISTES : appelle get_real_performance_tool({regle_id}, mois) AVANT de créer/modifier une grille.\n"
            f"- Pour sauvegarder une décision importante : utilise save_context_note_tool({regle_id}, note).\n"
            f"{memory_block}\n"
            f"[FIN DU CONTEXTE CACHÉ]\n\n"
            f"Message de l'utilisateur : {message}"
        )

    formatted_history = []
    if history:
        for h in history:
            role = 'user' if h['sender'] == 'user' else 'model'
            formatted_history.append(
                types.Content(role=role, parts=[types.Part.from_text(text=h['text'])])
            )

    try:
        chat = client.chats.create(
            model='gemini-2.5-flash',
            history=formatted_history,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.2,
                tools=[get_regle_info_tool, list_available_kpis_tool, get_context_notes_tool,
                       save_context_note_tool, get_active_grille_json_tool,
                       get_real_performance_tool, prepare_grille_proposal_tool,
                       save_grille_config_tool, update_regle_metadata_tool,
                       rename_grille_version_tool]
            )
        )

        response = chat.send_message(context_msg)
        final_text = response.text or ""
        logger.info(f"[Gemini] Réponse reçue ({len(final_text)} chars) pour regle_id={regle_id}")

        CHUNK_SIZE = 12
        for i in range(0, len(final_text), CHUNK_SIZE):
            yield final_text[i:i + CHUNK_SIZE]

    except Exception as e:
        logger.error(f"Erreur Gemini : {e}", exc_info=True)
        yield f"\n[Erreur technique lors de la génération: {str(e)}]"


def process_chat_message(message: str, regle_id: int = None, history: list = None):
    """
    Traite un message utilisateur via Gemini 1.5 Flash (Bloquant).
    """
    client = get_gemini_client()

    context_msg = message
    if regle_id:
        memory_block = _load_context_notes_for_prompt(regle_id)
        context_msg = (
            f"[CONTEXTE CACHÉ — NE PAS AFFICHER À L'UTILISATEUR]\n"
            f"L'utilisateur consulte actuellement la règle de prime ID={regle_id}.\n"
            f"- Utilise get_regle_info_tool({regle_id}) pour répondre aux questions sur le contenu de la règle.\n"
            f"- Utilise list_available_kpis_tool() pour lister les KPIs disponibles.\n"
            f"- Pour RENOMMER la version active : utilise rename_grille_version_tool({regle_id}, nouveau_nom) DIRECTEMENT.\n"
            f"- Pour MODIFIER une grille existante : utilise D'ABORD get_active_grille_json_tool({regle_id}), applique les modifications, puis prepare_grille_proposal_tool({regle_id}, ...).\n"
            f"- Pour CRÉER une grille de zéro : utilise prepare_grille_proposal_tool({regle_id}, ...) directement.\n"
            f"- Pour objectifs REALISTES : appelle get_real_performance_tool({regle_id}, mois) AVANT de créer/modifier une grille.\n"
            f"- Pour sauvegarder une décision importante : utilise save_context_note_tool({regle_id}, note).\n"
            f"{memory_block}\n"
            f"[FIN DU CONTEXTE CACHÉ]\n\n"
            f"Message de l'utilisateur : {message}"
        )

    formatted_history = []
    if history:
        for h in history:
            role = 'user' if h['sender'] == 'user' else 'model'
            formatted_history.append(
                types.Content(role=role, parts=[types.Part.from_text(text=h['text'])])
            )

    try:
        chat = client.chats.create(
            model='gemini-2.5-flash',
            history=formatted_history,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.2,
                tools=[get_regle_info_tool, list_available_kpis_tool, get_context_notes_tool,
                       save_context_note_tool, get_active_grille_json_tool,
                       get_real_performance_tool, prepare_grille_proposal_tool,
                       save_grille_config_tool, update_regle_metadata_tool,
                       rename_grille_version_tool]
            )
        )

        response = chat.send_message(context_msg)
        return {"response": response.text}
    except Exception as e:
        logger.error(f"Erreur Gemini : {e}")
        raise e
