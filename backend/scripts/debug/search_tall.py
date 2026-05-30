import os
from google.cloud import bigquery
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv('.env.docker')

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "data-project-438313")
cred_path = os.path.abspath("gcp-credentials.json")
if os.path.exists(cred_path): os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_path

client = bigquery.Client(project=PROJECT_ID)

# Liste de tous les datasets
datasets = [d.dataset_id for d in client.list_datasets()]
for ds in datasets:
    tables = client.list_tables(ds)
    for t in tables:
        if "tall" in t.table_id.lower():
            print(f"Trouvé: {ds}.{t.table_id}")
