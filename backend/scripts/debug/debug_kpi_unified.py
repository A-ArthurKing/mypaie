"""Debug script: check what get_unified_agent_data returns for agent 7042"""
import sys, json
sys.path.insert(0, '/app')
from modules.regles_primes.services.kpi_unified_resolver import get_unified_agent_data

result = get_unified_agent_data('2026-05-01', '2026-05-31', ['7042'])
agent_data = result.get('7042', {})
print('Keys returned for agent 7042:')
for k, v in agent_data.items():
    if v is not None:
        print(f'  {k}: {v}')
    else:
        print(f'  {k}: None')

print()
print('Checking metric_key lookup (revenue_amt_eur):')
upper_map = {k.upper(): v for k, v in agent_data.items()}
print('REVENUE_AMT_EUR:', upper_map.get('REVENUE_AMT_EUR'))
print('QUALITE:', upper_map.get('QUALITE'))
