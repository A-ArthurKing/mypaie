from google.cloud import bigquery
from dotenv import load_dotenv

load_dotenv('backend/.env')
client = bigquery.Client()

q = f"SELECT table_catalog, table_schema, table_name FROM \{client.project}.region-eu.INFORMATION_SCHEMA.TABLES\ WHERE LOWER(table_name) LIKE '%venum%'"

try:
    for r in client.query(q).result():
        print(dict(r))
except Exception as e:
    print(e)
