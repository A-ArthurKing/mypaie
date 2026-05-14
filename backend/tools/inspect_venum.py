from google.cloud import bigquery
import os, sys
sys.path.append('/app')

client = bigquery.Client()

# Stats par canal
q1 = """
SELECT
  JSON_VALUE(METRICS, '$.CANAL_DU_TICKET') AS canal,
  COUNT(*) AS nb,
  COUNTIF(MATRICULE IS NOT NULL) AS avec_matricule,
  COUNTIF(SAFE_CAST(JSON_VALUE(METRICS, '$.DURATION') AS FLOAT64) IS NOT NULL) AS avec_duration,
  ROUND(AVG(SAFE_CAST(JSON_VALUE(METRICS, '$.DURATION') AS FLOAT64)), 2) AS avg_duration_min,
  ROUND(AVG(SAFE_CAST(JSON_VALUE(METRICS, '$.WAITING_TIME') AS FLOAT64)), 2) AS avg_wait_min,
  SUM(SAFE_CAST(JSON_VALUE(METRICS, '$.TICKETS') AS INT64)) AS total_tickets,
  SUM(SAFE_CAST(JSON_VALUE(METRICS, '$.TICKETS_RESOLUS') AS INT64)) AS total_resolus
FROM `dataset_venum.venum_data_outils_client_performance`
GROUP BY canal ORDER BY nb DESC
"""
print("=== KPIs par CANAL ===")
for r in client.query(q1).result():
    print(dict(r))

# Format MATRICULE
q2 = """
SELECT MATRICULE,
  CAST(SAFE_CAST(MATRICULE AS FLOAT64) AS INT64) AS matricule_clean
FROM `dataset_venum.venum_data_outils_client_performance`
WHERE MATRICULE IS NOT NULL
LIMIT 5
"""
print("\n=== FORMAT MATRICULE ===")
for r in client.query(q2).result():
    print(dict(r))

# Dates distinctes
q3 = """
SELECT DISTINCT DATE_TICKET, EXTRACT(ISOWEEK FROM DATE(DATE_TICKET)) AS sem,
  EXTRACT(ISOYEAR FROM DATE(DATE_TICKET)) AS an
FROM `dataset_venum.venum_data_outils_client_performance`
ORDER BY DATE_TICKET
"""
print("\n=== DATES/SEMAINES ===")
for r in client.query(q3).result():
    print(dict(r))
