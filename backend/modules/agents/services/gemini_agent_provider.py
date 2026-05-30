"""
Fichier : gemini_agent_provider.py
Rôle    : Gère la communication avec l'API Google Gemini.
          Utilise le moteur AI segmenté (prompts et tools séparés).
Module  : mypaie / backend / services / agents
"""

import os
import re
import json
import logging
from google import genai
from google.genai import types

from modules.agents.services.ai_engine.prompts import SYSTEM_PROMPT
from modules.agents.services.ai_engine.tools import (
    get_regle_info_tool,
    list_available_kpis_tool,
    resolve_kpi_names_tool,
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

_gemini_client = None

def get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY non configurée dans .env")
        _gemini_client = genai.Client(api_key=api_key)
    return _gemini_client


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


def _detect_kpi_confirmations(history: list) -> list:
    """
    Scans user messages for KPI confirmation patterns emitted by the select_kpi handler.
    Format: 'Pour "X", j\'utilise le KPI : [Y] – Z'
    Returns list of confirmed user_names (e.g. ["DMT", "CVR Naturelle"]).
    """
    confirmed = []
    for h in (history or []):
        if h.get('sender') == 'user':
            matches = re.findall(
                r'Pour\s+"([^"]+)",\s+j\'utilise le KPI',
                h.get('text') or '',
                re.IGNORECASE
            )
            confirmed.extend(matches)
    return confirmed


def _extract_last_grille_json(history: list) -> str | None:
    """
    Scans history in reverse for the last bot message containing a json_grille_proposal block.
    Extracts and returns the raw JSON string, or None if not found / invalid.
    """
    if not history:
        return None
    for h in reversed(history):
        if h.get('sender') == 'bot':
            text = h.get('text') or ''
            match = re.search(r'```json_grille_proposal\s*([\s\S]*?)\s*```', text)
            if match:
                candidate = match.group(1).strip()
                try:
                    json.loads(candidate)   # validate it's real JSON
                    return candidate
                except Exception:
                    logger.warning("[IA] json_grille_proposal trouvé mais JSON invalide — ignoré")
    return None


def _build_context_msg(message: str, regle_id: int, history: list) -> str:
    """Builds the hidden-context prefix injected before every user message sent to Gemini."""
    memory_block    = _load_context_notes_for_prompt(regle_id)
    last_grille_json = _extract_last_grille_json(history)
    confirmed_kpis   = _detect_kpi_confirmations(history)

    # ── Bloc multi-tours (grille déjà proposée) ───────────────────────────────
    if last_grille_json:
        creation_block = (
            f"\n"
            f"🔴 MULTI-TOURS EN COURS — JSON DE LA GRILLE ACTUELLE :\n"
            f"```json\n{last_grille_json}\n```\n\n"
            f"INSTRUCTIONS OBLIGATOIRES :\n"
            f"  1. PRENDS CE JSON comme point de départ.\n"
            f"  2. FUSIONNE les nouvelles instructions de l'utilisateur dans ce JSON.\n"
            f"  3. APPELLE get_real_performance_tool({regle_id}, '') — vérifie kpis_sans_donnees.\n"
            f"  4. APPELLE prepare_grille_proposal_tool({regle_id}, nom, json_fusionné_complet).\n"
            f"  5. Résumé complet + simulation 3 agents dans le message texte.\n"
            f"  ⛔ NE PAS appeler get_active_grille_json_tool.\n"
            f"  ⛔ NE PAS émettre de cartes kpi_selection_request — phase déjà terminée.\n"
        )
        phase_state = ""  # phase_state absorbed into creation_block

    # ── Phase 1 terminée, KPIs confirmés, pas encore de proposition ──────────
    elif confirmed_kpis:
        creation_block = ""
        phase_state = (
            f"\n✅ PHASE 1 COMPLÉTÉE — KPIs confirmés par l'utilisateur : {confirmed_kpis}\n"
            f"→ PASSE À LA PHASE 2 : présente le récapitulatif texte, demande confirmation.\n"
            f"→ Ensuite PHASE 3 : get_real_performance_tool puis prepare_grille_proposal_tool.\n"
            f"⛔ NE PAS ré-émettre de cartes kpi_selection_request.\n"
            f"⛔ NE PAS appeler prepare_grille_proposal_tool maintenant — attends la confirmation Phase 2.\n"
        )

    # ── Phase 1 non démarrée (premier tour de création) ──────────────────────
    else:
        creation_block = ""
        phase_state = (
            f"\n🔴 PHASE 1 NON DÉMARRÉE — Aucun KPI confirmé dans cette conversation.\n"
            f"⛔ INTERDICTION ABSOLUE d'appeler prepare_grille_proposal_tool ou save_grille_config_tool.\n"
            f"→ Si l'utilisateur décrit des indicateurs/KPIs :\n"
            f"   1. Appelle resolve_kpi_names_tool({regle_id}, '[\"nom1\", \"nom2\", ...]')\n"
            f"   2. Émets les blocs kpi_selection_request (un par KPI)\n"
            f"   3. STOP — attends que l'utilisateur valide chaque carte.\n"
            f"→ Tu ne peux PAS aller en Phase 2 ou Phase 3 dans ce tour.\n"
        )

    return (
        f"[CONTEXTE CACHÉ — NE PAS AFFICHER À L'UTILISATEUR]\n"
        f"L'utilisateur consulte la règle de prime ID={regle_id}.\n"
        f"- get_regle_info_tool({regle_id}) → infos règle.\n"
        f"- rename_grille_version_tool({regle_id}, nom) → renommer version active.\n"
        f"- get_active_grille_json_tool({regle_id}) + prepare_grille_proposal_tool → modifier grille existante.\n"
        f"- save_context_note_tool({regle_id}, note) → mémoriser une décision.\n"
        f"- ⛔ NE PAS faire les correspondances KPI en texte libre. ⛔ NE PAS appeler list_available_kpis_tool pour mapper.\n"
        f"{phase_state}"
        f"{creation_block}"
        f"{memory_block}\n"
        f"[FIN DU CONTEXTE CACHÉ]\n\n"
        f"Message de l'utilisateur : {message}"
    )


def process_chat_message_stream(message: str, regle_id: int = None, history: list = None):
    """
    Traite un message utilisateur via Gemini (Streaming).
    """
    client = get_gemini_client()

    context_msg = _build_context_msg(message, regle_id, history) if regle_id else message

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
                tools=[get_regle_info_tool, list_available_kpis_tool, resolve_kpi_names_tool,
                       get_context_notes_tool, save_context_note_tool, get_active_grille_json_tool,
                       get_real_performance_tool, prepare_grille_proposal_tool,
                       save_grille_config_tool, update_regle_metadata_tool,
                       rename_grille_version_tool]
            )
        )

        full_text = []
        for chunk in chat.send_message_stream(context_msg):
            part = chunk.text or ""
            if part:
                full_text.append(part)
                yield part

        logger.info(f"[Gemini] Stream terminé ({sum(len(p) for p in full_text)} chars) pour regle_id={regle_id}")

    except Exception as e:
        logger.error(f"Erreur Gemini : {e}", exc_info=True)
        yield f"\n[Erreur technique lors de la génération: {str(e)}]"


def process_chat_message(message: str, regle_id: int = None, history: list = None):
    """
    Traite un message utilisateur via Gemini (Bloquant).
    """
    client = get_gemini_client()

    context_msg = _build_context_msg(message, regle_id, history) if regle_id else message

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
                tools=[get_regle_info_tool, list_available_kpis_tool, resolve_kpi_names_tool,
                       get_context_notes_tool, save_context_note_tool, get_active_grille_json_tool,
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
