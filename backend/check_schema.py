import os
import json
from google.cloud import bigquery
from dotenv import load_dotenv

load_dotenv()

client = bigquery.Client()
project_id = os.getenv("GCP_PROJECT_ID")
dataset_id = os.getenv("BQ_DATASET_PERF")
table_id = os.getenv("BQ_TABLE_PERF")

table_ref = f"{project_id}.{dataset_id}.{table_id}"
try:
    table = client.get_table(table_ref)
    print(json.dumps([{"name": f.name, "type": f.field_type} for f in table.schema], indent=2))
except Exception as e:
    print(f"Error: {e}")
