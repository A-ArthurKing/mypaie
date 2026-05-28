import os
from google.cloud import bigquery
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv('.env.docker')

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "data-project-438313")
cred_path = os.path.abspath("gcp-credentials.json")
if os.path.exists(cred_path): os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_path

client = bigquery.Client(project=PROJECT_ID)

query = """
SELECT table_schema, table_name 
FROM `data-project-438313.region-eu.INFORMATION_SCHEMA.TABLES`
WHERE table_name LIKE '%tall%' OR table_name LIKE '%performance%'
"""
rows = client.query(query).result()
for row in rows:
    print(f"{row.table_schema}.{row.table_name}")
