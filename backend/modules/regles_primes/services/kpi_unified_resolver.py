"""
Fichier : kpi_unified_resolver.py
Rôle    : Service d'unification des données KPIs (Performance, Qualité, Heures).
          C'est le "Cerveau" qui assemble les briques Lego pour le moteur de paie.
Module  : mypaie / backend / services / regles_primes
"""

import logging
from typing import List, Optional, Dict, Any
from modules.performance.services.dw_api_performance_provider import get_perf_totaux_par_matricule
from modules.notes_qualite.services.dw_api_qualite_provider import get_qualite_totaux_par_matricule
from modules.heures_agents.services.dw_api_heures_provider import get_totaux_par_matricule as get_heures_totaux
from tools.kpi_engine import evaluate_formula, get_kpi_registry

logger = logging.getLogger(__name__)

def get_unified_agent_data(
    date_debut: str,
    date_fin: str,
    matricules: List[str],
    nom_matricule_map: Optional[Dict[str, str]] = None
) -> Dict[str, Dict[str, Any]]:
    """
    Récupère et fusionne toutes les sources de données pour une liste d'agents.
    Calcule ensuite les KPIs virtuels sur le contexte global.
    Retourne { matricule: { "KPI_A": val, "KPI_B": val, ... } }
    """
    if not matricules:
        return {}

    # 1. Récupération des données brutes en parallèle (logique)
    perf_data   = get_perf_totaux_par_matricule(date_debut, date_fin, matricules)
    qualite_map = get_qualite_totaux_par_matricule(date_debut, date_fin, matricules, nom_matricule_map)
    heures_map  = get_heures_totaux(date_debut, date_fin, matricules)

    # 2. Chargement du dictionnaire des KPIs pour les formules
    kpi_registry = get_kpi_registry()

    unified_results = {}

    for mat in matricules:
        mat_str = str(mat)
        
        # --- Construction du Contexte Global pour cet agent ---
        # On commence par les données de performance
        ctx = perf_data.get(mat_str, {}).copy()
        
        # Ajout de la Qualité (Standard: NOTE_QUALITE)
        score_qualite = qualite_map.get(mat_str)
        ctx["NOTE_QUALITE"] = score_qualite
        ctx["note_qualite"] = score_qualite # Fallback lowercase
        
        # Ajout des Heures (en heures décimales pour les calculs)
        h_data = heures_map.get(mat_str, {})
        ctx["HEURE_HP"]    = h_data.get("hp", 0) / 3600000
        ctx["HEURE_HT"]    = h_data.get("ht", 0) / 3600000
        ctx["HEURE_HF"]    = h_data.get("hf", 0) / 3600000
        ctx["HEURE_HC"]    = h_data.get("hc", 0) / 3600000
        ctx["HEURE_TOTAL"] = h_data.get("total", 0) / 3600000
        
        # Fallbacks lowercase pour les heures
        ctx.update({
            "heure_hp": ctx["HEURE_HP"],
            "heure_ht": ctx["HEURE_HT"],
            "heure_total": ctx["HEURE_TOTAL"]
        })

        # --- Évaluation des KPIs Virtuels ---
        # On parcourt le registre et on calcule tout ce qui est virtuel
        for code, kpi in kpi_registry.items():
            if kpi.get('type') == 'VIRTUAL' and kpi.get('formule'):
                # On ne calcule que s'il n'est pas déjà présent (les hardcodés du provider perf gagnent)
                if code not in ctx:
                    ctx[code] = evaluate_formula(kpi['formule'], ctx, kpi_registry)

        unified_results[mat_str] = ctx

    return unified_results
