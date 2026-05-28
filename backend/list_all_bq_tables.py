import os
from google.cloud import bigquery
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv('.env.docker')

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "data-project-438313")
cred_path = os.path.abspath("gcp-credentials.json")
if os.path.exists(cred_path): os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_path

client = bigquery.Client(project=PROJECT_ID)

datasets = ["dataset_pvcp", "gcp_my_paie", "dataproject_EvalPlus", "dataset_batisante", "dataset_venum"]

for ds in datasets:
    print(f"\n--- Dataset: {ds} ---")
    try:
        tables = client.list_tables(ds)
        for t in tables:
            print(f"Table: {t.table_id} ({t.table_type})")
    except Exception as e:
        print(f"Erreur pour {ds}: {e}")
