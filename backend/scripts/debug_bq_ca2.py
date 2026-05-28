"""Debug : voir TOUTES les lignes CA pour agent 7042"""
import sys
sys.path.insert(0, '/app')
from core.db.bigquery import get_bigquery_client
client = get_bigquery_client()

print("=== Toutes les lignes kpi_code contenant 'revenue' ou 'booking' ou 'chiffre' pour 7042 ===")
q = """
    SELECT matricule, mois, kpi_code, valeur_sum, valeur_avg, nb_jours
    FROM `data-project-438313.gcp_my_paie.paie_performance_mensuelle`
    WHERE matricule = '7042'
      AND mois = '2026-05'
    ORDER BY kpi_code
"""
all_rows = list(client.query(q).result())
print(f"Nb total de lignes pour 7042 / 2026-05 : {len(all_rows)}")
print()
for row in all_rows:
    if any(k in (row['kpi_code'] or '').lower() for k in ['revenue', 'booking', 'chiffre', 'rental', 'net_b']):
        print(f"  kpi_code={row['kpi_code']:40s}  valeur_sum={row['valeur_sum']}  nb_jours={row['nb_jours']}")

print()
print("=== Toutes les lignes (aperçu complet) ===")
for row in all_rows:
    print(f"  {row['kpi_code']:45s} sum={str(row['valeur_sum']):20s} nb={row['nb_jours']}")
