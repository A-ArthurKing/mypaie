"""
Migration : Rename BQ column metier → sous_projet in paie_performance
Also renames ref_operations → ref_operations in MySQL
Run once on existing environments.
"""
import os
from google.cloud import bigquery
from dotenv import load_dotenv

load_dotenv()

PROJECT_ID = os.getenv("GCP_PROJECT_ID")
DATASET = os.getenv("BQ_DATASET_PAIE", "gcp_my_paie")
TABLE = os.getenv("BQ_TABLE_PAIE_PERF", "paie_performance")

client = bigquery.Client(project=PROJECT_ID)

# Rename metier -> sous_projet
sql = f"ALTER TABLE `{PROJECT_ID}.{DATASET}.{TABLE}` RENAME COLUMN metier TO sous_projet"
print(f"Running: {sql}")
client.query(sql).result()
print("Done! Column 'metier' renamed to 'sous_projet' in paie_performance.")
