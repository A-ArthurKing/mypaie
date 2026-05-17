"""
Fichier : calculation_engine.py
Rôle    : Moteur de calcul des primes (Atteinte d'objectifs).
          Prend une configuration de grille et les données KPIs (unifiées)
          pour produire le résultat financier final.
Module  : mypaie / backend / services / regles_primes
"""

import logging
from typing import Dict, Any, List
from modules.regles_primes.services.kpi_unified_resolver import get_unified_agent_data

logger = logging.getLogger(__name__)

def run_payout_calculation(regle: dict, matricules: List[str], date_debut: str, date_fin: str) -> Dict[str, Any]:
    """
    Exécute la boucle de calcul pour tous les agents d'une règle.
    """
    # 1. Résolution de TOUS les KPIs (Natifs + Virtuels) via le Cerveau Unifié
    # C'est ici que l'unification demandée à l'étape 4 opère.
    kpi_data = get_unified_agent_data(date_debut, date_fin, matricules)
    
    results = {}
    grille = regle.get("grille_objectifs", {})
    objectifs = grille.get("indicateurs", [])

    for mat in matricules:
        agent_kpis = kpi_data.get(str(mat), {})
        agent_result = {
            "kpis": agent_kpis,
            "objectifs_detail": [],
            "score_global": 0.0,
            "prime_finale": 0.0
        }

        # 2. Évaluation de l'atteinte des objectifs
        total_points = 0.0
        for obj in objectifs:
            metric_key = obj.get("metric_key")
            # Unification : on ne se soucie pas de savoir si c'est Natif ou Virtuel ici
            # On demande juste la valeur à notre dictionnaire agent_kpis
            val_reelle = agent_kpis.get(metric_key)
            
            # Logique de scoring (simplifiée pour l'exemple)
            # Dans un vrai moteur, on comparerait avec obj.get("cible")
            points = 0.0
            if val_reelle is not None:
                # Simulation de calcul de points
                points = 10.0 # TODO: Implémenter la logique réelle de la grille
            
            total_points += points
            agent_result["objectifs_detail"].append({
                "libelle": obj.get("nom"),
                "valeur": val_reelle,
                "points": points
            })

        agent_result["score_global"] = total_points
        results[str(mat)] = agent_result

    return results
