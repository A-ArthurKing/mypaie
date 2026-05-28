import sys
sys.path.insert(0, '/app')
from core.db.bigquery import get_bigquery_client
client = get_bigquery_client()
PROJECT_ID = 'data-project-438313'
DATASET_PAIE = 'gcp_my_paie'
TABLE_PERF_SILVER = f"`{PROJECT_ID}.{DATASET_PAIE}.paie_performance`"
DDL_SILVER = f"CREATE TABLE IF NOT EXISTS {TABLE_PERF_SILVER} (matricule STRING NOT NULL, date_ref DATE NOT NULL, projet STRING NOT NULL, kpi_code STRING NOT NULL, kpi_value FLOAT64, processed_at TIMESTAMP NOT NULL) PARTITION BY date_ref CLUSTER BY matricule, projet, kpi_code"
client.query(DDL_SILVER).result()
print('paie_performance created.')
