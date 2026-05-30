"""Script de diagnostic BigQuery Performance."""
import os, sys
sys.path.insert(0, '/app')

from config.dw_api_bigquery_connector import get_bigquery_client

GCP_PROJECT = os.environ.get('GCP_PROJECT_ID', 'data-project-438313')
BQ_DATASET  = os.environ.get('BQ_DATASET_PAIE', 'paie_data')
client = get_bigquery_client()
T = f"`{GCP_PROJECT}.{BQ_DATASET}.paie_performance_mensuelle`"

print("=== 1. Mois disponibles (tous agents) ===")
rows = list(client.query(f"SELECT DISTINCT mois FROM {T} ORDER BY mois DESC LIMIT 10").result())
for r in rows: print(" ", r['mois'])

print("\n=== 2. Matricules dans les 3 derniers mois ===")
rows = list(client.query(f"SELECT DISTINCT matricule, mois FROM {T} ORDER BY mois DESC LIMIT 30").result())
for r in rows: print(" ", r['matricule'], "|", r['mois'])

print("\n=== 3. KPI codes distincts dans la table ===")
rows = list(client.query(f"SELECT DISTINCT kpi_code FROM {T} LIMIT 30").result())
for r in rows: print(" ", r['kpi_code'])

print("\n=== 4. Recherche directe agents 11904 et 9701 ===")
q = f"SELECT matricule, mois, kpi_code, valeur_sum FROM {T} WHERE matricule IN ('11904', '9701') LIMIT 20"
rows = list(client.query(q).result())
if rows:
    for r in rows: print(" ", r['matricule'], r['mois'], r['kpi_code'], r['valeur_sum'])
else:
    print("  VIDE - ces matricules ne sont PAS dans la table perf")

print("\n=== 5. Recherche UPPERCASE ===")
q2 = f"SELECT matricule, mois, kpi_code FROM {T} WHERE UPPER(matricule) IN ('11904', '9701') LIMIT 10"
rows2 = list(client.query(q2).result())
if rows2:
    for r in rows2: print(" ", r['matricule'], r['mois'], r['kpi_code'])
else:
    print("  VIDE aussi en UPPER")
