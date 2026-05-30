"""Debug: teste le pipeline complet pour les 2 agents"""
import sys, json
sys.path.insert(0, '/app')

from modules.performance.services.dw_api_performance_provider import get_perf_totaux_par_matricule, _load_nom_matricule_mapping

print("=== Mapping nom→matricule pour 9701 et 11904 ===")
mapping = _load_nom_matricule_mapping(['9701', '11904'])
print(f"  {mapping}")

print("\n=== get_perf_totaux pour 9701 et 11904 (2026-04) ===")
result = get_perf_totaux_par_matricule('2026-04-01', '2026-04-30', ['9701', '11904'])
print(f"  Clés retournées: {list(result.keys())}")
for mat, data in result.items():
    print(f"\n  Agent {mat}:")
    for k in ['Duration_call', 'Conversion_Agent', 'ABV_NBR', 'Hold_Time_Ratio']:
        print(f"    {k}: {data.get(k)}")

print("\n=== get_unified_agent_data (2026-04) ===")
from modules.regles_primes.services.kpi_unified_resolver import get_unified_agent_data
unified = get_unified_agent_data('2026-04-01', '2026-04-30', ['9701', '11904'])
print(f"  Clés retournées: {list(unified.keys())}")
for mat, data in unified.items():
    print(f"\n  Agent {mat}:")
    for k in ['Duration_call', 'Conversion_Agent', 'ABV_NBR', 'Hold_Time_Ratio', 'QUALITE']:
        print(f"    {k}: {data.get(k)}")
