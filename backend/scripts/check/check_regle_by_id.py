"""Vérifie ce que retourne get_regle_by_id et compare avec la config active."""
import sys, json
sys.path.insert(0, '/app')
from modules.regles_primes.services.dw_api_regles_provider import get_regle_by_id

regle = get_regle_by_id(2)
print("Keys regle:", list(regle.keys()))
go = regle.get('grille_objectifs', {})
print("grille_objectifs type:", type(go).__name__)
if isinstance(go, dict):
    print("  Keys go:", list(go.keys()))
    inds = go.get('indicateurs', [])
    print("  Indicateurs (", len(inds), "):")
    for ind in inds:
        print("    metric_key='" + str(ind.get('metric_key','')) + "' nom='" + ind.get('nom','') + "'")
