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

tables_to_drop = [
    f"{PROJECT_ID}.{DATASET_PAIE}.paie_performance",
    f"{PROJECT_ID}.{DATASET_PAIE}.paie_performance_mensuelle"
]

for table in tables_to_drop:
    print(f"Suppression de la table {table}...")
    client.query(f"DROP TABLE IF EXISTS `{table}`").result()

print("Tables supprimées avec succès ! ✅")
