import os
from google.cloud import bigquery
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv('.env.docker')

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "data-project-438313")
cred_path = os.path.abspath("gcp-credentials.json")
if os.path.exists(cred_path): os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_path

client = bigquery.Client(project=PROJECT_ID)

table_ref = "data-project-438313.dataset_pvcp.vue_performance_tcd_dfr"
table = client.get_table(table_ref)
print([f.name for f in table.schema])
