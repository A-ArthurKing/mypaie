"""Debug : voir le schéma BigQuery réel et les valeurs CA pour un agent APSO"""
import sys
sys.path.insert(0, '/app')

from core.db.bigquery import get_bigquery_client
client = get_bigquery_client()

# 1. Voir les colonnes disponibles dans la table
print("=== Schéma de paie_performance_mensuelle ===")
table = client.get_table("data-project-438313.gcp_my_paie.paie_performance_mensuelle")
for field in table.schema:
    print(f"  {field.name} ({field.field_type})")

# 2. Voir les lignes brutes pour un agent (matricule 7042 = BELHAJJAM)
print("\n=== Lignes brutes pour matricule 7042, mai 2026 ===")
q = """
    SELECT *
    FROM `data-project-438313.gcp_my_paie.paie_performance_mensuelle`
    WHERE matricule = '7042'
    LIMIT 10
"""
try:
    for row in client.query(q).result():
        print(dict(row))
except Exception as e:
    # La table a peut-être un schema différent, essayons avec LIMIT
    print(f"Erreur: {e}")
    # Essayons de voir les 3 premières lignes sans filtre
    q2 = "SELECT * FROM `data-project-438313.gcp_my_paie.paie_performance_mensuelle` LIMIT 3"
    for row in client.query(q2).result():
        print(dict(row))
