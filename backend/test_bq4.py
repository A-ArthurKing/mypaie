from config.dw_api_bigquery_connector import get_bigquery_client
import os
client = get_bigquery_client()
t = client.get_table(f"{os.getenv('GCP_PROJECT_ID')}.dataset_pvcp.pvcp_data_outils_client_performance")
for f in t.schema:
    print(f.name, f.field_type)
