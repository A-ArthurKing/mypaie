"""
Fichier : inspect_pvcp.py
Rôle    : Diagnostic ponctuel des données source PVCP avant ETL.
Module  : mypaie / backend / tools
"""
import os
from google.cloud import bigquery
from dotenv import load_dotenv

load_dotenv()
c = bigquery.Client()

src = "data-project-438313.dataset_pvcp.pvcp_data_outils_client_performance"

print("=== Distribution date_importation ===")
q1 = f"""
SELECT
  date_importation,
  COUNT(*) AS n,
  COUNT(DISTINCT MATRICULE) AS nb_agents,
  MIN(JSON_EXTRACT_SCALAR(METRICS, '$.woy_iso_desc_en')) AS woy_min,
  MAX(JSON_EXTRACT_SCALAR(METRICS, '$.woy_iso_desc_en')) AS woy_max
FROM `{src}`
GROUP BY date_importation
ORDER BY date_importation DESC
LIMIT 15
"""
for r in c.query(q1).result():
    print(dict(r))

print("\n=== Échantillon JSON METRICS ===")
q2 = f"SELECT METRICS FROM `{src}` WHERE METRICS IS NOT NULL LIMIT 2"
for r in c.query(q2).result():
    print(r["METRICS"][:600])
    print("---")

print("\n=== Clés disponibles dans METRICS ===")
q3 = f"""
SELECT DISTINCT
  JSON_EXTRACT_SCALAR(METRICS, '$.woy_iso_desc_en') AS woy,
  JSON_EXTRACT_SCALAR(METRICS, '$.month_relative_to_current') AS month_rel
FROM `{src}`
LIMIT 20
"""
for r in c.query(q3).result():
    print(dict(r))
