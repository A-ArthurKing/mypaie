import os
from google.cloud import bigquery
from dotenv import load_dotenv

load_dotenv()
client = bigquery.Client()
project = os.getenv('GCP_PROJECT_ID')

print("\n--- SAMPLE ---")
for r in client.query("SELECT * FROM " + project + ".dataset_venum.venum_data_outils_client_performance WHERE METRICS IS NOT NULL LIMIT 1").result():
    print(dict(r))
