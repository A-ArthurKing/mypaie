"""Debug : tracer la source de CHIFFRE_AFFAIRE / revenue_amt_eur"""
import sys
sys.path.insert(0, '/app')

# 1. config_kpis
from config.db_mysql_connector import get_mysql_connection
import pymysql

conn = get_mysql_connection()
with conn.cursor(pymysql.cursors.DictCursor) as cur:
    cur.execute("""
        SELECT code_kpi, libelle, bq_kpi_codes, univers, type, formule
        FROM config_kpis
        WHERE code_kpi LIKE '%CA%'
           OR code_kpi LIKE '%REVENUE%'
           OR code_kpi LIKE '%CHIFFRE%'
           OR code_kpi LIKE '%BOOKING%'
           OR bq_kpi_codes LIKE '%revenue%'
           OR bq_kpi_codes LIKE '%chiffre%'
    """)
    rows = cur.fetchall()
conn.close()

print("=== config_kpis (KPIs liés au CA) ===")
for r in rows:
    print(r)

# 2. Valeur brute dans BigQuery pour un agent APSO (récupérer quelques lignes)
print("\n=== Valeur BigQuery brute paie_performance_mensuelle (matricule quelconque, mai 2026) ===")
try:
    from core.db.bigquery import get_bigquery_client
    client = get_bigquery_client()
    query = """
        SELECT matricule, date_debut, date_fin,
               revenue_amt_eur, chiffre_affaire,
               net_booking_rental_amt_eur
        FROM `data-project-438313.gcp_my_paie.paie_performance_mensuelle`
        WHERE date_debut >= '2026-05-01' AND date_fin <= '2026-05-31'
        LIMIT 5
    """
    results = client.query(query).result()
    for row in results:
        print(dict(row))
except Exception as e:
    print(f"BigQuery error: {e}")

# 3. Voir comment le provider calcule chiffre_affaire
print("\n=== Extrait dw_api_performance_provider — colonnes utilisées ===")
with open('/app/modules/performance/services/dw_api_performance_provider.py', 'r') as f:
    content = f.read()
    # Trouver les lignes contenant "revenue" ou "chiffre"
    for i, line in enumerate(content.splitlines(), 1):
        if any(k in line.lower() for k in ['revenue', 'chiffre_affaire', 'chiffre affaire', 'avg_ca']):
            print(f"  L{i}: {line.rstrip()}")
