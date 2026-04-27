import os
from google.cloud import bigquery
from dotenv import load_dotenv

load_dotenv()
c = bigquery.Client()

q = """
SELECT METRICS 
FROM `data-project-438313.dataset_pvcp.pvcp_data_outils_client_performance` 
WHERE JSON_EXTRACT_SCALAR(METRICS, '$.csat_nbr') > '0'
LIMIT 2
"""
for r in c.query(q).result():
    print(r["METRICS"])
