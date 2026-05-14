import os
from google.cloud import bigquery
from dotenv import load_dotenv

load_dotenv()
client = bigquery.Client()
project = os.getenv('GCP_PROJECT_ID')

t = client.get_table(f"{project}.dataset_venum.venum_data_outils_client_performance")
for f in t.schema:
    print(f.name, f.field_type)

print("\n--- SAMPLE ---")
for r in client.query(f"SELECT * FROM \{project}.dataset_venum.venum_data_outils_client_performance\ LIMIT 1").result():
    print(dict(r))
