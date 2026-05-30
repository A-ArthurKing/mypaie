import os
from google.cloud import bigquery
from dotenv import load_dotenv

load_dotenv("backend/.env.docker")
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.abspath("backend/gcp-credentials.json")

PROJECT_ID = "data-project-438313"
DATASET = "gcp_my_paie"
client = bigquery.Client(project=PROJECT_ID)

q1 = f"SELECT projet, COUNT(*) c FROM `{PROJECT_ID}.{DATASET}.paie_qualite` GROUP BY projet ORDER BY c DESC"
q2 = f"SELECT COUNT(DISTINCT kpi_code) k FROM `{PROJECT_ID}.{DATASET}.paie_qualite_mensuelle` WHERE projet='PVCP'"
q3 = f"SELECT DISTINCT kpi_code FROM `{PROJECT_ID}.{DATASET}.paie_qualite_mensuelle` WHERE projet='PVCP' ORDER BY kpi_code LIMIT 15"

print("PROJETS SILVER QUALITE")
for r in client.query(q1).result():
    print(f"- {r.projet}: {r.c}")

print("\nNB KPI QUALITE PVCP (GOLD)")
for r in client.query(q2).result():
    print(f"- {r.k}")

print("\nSAMPLE KPI QUALITE PVCP (GOLD)")
for r in client.query(q3).result():
    print(f"- {r.kpi_code}")
