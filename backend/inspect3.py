import os
from google.cloud import bigquery
from dotenv import load_dotenv

load_dotenv()
client = bigquery.Client()

for d in client.list_datasets():
    print(d.dataset_id)
    for t in client.list_tables(d.dataset_id):
        if 'venum' in t.table_id.lower() or 'pvcp' in t.table_id.lower() or 'performance' in t.table_id.lower():
            print("  ->", t.table_id)
