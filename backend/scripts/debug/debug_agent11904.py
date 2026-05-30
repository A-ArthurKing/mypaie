"""Debug: cherche AIT BELAID FATIMA ZAHRA dans BigQuery"""
import sys
sys.path.insert(0, '/app')

from config.dw_api_bigquery_connector import get_bigquery_client, GCP_PROJECT_ID, BQ_DATASET_PAIE

client = get_bigquery_client()
table = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.paie_performance_mensuelle`"

sql = f"""
    SELECT UPPER(matricule) as nom, mois, kpi_code, valeur_avg
    FROM {table}
    WHERE UPPER(matricule) LIKE 'AIT BELAID%'
    ORDER BY mois DESC
    LIMIT 20
"""
rows = list(client.query(sql).result())
if rows:
    for r in rows:
        print(f"  {r['nom']:40s} | {r['mois']} | {r['kpi_code']}: {r['valeur_avg']}")
else:
    print("  AIT BELAID FATIMA ZAHRA introuvable dans paie_performance_mensuelle")
    # Cherchons la liste complète des agents disponibles
    sql2 = f"SELECT DISTINCT matricule FROM {table} ORDER BY matricule LIMIT 50"
    rows2 = list(client.query(sql2).result())
    print(f"\n  Agents disponibles:")
    for r in rows2:
        print(f"    {r['matricule']}")
