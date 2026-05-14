import os
from google.cloud import bigquery
from dotenv import load_dotenv

load_dotenv()
client = bigquery.Client()
project = os.getenv('GCP_PROJECT_ID')

try:
    for d in client.list_datasets():
        # print("Check dataset: ", d.dataset_id)
        if 'venum' in d.dataset_id.lower() or 'pvcp' in d.dataset_id.lower():
            for t in client.list_tables(d.dataset_id):
                if 'venum' in t.table_id.lower():
                    print("Found:", d.dataset_id, t.table_id)
                    query = f"SELECT * FROM \{project}.{d.dataset_id}.{t.table_id}\ LIMIT 1"
                    rows = list(client.query(query).result())
                    print(dict(rows[0]) if rows else "Empty table")
except Exception as e:
    print(e)
