import os
from google.cloud import bigquery
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv('.env.docker')

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "data-project-438313")
DATASET_PAIE = os.getenv("BQ_DATASET_PAIE", "gcp_my_paie")
cred_path = os.path.abspath("gcp-credentials.json")
if os.path.exists(cred_path): os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_path

client = bigquery.Client(project=PROJECT_ID)
TABLE_CONFIG = f"`{PROJECT_ID}.{DATASET_PAIE}.config_etl_sources`"

query = f"SELECT * FROM {TABLE_CONFIG} WHERE id = 9"
rows = client.query(query).result()
for row in rows:
    print(dict(row))
