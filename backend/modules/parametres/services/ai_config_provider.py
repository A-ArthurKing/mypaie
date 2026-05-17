"""
Fichier : ai_config_provider.py
Rôle    : Utilise Gemini pour suggérer des libellés métiers à partir de codes techniques.
Module  : mypaie / backend / services / parametres
"""

import os
import re
import json
import logging
import google.generativeai as genai

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Dictionnaire de référence Call Center — patterns précis ordonnés par
# spécificité décroissante (les plus précis d'abord).
# Chaque entrée : (substring_to_match, libelle, description)
# ---------------------------------------------------------------------------
_KNOWN_PATTERNS = [
    # --- Temps précis ---
    ("in_hold_min",      "Temps de mise en attente (Hold)",
     "Nombre total de minutes durant lesquelles les agents ont mis les clients en attente sur la période."),
    ("in_call_min",      "Durée de conversation (Talk Time)",
     "Nombre total de minutes de communication active entre agents et clients sur la période."),
    ("call_worked_time", "Temps travaillé agent (Talk + Wrap-up)",
     "Temps total traité par l'agent incluant la conversation et le traitement après appel (ACW / wrap-up)."),
    ("acw",              "Temps de traitement après appel (ACW)",
     "Durée de wrap-up post-appel durant laquelle l'agent finalise les actions de suivi."),
    ("aht",              "Durée moyenne de traitement (AHT)",
     "Temps moyen total par appel : conversation + attente + wrap-up."),
    ("handle_time",      "Durée de traitement (Handle Time)",
     "Durée de traitement complète d'une interaction incluant talk, hold et ACW."),
    # --- Volumes ---
    ("booking_nbr",      "Nombre de réservations (Bookings)",
     "Volume total de réservations ou commandes enregistrées sur la période."),
    ("call_receipt",     "Appels reçus",
     "Nombre total d'appels entrants reçus par le centre de contacts."),
    ("call_answered",    "Appels répondus",
     "Nombre d'appels entrants ayant reçu une réponse d'un agent."),
    ("call_abandoned",   "Appels abandonnés",
     "Nombre d'appels raccrochés par le client avant d'être pris en charge."),
    ("call_offered",     "Appels présentés",
     "Nombre total d'appels présentés au centre de contacts (répondus + abandonnés)."),
    ("call_outbound",    "Appels sortants",
     "Nombre d'appels émis par les agents vers les clients."),
    ("_nbr",             "Volume",
     "Volume total d'occurrences ou d'événements enregistrés sur la période."),
    ("_count",           "Nombre",
     "Comptage total sur la période."),
    # --- Scores / ratios ---
    ("csat",             "Satisfaction Client (CSAT)",
     "Score moyen de satisfaction client mesuré après interaction, sur une échelle standardisée."),
    ("fcr",              "Résolution au premier appel (FCR)",
     "Taux d'appels résolus dès le premier contact, sans rappel nécessaire du client."),
    ("rate",             "Taux",
     "Indicateur de taux ou ratio mesuré sur la période."),
    ("score",            "Score",
     "Score composite ou évaluation mesurée sur la période."),
    # --- Qualité ---
    ("qualite",          "Score Qualité",
     "Score d'évaluation qualitative des interactions sur la période."),
    ("note",             "Note d'évaluation",
     "Note attribuée lors d'une évaluation qualité ou supervision."),
]


def _fallback_label(tech_code: str) -> dict:
    """Génère un libellé et description de fallback basé sur des patterns précis."""
    clean = tech_code.lower()
    for pattern, libelle, description in _KNOWN_PATTERNS:
        if pattern in clean:
            return {"libelle": libelle, "description": description}
    # Dernier recours : nettoyage brut du code
    return {
        "libelle": tech_code.replace("_", " ").title(),
        "description": "Indicateur de performance mesuré sur la période."
    }


def _parse_json_from_text(text: str) -> dict | None:
    """Extrait un objet JSON depuis une réponse texte Gemini (supporte les blocs markdown)."""
    # Nettoyer les blocs ```json ... ```
    text = re.sub(r'```(?:json)?\s*', '', text).strip()
    # Chercher le premier objet JSON complet
    match = re.search(r'\{[^{}]*"libelle"[^{}]*"description"[^{}]*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    # Essai sur tout le texte
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def suggest_kpi_label(tech_code: str, univers: str) -> dict:
    """
    Demande à Gemini de traduire un code technique BigQuery en libellé métier
    et description concrète, avec fallback robuste basé sur des patterns domaine.
    """
    fallback = _fallback_label(tech_code)
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY absent — fallback pattern utilisé pour '%s'", tech_code)
        return fallback

    prompt = f"""Tu es un expert en Centres de Contacts (Call Centers) et en analyse de données RH/paie.
Tu dois traduire un code technique BigQuery en libellé métier court et description précise.

Code technique : {tech_code}
Univers métier : {univers}

CONTEXTE DOMAINE OBLIGATOIRE — respecte ces définitions sans exception :
- in_call_min_nbr       → "Durée de conversation (Talk Time)" — temps actif de communication
- in_hold_min_nbr       → "Temps de mise en attente (Hold)" — client mis en attente par l'agent
- call_worked_time_*    → "Temps travaillé agent" — talk + wrap-up (ACW), PAS du hold
- acw / wrap            → traitement après appel (After Call Work)
- aht / handle_time     → AHT = talk + hold + ACW
- _nbr / _count         → volume / comptage
- _rate / _pct          → taux / pourcentage
- csat                  → satisfaction client

RÈGLES :
1. Le libellé doit être court (3-6 mots), en français, orienté métier (RH / managers).
2. La description doit être précise (1 phrase), éviter les généralités comme "indicateur de performance".
3. Ne JAMAIS confondre hold time (attente) et ACW (wrap-up post-appel).
4. Réponds UNIQUEMENT en JSON valide, sans markdown, sans explication.

FORMAT :
{{"libelle": "Nom Métier Court", "description": "Description précise en une phrase."}}"""

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            "gemini-1.5-flash",
            generation_config={"temperature": 0.2, "max_output_tokens": 256}
        )
        response = model.generate_content(prompt)
        text = response.text.strip()
        data = _parse_json_from_text(text)
        if data and data.get("libelle") and data.get("description"):
            return {
                "libelle": data["libelle"].strip(),
                "description": data["description"].strip()
            }
        logger.warning("JSON IA invalide pour '%s', fallback utilisé. Réponse : %s", tech_code, text[:200])
        return fallback

    except Exception as e:
        logger.error("Erreur IA pour '%s' : %s", tech_code, e)
        return fallback

