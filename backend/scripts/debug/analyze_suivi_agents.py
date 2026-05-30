import os
from google.cloud import bigquery
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv('.env.docker')

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "data-project-438313")
cred_path = os.path.abspath("gcp-credentials.json")
if os.path.exists(cred_path): os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_path

client = bigquery.Client(project=PROJECT_ID)

table_ref = "data-project-438313.dataset_pvcp.pvcp_data_outils_client_suivi_agents_sortant"
table = client.get_table(table_ref)
print("Colonnes:", [f.name for f in table.schema])

print("\n--- Aperçu des 2 premières lignes ---")
query = f"SELECT * FROM `{table_ref}` LIMIT 2"
rows = client.query(query).result()
for row in rows:
    print(dict(row))
