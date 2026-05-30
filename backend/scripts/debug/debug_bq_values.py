"""Debug: inspecte les valeurs BQ pour les KPIs de la grille active"""
import sys
sys.path.insert(0, '/app')

from config.dw_api_bigquery_connector import get_bigquery_client, GCP_PROJECT_ID, BQ_DATASET_PAIE
from google.cloud import bigquery

client = get_bigquery_client()
table = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.paie_performance_mensuelle`"

# Chercher les valeurs pour agent EL BRINI OUMAIMA en avril 2026
sql = f"""
    SELECT kpi_code, valeur_sum, valeur_avg, nb_jours, mois
    FROM {table}
    WHERE UPPER(matricule) = 'EL BRINI OUMAIMA'
      AND LOWER(kpi_code) IN ('duration_call', 'conversion_agent', 'abv_nbr', 'hold_time_ratio')
      AND mois = '2026-04'
    ORDER BY kpi_code
"""

rows = list(client.query(sql).result())
print(f"\n=== Valeurs BQ pour EL BRINI OUMAIMA (2026-04) ===")
print(f"{'kpi_code':25s}  {'valeur_sum':12s}  {'valeur_avg':12s}  {'nb_jours':8s}")
for r in rows:
    print(f"  {r['kpi_code']:23s}  {str(r['valeur_sum']):12s}  {str(r['valeur_avg']):12s}  {str(r['nb_jours']):8s}")

if not rows:
    print("  VIDE - cherchons sans filtre kpi_code")
    sql2 = f"""
        SELECT kpi_code, valeur_sum, valeur_avg, nb_jours
        FROM {table}
        WHERE UPPER(matricule) = 'EL BRINI OUMAIMA'
          AND mois = '2026-04'
        ORDER BY kpi_code
    """
    rows2 = list(client.query(sql2).result())
    print(f"  Tous les KPIs pour cet agent ce mois:")
    for r in rows2:
        print(f"  {r['kpi_code']:23s}  sum={r['valeur_sum']}  avg={r['valeur_avg']}")
