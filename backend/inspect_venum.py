import os
from google.cloud import bigquery
from dotenv import load_dotenv

load_dotenv()
client = bigquery.Client()

datasets = list(client.list_datasets())
found = False
for d in datasets:
    tables = list(client.list_tables(d.dataset_id))
    for t in tables:
        if 'venum' in t.table_id.lower():
            print(f"FOUND TABLE: {d.dataset_id}.{t.table_id}")
            table_ref = client.get_table(f"{client.project}.{d.dataset_id}.{t.table_id}")
            print("SCHEMA:")
            for field in table_ref.schema:
                print(f" - {field.name} ({field.field_type})")
            
            # Fetch 1 row to see METRICS json
            query = f"SELECT METRICS FROM \{client.project}.{d.dataset_id}.{t.table_id}\ WHERE METRICS IS NOT NULL LIMIT 1"
            try:
                rows = list(client.query(query).result())
                if rows:
                    print("\nSAMPLE METRICS JSON:")
                    print(dict(rows[0]))
            except Exception as e:
                print("Could not fetch metrics:", e)
            found = True

if not found:
    print("No table with 'venum' found.")
