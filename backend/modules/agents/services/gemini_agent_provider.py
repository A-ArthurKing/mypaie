"""
Fichier : gemini_agent_provider.py
Rôle    : Gère la communication avec l'API Google Gemini.
          Définit le persona de l'assistant, l'historique et les tools (Function Calling).
          Capacités : consultation règles, listing KPIs, création automatique de grilles.
Module  : mypaie / backend / services / agents
"""

import os
import json
import time
import logging
from google import genai
from google.genai import types

from modules.regles_primes.services.dw_api_regles_provider import get_regle_by_id, create_regle_config, get_regle_configs
from modules.parametres.services.mapping_provider import get_all_kpis_with_status
from core.socket import emit_update
from config.db_mysql_connector import get_mysql_connection

logger = logging.getLogger(__name__)

# ----------------------------------------------------------------------
# SYSTEM PROMPT
# ----------------------------------------------------------------------
SYSTEM_PROMPT = """
Tu es l'assistant IA de la plateforme "myPaie", un outil expert dans le paramétrage et la gestion des règles de calcul de primes.
Tu disposes d'outils (tools) pour interroger et mettre à jour la base de données. Utilise-les systématiquement.

═══════════════════════════════════════════════════════
RÈGLES DE COMPORTEMENT STRICTES
═══════════════════════════════════════════════════════

0. INTERDICTION ABSOLUE — AUCUNE SUPPRESSION :
   Tu n'as AUCUN droit de supprimer quoi que ce soit : ni grilles, ni versions, ni KPIs, ni agents, ni notes.
   Si l'utilisateur te demande de supprimer quelque chose, refuse poliment :
   "Je ne peux pas supprimer des données. Cette action doit être réalisée manuellement depuis l'interface."
   La seule action d'écriture autorisée est la PRÉPARATION d'une nouvelle version de grille via prepare_grille_proposal_tool,
   et la SAUVEGARDE de notes mémoire via save_context_note_tool.

1. DOMAINE EXCLUSIF :
   Si l'utilisateur pose une question hors sujet (météo, politique, code Python, etc.), refuse poliment et recentre sur ton domaine :
   "Je suis l'assistant myPaie, spécialisé dans les règles de primes. Je ne peux pas répondre à cette question."

2. ANALYSE INTELLIGENTE ET CLARIFICATIONS CIBLÉES :
   Quand l'utilisateur fournit un document de configuration détaillé, ANALYSE-LE TOI-MÊME avant de poser
   des questions. Utilise list_available_kpis_tool puis fais les correspondances KPI toi-même.

   CORRESPONDANCES AUTOMATIQUES (ne pas demander confirmation pour celles-ci) :
   - "chiffre d'affaires", "CA", "CA réalisé"              → metric_key='chiffre_affaire'
   - "note qualité", "qualité", "CSAT", "satisfaction"     → metric_key='csat_moyen'
   - "taux de conversion", "CVR", "ADD-ON", "panier moyen" → metric_key='taux_conversion_calc' ou 'nb_ventes'
   - "DMT", "durée moyenne", "temps de traitement"         → metric_key='dmt'
   - "heures", "assiduité en heures"                       → metric_key='logged_min'

   MÉTRIQUES SANS KPI DIRECT (signale-les proactivement, ne demande pas confirmation) :
   - Réclamations clients, absences injustifiées, retards, sanctions disciplinaires → PAS de KPI dédié.
     Ces conditions sont des MALUS FIXES (règles métier), pas des indicateurs mesurables.
     Explique : "Ces conditions (réclamations, absences, sanctions) sont des règles de malus appliquées
     en dehors des KPIs. Elles seront documentées dans la description de la règle mais ne peuvent pas
     être paramétrées comme des indicateurs dans la grille actuelle."

   PROCÉDURE pour un document détaillé fourni par l'utilisateur :
   a) Appelle list_available_kpis_tool() pour lire les KPIs disponibles
   b) Extrait automatiquement les informations du document (KPIs, montants, paliers, statuts, malus)
   c) Identifie le mode_prime adapté à chaque KPI (voir section FORMAT JSON ci-dessous)
   d) Présente tes PROPOSITIONS de mapping + lecture du document sous forme de récapitulatif
   e) Pose des questions UNIQUEMENT sur les éléments RÉELLEMENT ambigus ou manquants

   Si les statuts d'agents ne sont pas précisés : utilise directement un statut "Tous" et avance.
   Si les paliers globaux ne sont pas précisés pour un KPI en mode_prime="montant_direct" : ils ne sont pas nécessaires.
   Ne jamais bloquer la création d'une grille pour absence de statut ou de paliers globaux quand le calcul est direct.

3. CONTEXTE DE LA RÈGLE :
   Le frontend envoie toujours l'ID de la règle en cours. Utilise TOUJOURS get_regle_info_tool pour lire la règle
   avant de répondre à une question sur son contenu. Ne devine jamais les valeurs.

4. KPIs — PRÉSENTATION ET QUESTIONS TECHNIQUES :
   Quand tu PRÉSENTES les KPIs à l'utilisateur :
   - Montre UNIQUEMENT le libellé humain, ex : "Chiffre d'Affaires", "Satisfaction Client (CSAT)".
   - N'affiche JAMAIS les détails techniques (tech_key, code, unité, univers) SAUF si l'utilisateur
     le demande explicitement (ex: "quel est le tech_key de ce KPI ?").
   - Format correct : "• Chiffre d'Affaires", "• Taux de Conversion", "• Satisfaction Client (CSAT)"
   - Format INTERDIT : "(tech_key='csat_moyen', unité=%)" dans un message à l'utilisateur

   Si l'utilisateur demande "ce KPI est-il calculé à partir d'autres KPIs ?" ou "quelle est sa formule ?" :
   - Utilise le champ `description` retourné par list_available_kpis_tool pour répondre.
   - Si la description contient une formule, explique-la en langage naturel.
   - Si aucune description n'est disponible, dis-le honnêtement.

5. KPIs MANQUANTS :
   Si l'utilisateur mentionne un KPI qui n'existe pas dans la liste retournée par list_available_kpis_tool,
   signale-le explicitement : "⚠️ Le KPI '[nom]' n'est pas référencé dans la base. Voici les KPIs disponibles : ..."
   Propose un KPI alternatif similaire si possible.

6. CRÉATION AUTOMATIQUE DE GRILLE — APPEL IMMÉDIAT ET INCONDITIONNEL :
   ▸ RÈGLE ABSOLUE : Dès que tu as au moins UN KPI configuré + UN statut (ou "Tous" par défaut),
     appelle IMMÉDIATEMENT prepare_grille_proposal_tool — SANS demander de confirmation.
   ▸ INTERDICTIONS STRICTES — ces phrases sont PROHIBÉES :
     - "Souhaitez-vous que je prépare cette proposition ?"
     - "Voulez-vous que je génère la grille ?"
     - "Puis-je créer la grille ?"
     - "Avez-vous d'autres éléments avant que je génère la grille ?"
     Tu AGIS. Le récapitulatif vient APRÈS l'appel à l'outil, jamais avant.

   ▸ CONTEXTE MULTI-TOURS (l'utilisateur envoie les règles en plusieurs messages) :
     L'utilisateur peut envoyer les paliers CA en message 1, les malus en message 2,
     les règles métier en message 3, etc. À CHAQUE nouveau message :
     → Mémorise les nouveaux éléments reçus et FUSIONNE-LES avec ceux des tours précédents.
     → Appelle ENCORE UNE FOIS prepare_grille_proposal_tool avec le JSON COMPLET mis à jour.
     → N'attends pas que l'utilisateur "valide" pour appeler l'outil.
     Exemple :
     - Tour 1 (paliers CA) → appelle prepare_grille_proposal_tool avec les paliers CA
     - Tour 2 (malus CSAT) → appelle prepare_grille_proposal_tool avec CA + malus CSAT combinés
     - Tour 3 (règles métier) → appelle prepare_grille_proposal_tool avec CA + malus + règles métier

   ▸ Ne présente PAS le JSON brut dans ta réponse textuelle. L'outil s'en chargera et l'affichera
     à l'utilisateur sous forme de carte cliquable.

7. DONNÉES DE PERFORMANCE RÉELLES :
   Avant de créer ou modifier une grille, utilise SYSTÉMATIQUEMENT get_real_performance_tool(regle_id, mois)
   pour analyser les données historiques de l'équipe.
   - mois = mois de référence au format 'YYYY-MM' (ex: '2026-04'). Si l'utilisateur ne précise pas de mois,
     utilise le mois précédent automatiquement (laisse mois vide ou passe le mois courant - 1).
   - Cela te permet de proposer des objectifs RÉALISTES basés sur les vraies performances de l'équipe.
   - Formule type : "Le CSAT moyen de votre équipe est de 82% sur avril. Je vous suggère un objectif à 85%."
   - Si les données BigQuery sont indisponibles (erreur réseau), signale-le et propose des valeurs à l'utilisateur.

8. MÉMOIRE CONTEXTUELLE PERSISTANTE PAR RÈGLE :
   Tu disposes d'une mémoire permanente par règle, stockée en base de données.
   Elle te permet de te souvenir d'informations importantes d'une conversation à l'autre.

   LECTURE : Au début de chaque échange, les notes mémorisées te sont automatiquement fournies dans le contexte
   caché. Lis-les attentivement avant de répondre — elles contiennent des décisions passées, contraintes métier
   ou préférences de l'équipe.

   ÉCRITURE : Utilise save_context_note_tool(regle_id, note) dès que tu détectes une information importante
   à retenir pour les prochaines conversations. Exemples de notes à sauvegarder :
   - "KPI DMT retiré en mai 2026 à la demande du manager (trop pénalisant pour les nouveaux agents)"
   - "Les agents CDD sont saisonniers, les paliers doivent rester accessibles (seuil max 85%)"
   - "L'équipe préfère des primes fixes plutôt qu'un pourcentage du CA"
   - "Objectifs validés en réunion du 14/05/2026 : CSAT=85%, CVR=20%"
   Ne sauvegarde pas de notes redondantes ou triviales. Priorise les décisions et contraintes métier.
   Après avoir sauvegardé une note, confirme à l'utilisateur : "✅ J'ai mémorisé cette information pour nos
   prochaines conversations."

9. MODIFICATION D'UNE GRILLE EXISTANTE — SYSTÈME DE VERSIONS :
   La plateforme gère un historique complet des versions de grille. Tu NE DOIS JAMAIS modifier une grille
   en place : toute modification crée une NOUVELLE VERSION qui s'active automatiquement, l'ancienne étant
   conservée et restaurable à tout moment par l'utilisateur.

   ⚠️ DISTINCTION CRITIQUE — CRÉATION vs MODIFICATION :
   ▸ Si la règle N'A PAS de grille (get_regle_info_tool → grille_objectifs = null ou vide) :
     → C'est une CRÉATION depuis zéro. N'appelle JAMAIS get_active_grille_json_tool.
     → Construis le JSON directement à partir des informations fournies par l'utilisateur.
     → Si l'utilisateur ajoute des éléments en plusieurs tours, fusionne-les et re-génère.
   ▸ Si la règle A DÉJÀ une grille ET l'utilisateur demande EXPLICITEMENT de la modifier :
     → C'est une MODIFICATION. Applique la procédure ci-dessous.
   ▸ JAMAIS appeler get_active_grille_json_tool lors d'une conversation de CRÉATION,
     même si le dernier tour contenait un appel à prepare_grille_proposal_tool.

   PROCÉDURE OBLIGATOIRE pour toute MODIFICATION (grille existante uniquement) :
   a) Appelle get_active_grille_json_tool(regle_id) pour récupérer la grille active actuelle (JSON brut).
   b) Applique les modifications demandées sur ce JSON (ajouter/supprimer un KPI, changer un poids,
      modifier des cibles, ajuster des paliers, changer des montants, etc.).
   c) Génère un nom de version descriptif indiquant ce qui a changé, ex :
      "Modif IA – Ajout CSAT – Mai 2026" ou "Modif IA – Poids CVR 40→50 pts – Mai 2026".
   d) Appelle prepare_grille_proposal_tool(regle_id, nouveau_nom, json_modifié) pour proposer
      la nouvelle version à l'utilisateur.
   e) Dans le récapitulatif final, indique CLAIREMENT ce qui a changé par rapport à la version précédente.

   Exemples de modifications que tu dois savoir faire :
   - "Augmente le poids du CSAT de 30 à 40 pts" → modifier poids du KPI CSAT, redistribuer si total dépasse 100
   - "Ajoute le KPI Taux de Conversion à 20 pts" → ajouter l'indicateur, vérifier que total ≤ 100 pts
   - "Retire le KPI DMT" → supprimer l'indicateur et ses cibles dans tous les statuts
   - "Passe la prime CDI à 2500 DH" → modifier prime_brute du statut CDI
   - "Ajoute un palier Gold à 110% → 125%" → ajouter le palier dans le tableau paliers
   - "Change l'objectif CSAT du statut CDD à 85" → modifier la valeur dans statuts[CDD].cibles

═══════════════════════════════════════════════════════
FORMAT JSON DE LA GRILLE (pour prepare_grille_proposal_tool)
═══════════════════════════════════════════════════════

Le JSON DOIT respecter cette structure étendue. Les champs marqués [OPTIONNEL] peuvent être omis si non pertinents.

{
  "categories": ["Performance", "Qualité"],

  "indicateurs": [
    {
      "id": "kpi_<timestamp>",
      "nom": "Chiffre d'Affaires",
      "categorie": "Performance",
      "type": "decimal",
      "poids": 100,
      "metric_key": "chiffre_affaire",
      "type_ponderation": "bonus",
      "direction": "higher_better",

      // [OPTIONNEL] mode_prime — Comment ce KPI contribue à la prime finale.
      // "score_global" (DÉFAUT) : contribue au score % → % paiement × prime_brute du statut.
      // "montant_direct" : détermine directement le montant en DH, via paliers_valeur ci-dessous.
      // "pourcentage_valeur" : prime = taux% × valeur réelle du KPI.
      "mode_prime": "montant_direct",

      // [OPTIONNEL — requis si mode_prime = "montant_direct"]
      // Paliers basés sur la valeur ABSOLUE du KPI (plages → montant fixe ou % du KPI).
      // type_montant = "fixe" | "pourcentage_kpi"
      "paliers_valeur": [
        {"seuil_min": 0,      "seuil_max": 79999,  "montant": 0,     "type_montant": "fixe"},
        {"seuil_min": 80000,  "seuil_max": 84999,  "montant": 518.4, "type_montant": "fixe"},
        {"seuil_min": 85000,  "seuil_max": 89999,  "montant": 826.2, "type_montant": "fixe"},
        {"seuil_min": 90000,  "seuil_max": 94999,  "montant": 1166.4,"type_montant": "fixe"},
        {"seuil_min": 125000, "seuil_max": null,    "montant": 11.3,  "type_montant": "pourcentage_kpi"}
      ],

      // [OPTIONNEL] malus_conditions — Malus gradués appliqués au montant final selon la valeur de ce KPI.
      // Utiliser pour : note qualité par paliers, panier moyen ADD-ON, etc.
      "malus_conditions": [
        {"seuil_min": 80, "seuil_max": 84.99, "malus_pct": 5,  "description": "CSAT entre 80% et 84%"},
        {"seuil_min": 75, "seuil_max": 79.99, "malus_pct": 10, "description": "CSAT entre 75% et 79%"},
        {"seuil_min": 0,  "seuil_max": 74.99, "malus_pct": 15, "description": "CSAT inférieur à 75%"}
      ]
    }
  ],

  "statuts": [
    {
      "nom": "Tous",                                // Si statut non précisé par l'utilisateur, utiliser "Tous"
      "prime_brute": 2000,
      "montant_sb": 0,
      "cibles": { "kpi_<timestamp>": 90 }
    }
  ],

  "paliers": [
    { "id": 1, "label": "Insuffisant", "seuil_atteinte": 70,   "pourcentage_paiement": 0,   "couleur": "#f87171", "locked": false },
    { "id": 2, "label": "Partiel",     "seuil_atteinte": 85,   "pourcentage_paiement": 50,  "couleur": "#f59e0b", "locked": false },
    { "id": 3, "label": "Correct",     "seuil_atteinte": 100,  "pourcentage_paiement": 75,  "couleur": "#38bdf8", "locked": false },
    { "id": 4, "label": "Atteint",     "seuil_atteinte": null, "pourcentage_paiement": 100, "couleur": "#22c55e", "locked": false }
  ],

  // [OPTIONNEL] regles_metier — Conditions non calculables automatiquement (réclamations, sanctions, absences).
  // Ces règles sont visibles dans le tableau de bord pour application manuelle par le responsable.
  "regles_metier": [
    {
      "description": "1 réclamation client sur le mois → perte totale de la prime",
      "type": "disqualifiant",
      "source": "humain"
    },
    {
      "description": "1 absence injustifiée ou 4 retards → 50% de la prime perdue",
      "type": "malus_conditionnel",
      "source": "humain"
    },
    {
      "description": "2 absences injustifiées ou 8 retards ou sanction → perte totale de la prime",
      "type": "disqualifiant",
      "source": "humain"
    }
  ]
}

RÈGLES D'UTILISATION DU SCHÉMA ÉTENDU :

A. PRIME BASÉE SUR PALIERS CA (ex: 80k€→518 MAD, >125k€→11.3% du CA) :
   → Utiliser mode_prime="montant_direct" + paliers_valeur[]
   → La prime_brute du statut est ignorée pour ce KPI (elle peut rester à 0)
   → NE PAS utiliser les paliers globaux (champ "paliers") pour ce type de calcul

B. MALUS GRADUÉS PAR KPI (ex: CSAT 80-84%→-5%, 75-79%→-10%, <75%→-15%) :
   → Utiliser malus_conditions[] directement sur l'indicateur concerné
   → Ce KPI reste dans indicateurs[] avec type_ponderation="malus" ET mode_prime="score_global"
   → NE PAS retirer le KPI de la grille sous prétexte qu'il est un malus

C. MALUS FIXE PAR SEUIL (ex: ADD-ON < 70% → -5%) :
   → Utiliser malus_conditions[] avec un seul palier
   → {"seuil_min": 0, "seuil_max": 69.99, "malus_pct": 5, "description": "Panier moyen ADD-ON < 70%"}

D. RÈGLES MÉTIER INCOMPATIBLES AVEC LE MOTEUR (réclamations, absences, sanctions) :
   → Les stocker dans regles_metier[] avec type "disqualifiant" ou "malus_conditionnel"
   → Ces règles sont documentées et visibles mais ne sont pas calculées automatiquement
   → TOUJOURS informer l'utilisateur : "Ces règles sont stockées pour information. L'application est manuelle."

E. STATUT PAR DÉFAUT :
   → Si l'utilisateur ne précise pas les statuts d'agents, utiliser un seul statut nom="Tous"
   → Ne jamais bloquer la création de grille pour absence de statut

F. RÉTROCOMPATIBILITÉ :
   → Les champs mode_prime, paliers_valeur, malus_conditions, regles_metier sont OPTIONNELS
   → Les grilles sans ces champs continuent de fonctionner avec l'ancienne logique (score_global)
"""


def get_gemini_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY non configurée dans .env")
    return genai.Client(api_key=api_key)


# ----------------------------------------------------------------------
# TOOLS (Outils pour Gemini)
# ----------------------------------------------------------------------

def get_regle_info_tool(regle_id: int) -> str:
    """
    Retourne TOUTES les informations d'une règle de prime (description, KPIs, objectifs, paliers)
    à partir de son identifiant (regle_id).
    À utiliser obligatoirement dès qu'une question porte sur le contenu de la règle courante.
    """
    logger.info(f"[IA Tool] get_regle_info_tool → regle_id={regle_id}")
    try:
        regle_data = get_regle_by_id(regle_id)
        if not regle_data:
            return f"Erreur: Aucune règle trouvée pour l'ID {regle_id}."

        info = f"--- RÈGLE ID {regle_data['id']} ---\n"
        info += f"Code: {regle_data['code']}\n"
        info += f"Nom: {regle_data['nom']}\n"
        info += f"Projet: {regle_data.get('projet', 'Global')}\n"
        info += f"Description: {regle_data.get('description', 'Aucune description')}\n"
        info += f"Statut: {'Active' if regle_data['actif'] else 'Inactive'}\n\n"

        info += "--- GRILLE D'OBJECTIFS (KPIs / PALIERS) ---\n"
        if regle_data.get('grille_objectifs'):
            info += json.dumps(regle_data['grille_objectifs'], indent=2, ensure_ascii=False)
        else:
            info += "Aucune grille d'objectifs configurée pour cette règle."

        return info
    except Exception as e:
        logger.error(f"[IA Tool] Erreur get_regle_info_tool: {e}")
        return f"Erreur interne lors de la récupération de la règle: {str(e)}"


def get_active_grille_json_tool(regle_id: int) -> str:
    """
    Retourne le JSON BRUT et COMPLET de la grille d'objectifs actuellement active pour une règle.
    À utiliser OBLIGATOIREMENT comme première étape avant toute modification de grille.
    Retourne aussi la liste des autres versions disponibles (non actives) pour information.

    Paramètre :
    - regle_id : ID de la règle dans matrice_primes
    """
    logger.info(f"[IA Tool] get_active_grille_json_tool → regle_id={regle_id}")
    try:
        # 1. Chercher la config active dans matrice_primes_configs
        conn = get_mysql_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, libelle, content, grille_nom, created_at "
                    "FROM matrice_primes_configs WHERE matrice_id = %s AND est_active = 1 LIMIT 1",
                    (regle_id,)
                )
                active_row = cur.fetchone()

                # Toutes les versions pour info
                cur.execute(
                    "SELECT id, libelle, grille_nom, est_active, created_at "
                    "FROM matrice_primes_configs WHERE matrice_id = %s ORDER BY grille_ordre ASC, created_at DESC",
                    (regle_id,)
                )
                all_versions = cur.fetchall()
        finally:
            conn.close()

        result = ""

        if active_row:
            content = active_row['content']
            if isinstance(content, str):
                content = json.loads(content)
            result += f"=== GRILLE ACTIVE (version ID={active_row['id']}) ===\n"
            result += f"Nom : {active_row.get('grille_nom') or active_row['libelle']}\n"
            result += f"Créée le : {active_row['created_at']}\n\n"
            result += "JSON COMPLET DE LA GRILLE (à modifier puis renvoyer via prepare_grille_proposal_tool) :\n"
            result += json.dumps(content, indent=2, ensure_ascii=False)
        else:
            # Fallback : grille_objectifs directe sur la règle
            regle_data = get_regle_by_id(regle_id)
            if regle_data and regle_data.get('grille_objectifs'):
                result += "=== GRILLE ACTIVE (depuis grille_objectifs de la règle) ===\n"
                result += "JSON COMPLET DE LA GRILLE :\n"
                result += json.dumps(regle_data['grille_objectifs'], indent=2, ensure_ascii=False)
            else:
                result += "⚠️ Aucune grille active trouvée pour cette règle. "
                result += "Utilise prepare_grille_proposal_tool pour en proposer une nouvelle."

        if all_versions:
            result += "\n\n=== HISTORIQUE DES VERSIONS ===\n"
            for v in all_versions:
                active_flag = " ← ACTIVE" if v['est_active'] else ""
                result += f"  • ID={v['id']} | {v.get('grille_nom') or v['libelle']} | {v['created_at']}{active_flag}\n"

        return result
    except Exception as e:
        logger.error(f"[IA Tool] Erreur get_active_grille_json_tool: {e}", exc_info=True)
        return f"❌ Erreur interne lors de la récupération de la grille : {str(e)}"


def get_context_notes_tool(regle_id: int) -> str:
    """
    Retourne toutes les notes mémorisées (mémoire persistante) pour une règle donnée.
    Ces notes contiennent les décisions, contraintes et préférences enregistrées lors
    des conversations précédentes. À lire systématiquement en début de conversation.

    Paramètre :
    - regle_id : ID de la règle dans matrice_primes
    """
    logger.info(f"[IA Tool] get_context_notes_tool → regle_id={regle_id}")
    try:
        conn = get_mysql_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, note, created_at FROM ai_regle_context "
                    "WHERE regle_id = %s ORDER BY created_at ASC",
                    (regle_id,)
                )
                rows = cur.fetchall()
        finally:
            conn.close()

        if not rows:
            return f"Aucune note mémorisée pour la règle ID={regle_id}. C'est la première interaction avec cette règle."

        lines = [f"=== MÉMOIRE CONTEXTUELLE — Règle ID {regle_id} ({len(rows)} note(s)) ==="]
        for r in rows:
            lines.append(f"  [{r['created_at']}] {r['note']}")
        lines.append("=== FIN DE LA MÉMOIRE ===")
        return "\n".join(lines)
    except Exception as e:
        logger.error(f"[IA Tool] Erreur get_context_notes_tool: {e}", exc_info=True)
        return f"❌ Erreur lors de la lecture de la mémoire : {str(e)}"


def save_context_note_tool(regle_id: int, note: str) -> str:
    """
    Sauvegarde une note permanente dans la mémoire contextuelle de la règle.
    Cette note sera disponible dans toutes les conversations futures concernant cette règle.
    À utiliser pour mémoriser des décisions, contraintes métier ou préférences importantes.

    Paramètres :
    - regle_id : ID de la règle dans matrice_primes
    - note     : Texte de la note à mémoriser (concis, factuel, actionnable)

    IMPORTANT : N'utilise PAS cet outil pour des informations triviales ou temporaires.
    Réserve-le aux décisions durables qui influenceront les prochaines configurations.
    """
    logger.info(f"[IA Tool] save_context_note_tool → regle_id={regle_id}, note='{note[:80]}...'")
    if not note or not note.strip():
        return "❌ La note est vide. Rien n'a été sauvegardé."
    try:
        conn = get_mysql_connection()
        try:
            with conn.cursor() as cur:
                # Vérifier que la règle existe
                cur.execute("SELECT id FROM matrice_primes WHERE id = %s", (regle_id,))
                if not cur.fetchone():
                    return f"❌ Règle ID={regle_id} introuvable. Note non sauvegardée."
                cur.execute(
                    "INSERT INTO ai_regle_context (regle_id, note) VALUES (%s, %s)",
                    (regle_id, note.strip())
                )
                conn.commit()
                note_id = cur.lastrowid
        finally:
            conn.close()
        logger.info(f"[IA Tool] Note mémorisée ID={note_id} pour regle_id={regle_id}")
        return f"✅ Note mémorisée (ID={note_id}) pour la règle ID={regle_id}."
    except Exception as e:
        logger.error(f"[IA Tool] Erreur save_context_note_tool: {e}", exc_info=True)
        return f"❌ Erreur lors de la sauvegarde de la note : {str(e)}"


def get_real_performance_tool(regle_id: int, mois: str) -> str:
    """
    Interroge les données de performance RÉELLES de l'équipe associée à la règle
    pour un mois donné, et retourne des statistiques agrégées (min, moy, max, médiane)
    par KPI (performance, qualité, heures) accompagnées de suggestions d'objectifs réalistes.

    Paramètres :
    - regle_id : ID de la règle (permet de déterminer les agents ciblés via la structure)
    - mois     : Mois au format 'YYYY-MM' (ex: '2026-04'). Si vide, utilise le mois précédent.

    Utilisation typique : appelle cet outil AVANT de créer/modifier une grille pour proposer
    des objectifs basés sur l'historique réel plutôt que des valeurs arbitraires.
    """
    import statistics
    from modules.performance.services.dw_api_performance_provider import get_perf_totaux_par_matricule
    from modules.notes_qualite.services.dw_api_qualite_provider import get_qualite_totaux_par_matricule
    from modules.heures_agents.services.dw_api_heures_provider import get_totaux_par_matricule

    logger.info(f"[IA Tool] get_real_performance_tool → regle_id={regle_id}, mois={mois}")

    # ── 1. Résoudre la plage de dates ──────────────────────────────────────────
    try:
        if mois and len(mois) >= 7:
            year, month = int(mois[:4]), int(mois[5:7])
        else:
            import datetime as _dt
            today = _dt.date.today()
            # Mois précédent par défaut
            first_this = today.replace(day=1)
            prev = first_this - _dt.timedelta(days=1)
            year, month = prev.year, prev.month
            mois = f"{year}-{month:02d}"

        import calendar
        last_day = calendar.monthrange(year, month)[1]
        date_debut = f"{year}-{month:02d}-01"
        date_fin   = f"{year}-{month:02d}-{last_day}"
    except Exception as e:
        return f"❌ Format de mois invalide (attendu YYYY-MM) : {e}"

    # ── 2. Récupérer les matricules liés à la règle ────────────────────────────
    try:
        conn = get_mysql_connection()
        try:
            with conn.cursor() as cur:
                # Lire la structure de la règle
                cur.execute(
                    "SELECT id_structure FROM matrice_primes WHERE id = %s", (regle_id,)
                )
                row = cur.fetchone()
                if not row or not row.get('id_structure'):
                    return f"⚠️ La règle ID={regle_id} n'a pas de structure associée. Impossible de déterminer les agents ciblés."

                id_structure = row['id_structure']
                cur.execute(
                    "SELECT id_projet, id_operation, id_sous_projet, id_activite "
                    "FROM ref_structure_map WHERE id = %s",
                    (id_structure,)
                )
                struct = cur.fetchone()
                if not struct:
                    return f"⚠️ Structure ID={id_structure} introuvable."

                # Agents correspondant à cette branche
                sql_agents = """
                    SELECT e.matricule, e.nom, e.prenom
                    FROM ref_employes e
                    JOIN ref_structure_map m ON e.id_structure = m.id
                    WHERE m.id_projet = %s
                """
                params_agents = [struct['id_projet']]
                if struct['id_operation']:
                    sql_agents += " AND m.id_operation = %s"
                    params_agents.append(struct['id_operation'])
                if struct['id_sous_projet']:
                    sql_agents += " AND m.id_sous_projet = %s"
                    params_agents.append(struct['id_sous_projet'])
                if struct['id_activite']:
                    sql_agents += " AND m.id_activite = %s"
                    params_agents.append(struct['id_activite'])

                cur.execute(sql_agents, tuple(params_agents))
                agents_rows = cur.fetchall()
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"[IA Tool] Erreur récupération agents: {e}", exc_info=True)
        return f"❌ Erreur lors de la récupération des agents de la règle : {str(e)}"

    if not agents_rows:
        return (
            f"⚠️ Aucun agent trouvé pour la règle ID={regle_id} "
            f"(structure non configurée ou aucun agent rattaché)."
        )

    matricules = [str(a['matricule']) for a in agents_rows if a.get('matricule')]
    nb_agents  = len(matricules)

    # ── 3. Appels aux providers (BigQuery + MySQL) ─────────────────────────────
    perf_map    = {}
    qualite_map = {}
    heures_map  = {}
    errors      = []

    try:
        perf_map = get_perf_totaux_par_matricule(date_debut, date_fin, matricules)
    except Exception as e:
        errors.append(f"Performance (BigQuery) : {e}")
        logger.warning(f"[IA Tool] Perf indisponible: {e}")

    try:
        qualite_map = get_qualite_totaux_par_matricule(date_debut, date_fin, matricules)
    except Exception as e:
        errors.append(f"Qualité (BigQuery) : {e}")
        logger.warning(f"[IA Tool] Qualité indisponible: {e}")

    try:
        heures_map = get_totaux_par_matricule(date_debut, date_fin, matricules)
    except Exception as e:
        errors.append(f"Heures (MySQL) : {e}")
        logger.warning(f"[IA Tool] Heures indisponible: {e}")

    # ── 4. Calcul des statistiques ─────────────────────────────────────────────
    def _stats(values):
        vals = [v for v in values if v is not None]
        if not vals:
            return None
        return {
            "min":    round(min(vals), 2),
            "max":    round(max(vals), 2),
            "moy":    round(sum(vals) / len(vals), 2),
            "median": round(statistics.median(vals), 2),
            "n":      len(vals),
        }

    def _suggest_target(s, higher_better=True):
        """Suggère un objectif = médiane + ~5-10% dans la bonne direction."""
        if not s:
            return None
        med = s["median"]
        moy = s["moy"]
        ref = max(med, moy)  # Prendre le meilleur des deux comme base
        if higher_better:
            return round(ref * 1.07, 2)   # +7% au-dessus de la médiane/moy
        else:
            return round(ref * 0.93, 2)   # -7% en dessous (lower_better ex: DMT)

    # Performance metrics
    kpi_perf = {
        "cvr":        ([p.get("cvr")           for p in perf_map.values()], True,  "%",    "Taux de Conversion"),
        "csat_moyen": ([p.get("csat_moyen")     for p in perf_map.values()], True,  "%",    "CSAT Moyen"),
        "dmt":        ([p.get("dmt")            for p in perf_map.values()], False, "sec",  "DMT (Durée Moy. Traitement)"),
        "tx_mea":     ([p.get("tx_mea")         for p in perf_map.values()], False, "%",    "Taux Mise en Attente"),
        "avg_ca":     ([p.get("avg_ca")         for p in perf_map.values()], True,  "DH",   "CA Moyen"),
        "avg_nbr":    ([p.get("avg_nbr")        for p in perf_map.values()], True,  "",     "Panier Moyen"),
        "nb_ventes":  ([p.get("nb_ventes")      for p in perf_map.values()], True,  "u",    "Nb Ventes"),
        "nb_appels":  ([p.get("nb_appels")      for p in perf_map.values()], True,  "u",    "Nb Appels"),
    }

    # Heures en heures décimales (ms → h)
    def ms_to_h(ms):
        return round(ms / 3600000, 2) if ms else None

    kpi_heures = {
        "heure_total": ([ms_to_h(h.get("total")) for h in heures_map.values()], True, "h", "Heures Totales"),
        "heure_hp":    ([ms_to_h(h.get("hp"))    for h in heures_map.values()], True, "h", "Heures de Production"),
    }

    # Qualité
    kpi_qualite = {
        "note_globale": ([v for v in qualite_map.values()], True, "/100", "Note Qualité Globale"),
    }

    # ── 5. Construction du rapport ─────────────────────────────────────────────
    out = f"## Données réelles de l'équipe — {mois}\n\n"
    out += f"**Règle ID {regle_id}** | **{nb_agents} agent(s) ciblé(s)** | "
    out += f"Période : {date_debut} → {date_fin}\n\n"

    if errors:
        out += f"⚠️ Certaines sources sont indisponibles : {'; '.join(errors)}\n\n"

    def _section(title, kpi_dict, data_map):
        s = f"### {title}\n"
        has_data = False
        for key, (values, higher, unite, label) in kpi_dict.items():
            st = _stats(values)
            if not st:
                continue
            has_data = True
            direction = "↑ higher_better" if higher else "↓ lower_better"
            suggest   = _suggest_target(st, higher)
            s += (
                f"- **{label}** (`{key}`) [{unite}] — {direction}\n"
                f"  - Min={st['min']} | Moy={st['moy']} | Médiane={st['median']} | Max={st['max']} "
                f"({st['n']}/{nb_agents} agents avec données)\n"
            )
            if suggest is not None:
                s += f"  - 💡 **Objectif suggéré : {suggest} {unite}** "
                s += f"(~{'⬆' if higher else '⬇'} 7% vs médiane)\n"
        if not has_data:
            s += "_Aucune donnée disponible pour cette source sur la période._\n"
        return s + "\n"

    out += _section("Performance (BigQuery)", kpi_perf, perf_map)
    out += _section("Qualité (BigQuery)", kpi_qualite, qualite_map)
    out += _section("Heures (MySQL)", kpi_heures, heures_map)

    out += (
        "---\n"
        "**Comment utiliser ces données :**\n"
        "Utilise les objectifs suggérés (💡) comme base pour configurer les cibles de la grille. "
        "Adapte selon le niveau d'exigence voulu : objectifs suggérés = légèrement ambitieux mais atteignables. "
        "Pour un niveau plus challengeant, utilise la valeur Max. Pour un niveau accessible, utilise la Moy.\n"
    )

    return out


def list_available_kpis_tool() -> str:
    """
    Retourne la liste de TOUS les KPIs standards disponibles dans la base de données
    (code, libellé, unité, univers, tech_key, description, statut actif).
    À utiliser pour proposer des KPIs à l'utilisateur ou valider qu'un KPI existe avant de créer une grille.
    """
    logger.info("[IA Tool] list_available_kpis_tool → listing all KPIs")
    try:
        kpis = get_all_kpis_with_status()
        if not kpis:
            return "Aucun KPI standard n'est configuré dans la base de données."

        lines = ["--- KPIs DISPONIBLES ---\n"]
        current_univers = None
        for k in kpis:
            if k['univers'] != current_univers:
                current_univers = k['univers']
                lines.append(f"\n[Univers: {current_univers}]")
            statut = "✅ Actif" if k['actif'] else "❌ Inactif"
            lines.append(
                f"  • tech_key='{k['tech_key'] or k['code'].lower()}' | code={k['code']} | "
                f"libellé={k['libelle']} | unité={k.get('unite','—')} | {statut}"
            )
            if k.get('description'):
                lines.append(f"    ↳ {k['description']}")

        return "\n".join(lines)
    except Exception as e:
        logger.error(f"[IA Tool] Erreur list_available_kpis_tool: {e}")
        return f"Erreur interne lors de la récupération des KPIs: {str(e)}"


def prepare_grille_proposal_tool(regle_id: int, grille_nom: str, grille_json: str) -> str:
    """
    Valide et génère une PROPOSITION de grille d'objectifs pour une règle de prime.
    La grille n'est PAS créée en base de données immédiatement. Elle est retournée
    sous forme de code markdown JSON pour être affichée à l'utilisateur avec un bouton
    de validation.

    Paramètres :
    - regle_id   : ID de la règle dans matrice_primes
    - grille_nom : Nom de la version de grille (ex: "Grille IA - Mai 2026")
    - grille_json: La grille au format JSON string, respectant la structure documentée dans le prompt système.

    Retourne un résumé de la proposition et le bloc JSON formaté.
    """
    logger.info(f"[IA Tool] prepare_grille_proposal_tool → regle_id={regle_id}, nom='{grille_nom}'")
    try:
        # 1. Parser le JSON
        try:
            grille = json.loads(grille_json) if isinstance(grille_json, str) else grille_json
        except json.JSONDecodeError as e:
            return f"❌ Erreur : Le JSON fourni est invalide. Détail : {e}"

        # 2. Valider la présence des clés obligatoires
        required_keys = ['indicateurs', 'statuts', 'paliers']
        missing = [k for k in required_keys if k not in grille]
        if missing:
            return f"❌ Erreur : Le JSON de grille est incomplet. Clés manquantes : {', '.join(missing)}"

        # 3. Valider que les tech_key existent dans la base
        all_kpis = get_all_kpis_with_status()
        valid_tech_keys = {k['tech_key'] for k in all_kpis if k.get('tech_key')}
        valid_codes     = {k['code'].lower() for k in all_kpis}

        kpis_not_found = []
        for ind in grille.get('indicateurs', []):
            mk = ind.get('metric_key', '')
            if mk and mk not in valid_tech_keys and mk not in valid_codes:
                kpis_not_found.append(mk)

        if kpis_not_found:
            return (
                f"⚠️ Les KPIs suivants sont introuvables dans la base : {', '.join(kpis_not_found)}. "
                f"Vérifie les tech_key via list_available_kpis_tool et corrige la grille avant de réessayer."
            )

        # 4. S'assurer que les IDs d'indicateurs sont uniques (générer si nécessaire)
        seen_ids = set()
        for i, ind in enumerate(grille.get('indicateurs', [])):
            if not ind.get('id') or ind['id'] in seen_ids:
                ind['id'] = f"kpi_{int(time.time())}_{i}"
            seen_ids.add(ind['id'])

        # 5. Vérifier la règle cible
        regle_data = get_regle_by_id(regle_id)
        if not regle_data:
            return f"❌ Erreur : Aucune règle trouvée pour l'ID {regle_id}."

        # 6. (Désactivé) On ne crée plus directement en base, c'est le front qui s'en charge via le bouton
        # result = create_regle_config(...)
        # emit_update(...)

        # 8. Construire le résumé pour l'utilisateur
        nb_kpis   = len(grille.get('indicateurs', []))
        nb_statuts = len(grille.get('statuts', []))
        nb_paliers = len(grille.get('paliers', []))

        resume = f"✅ Grille **'{grille_nom}'** créée et activée avec succès pour la règle '{regle_data['nom']}' (ID {regle_id}).\n\n"
        resume += f"**Résumé de la configuration :**\n"
        resume += f"- {nb_kpis} KPI(s) configuré(s)\n"
        resume += f"- {nb_statuts} statut(s) d'agent(s) ciblé(s)\n"
        resume += f"- {nb_paliers} palier(s) de paiement\n\n"

        resume += "**KPIs et poids :**\n"
        total_poids = sum(float(i.get('poids', 0)) for i in grille.get('indicateurs', []))
        for ind in grille.get('indicateurs', []):
            resume += f"  • {ind.get('nom', ind.get('metric_key'))} → {ind.get('poids', 0)} pts ({ind.get('metric_key')})\n"
        resume += f"  Total : {total_poids} pts\n\n"

        resume += "**Formule globale :**\n"
        kpi_parts = [
            f"({ind.get('nom', ind.get('metric_key'))} × {ind.get('poids', 0)} pts)"
            for ind in grille.get('indicateurs', [])
        ]
        resume += f"  Score = [{' + '.join(kpi_parts)}] / {total_poids} pts\n\n"

        resume += "**Objectifs par statut :**\n"
        for s in grille.get('statuts', []):
            cibles_txt = ', '.join(
                f"{next((ind['nom'] for ind in grille['indicateurs'] if ind['id'] == kid), kid)}={val}"
                for kid, val in (s.get('cibles') or {}).items()
            )
            resume += f"  • {s['nom']} : prime={s.get('prime_brute', 0)} DH"
            if s.get('montant_sb'):
                resume += f" + {s['montant_sb']} SB"
            resume += f" | Cibles : {cibles_txt or '—'}\n"

        resume += "\n**Paliers de paiement :**\n"
        for p in grille.get('paliers', []):
            seuil = f"≥{p['seuil_atteinte']}%" if p.get('seuil_atteinte') else "Au-delà"
            resume += f"  • {p.get('label', '?')} ({seuil}) → {p.get('pourcentage_paiement', 0)}% de la prime\n"

        # Au lieu de créer en base, on retourne le JSON formaté pour que le frontend affiche le bouton
        resume += f"\nVoici le bloc de validation pour le frontend :\n"
        
        # Emballer le JSON complet de la proposition, en rajoutant le nom
        grille_output = dict(grille)
        grille_output["nom"] = grille_nom
        
        resume += "\n```json_grille_proposal\n"
        resume += json.dumps(grille_output, indent=2, ensure_ascii=False)
        resume += "\n```\n"

        return resume

    except Exception as e:
        logger.error(f"[IA Tool] Erreur prepare_grille_proposal_tool: {e}", exc_info=True)
        return f"❌ Erreur interne lors de la création de la grille : {str(e)}"


# ----------------------------------------------------------------------
# TRAITEMENT DU CHAT
# ----------------------------------------------------------------------
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
    Traite un message utilisateur via Gemini 2.5 Flash.

    Stratégie : mode bloquant (AFC gère le tool-calling loop complet),
    puis pseudo-streaming du texte final par petits morceaux.
    Raison : google-genai==0.3.0 ne supporte pas le tool-calling automatique
    en mode stream — le flux s'arrête au premier chunk 'function_call'.
    """
    client = get_gemini_client()

    context_msg = message
    if regle_id:
        memory_block = _load_context_notes_for_prompt(regle_id)
        context_msg = (
            f"[CONTEXTE CACHÉ — NE PAS AFFICHER À L'UTILISATEUR]\n"
            f"L'utilisateur consulte actuellement la règle de prime ID={regle_id}.\n"
            f"- Utilise get_regle_info_tool({regle_id}) pour lire la règle si la question concerne son contenu.\n"
            f"- Utilise list_available_kpis_tool() pour lister les KPIs disponibles.\n"
            f"- Pour MODIFIER une grille existante : utilise D'ABORD get_active_grille_json_tool({regle_id}) pour récupérer le JSON actuel, applique les modifications, puis appelle prepare_grille_proposal_tool({regle_id}, ...) avec le JSON modifié — cela créera une proposition.\n"
            f"- Pour CRÉER une grille de zéro : utilise prepare_grille_proposal_tool({regle_id}, ...) directement.\n"
            f"- Pour proposer des objectifs RÉALISTES basés sur les données historiques : appelle get_real_performance_tool({regle_id}, mois) AVANT de créer/modifier une grille (mois = YYYY-MM, ex: '2026-04').\n"
            f"- Pour sauvegarder une décision/contrainte importante : utilise save_context_note_tool({regle_id}, note).\n"
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
                       get_real_performance_tool, prepare_grille_proposal_tool]
            )
        )

        # Mode bloquant : AFC exécute les tools automatiquement jusqu'à la réponse finale
        response = chat.send_message(context_msg)
        final_text = response.text or ""
        logger.info(f"[Gemini] Réponse reçue ({len(final_text)} chars) pour regle_id={regle_id}")

        # Pseudo-streaming : on découpe le texte en petits morceaux
        CHUNK_SIZE = 12
        for i in range(0, len(final_text), CHUNK_SIZE):
            yield final_text[i:i + CHUNK_SIZE]

    except Exception as e:
        logger.error(f"Erreur Gemini : {e}", exc_info=True)
        yield f"\n[Erreur technique lors de la génération: {str(e)}]"


def process_chat_message(message: str, regle_id: int = None, history: list = None):
    """
    Traite un message utilisateur via Gemini avec les outils branchés.
    """
    client = get_gemini_client()

    # Prompt contextualisé avec l'ID de la règle en cours
    context_msg = message
    if regle_id:
        # Charger les notes mémoire persistantes automatiquement
        memory_block = _load_context_notes_for_prompt(regle_id)

        context_msg = (
            f"[CONTEXTE CACHÉ — NE PAS AFFICHER À L'UTILISATEUR]\n"
            f"L'utilisateur consulte actuellement la règle de prime ID={regle_id}.\n"
            f"- Utilise get_regle_info_tool({regle_id}) pour lire la règle si la question concerne son contenu.\n"
            f"- Utilise list_available_kpis_tool() pour lister les KPIs disponibles.\n"
            f"- Pour MODIFIER une grille existante : utilise D'ABORD get_active_grille_json_tool({regle_id}) pour récupérer le JSON actuel, applique les modifications, puis appelle prepare_grille_proposal_tool({regle_id}, ...) avec le JSON modifié — cela créera une proposition.\n"
            f"- Pour CRÉER une grille de zéro : utilise prepare_grille_proposal_tool({regle_id}, ...) directement.\n"
            f"- Pour proposer des objectifs RÉALISTES basés sur les données historiques : appelle get_real_performance_tool({regle_id}, mois) AVANT de créer/modifier une grille (mois = YYYY-MM, ex: '2026-04').\n"
            f"- Pour sauvegarder une décision/contrainte importante : utilise save_context_note_tool({regle_id}, note).\n"
            f"{memory_block}\n"
            f"[FIN DU CONTEXTE CACHÉ]\n\n"
            f"Message de l'utilisateur : {message}"
        )

    # Préparation de l'historique pour Gemini
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
                tools=[get_regle_info_tool, list_available_kpis_tool, get_context_notes_tool, save_context_note_tool, get_active_grille_json_tool, get_real_performance_tool, prepare_grille_proposal_tool]
            )
        )

        response = chat.send_message(context_msg)
        return {"response": response.text}
    except Exception as e:
        logger.error(f"Erreur Gemini : {e}")
        raise e
