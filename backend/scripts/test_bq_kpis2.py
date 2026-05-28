import json
import sys
sys.path.insert(0, '/app')
from core.db.bigquery import get_bigquery_client
import os
client = get_bigquery_client()
PROJECT_ID = os.getenv('GCP_PROJECT_ID', 'data-project-438313')
DATASET_PAIE = os.getenv('BQ_DATASET_PAIE', 'gcp_my_paie')

sql = f"""
SELECT DISTINCT kpi_code, 'PERFORMANCE' as univers FROM `{PROJECT_ID}.{DATASET_PAIE}.paie_performance_mensuelle`
UNION ALL
SELECT DISTINCT kpi_code, 'QUALITE' as univers FROM `{PROJECT_ID}.{DATASET_PAIE}.paie_qualite_mensuelle`
"""
try:
    rows = client.query(sql).result()
    bq_kpis = [dict(r) for r in rows]
    print(json.dumps(bq_kpis[:20], indent=2))
except Exception as e:
    print('error', e)
