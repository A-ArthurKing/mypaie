import sys
sys.path.insert(0, '/app')
from core.db.bigquery import get_bigquery_client
client = get_bigquery_client()
client.query("ALTER TABLE `data-project-438313.gcp_my_paie.config_etl_sources` ADD COLUMN IF NOT EXISTS scale_max FLOAT64").result()
client.query("UPDATE `data-project-438313.gcp_my_paie.config_etl_sources` SET scale_max = 9.0 WHERE projet_nom = 'PVCP_GE'").result()
client.query("UPDATE `data-project-438313.gcp_my_paie.config_etl_sources` SET scale_max = 100.0 WHERE projet_nom != 'PVCP_GE' AND scale_max IS NULL").result()
print("scale_max added and initialized.")
