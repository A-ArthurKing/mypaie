"""Debug: vérifie les KPI natifs BQ dans config_kpis"""
import sys
sys.path.insert(0, '/app')

from modules.performance.services.dw_api_performance_provider import _load_native_bq_kpi_definitions

defs = _load_native_bq_kpi_definitions()
print(f"\n=== {len(defs)} KPI natifs BQ dans config_kpis ===")
for d in defs:
    print(f"  code_kpi={d['code_kpi']}  bq_codes={d['bq_codes']}  agg={d['aggregation']}")

# Vérification de la résolution complète pour agent 9701
from modules.performance.services.dw_api_performance_provider import get_perf_totaux_par_matricule
result = get_perf_totaux_par_matricule('2026-04-01', '2026-04-30', ['11904', '9701'])
print(f"\n=== Résultat get_perf_totaux pour 9701 ===")
data_9701 = result.get('9701', {})
for k, v in data_9701.items():
    print(f"  {k}: {v}")

print(f"\n=== Clés manquantes pour la grille (Duration_call, Conversion_Agent, ABV_NBR...) ===")
expected = ['Duration_call', 'Conversion_Agent', 'ABV_NBR', 'Hold_Time_Ratio', 'Pct_Service_Revenue', 'ABV_Revenue', 'Revenue', 'Hold_Rate', 'AVR_CSAT', 'BKG']
for k in expected:
    present = k in data_9701 or k.upper() in data_9701 or k.lower() in data_9701
    val = data_9701.get(k) or data_9701.get(k.upper()) or data_9701.get(k.lower())
    print(f"  {k}: {'OK' if present else 'MANQUANT'}  val={val}")
