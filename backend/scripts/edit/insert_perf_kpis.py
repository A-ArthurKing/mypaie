"""
Insert les KPIs natifs BQ dans config_kpis pour activer les colonnes dynamiques
dans get_perf_totaux_par_matricule.

Les metric_keys utilisés dans la grille active (config 11, prime 6) sont :
  - Duration_call     → BQ kpi_code: Duration_call (AVG en minutes/appel)
  - Conversion_Agent  → BQ kpi_code: Conversion_Agent (AVG en décimal, ex: 0.1146 = 11.46%)
  - ABV_NBR           → BQ kpi_code: ABV_NBR (AVG en valeur monétaire/réservation)
  - Hold_Time_Ratio   → BQ kpi_code: Hold_Time_Ratio (AVG en décimal, ex: 0.00186)

Ces codes doivent correspondre exactement aux kpi_code dans paie_performance_mensuelle.
"""
import sys, json
sys.path.insert(0, '/app')

import pymysql
from config.db_mysql_connector import get_mysql_connection

KPIS_TO_INSERT = [
    {
        'code_kpi': 'Duration_call',
        'libelle': '[PVCP] Durée Moyenne Traitement (minutes/appel)',
        'description': 'Durée moyenne de traitement par appel, issue de BigQuery paie_performance_mensuelle (valeur en minutes).',
        'univers': 'PERF',
        'type': 'NATIVE',
        'bq_kpi_codes': json.dumps(['Duration_call']),
        'bq_aggregation': 'AVG',
    },
    {
        'code_kpi': 'Conversion_Agent',
        'libelle': '[PVCP] Taux de Conversion (décimal)',
        'description': 'Taux de conversion agent, issu de BigQuery paie_performance_mensuelle (valeur en fraction décimale, ex: 0.1146 = 11.46%).',
        'univers': 'PERF',
        'type': 'NATIVE',
        'bq_kpi_codes': json.dumps(['Conversion_Agent']),
        'bq_aggregation': 'AVG',
    },
    {
        'code_kpi': 'ABV_NBR',
        'libelle': '[PVCP] Average Booking Value (valeur/réservation)',
        'description': 'Valeur moyenne par réservation (ABV), issue de BigQuery paie_performance_mensuelle.',
        'univers': 'PERF',
        'type': 'NATIVE',
        'bq_kpi_codes': json.dumps(['ABV_NBR']),
        'bq_aggregation': 'AVG',
    },
    {
        'code_kpi': 'Hold_Time_Ratio',
        'libelle': '[PVCP] Taux de Mise en Attente (décimal)',
        'description': 'Ratio du temps de mise en attente, issu de BigQuery paie_performance_mensuelle (valeur en fraction décimale).',
        'univers': 'PERF',
        'type': 'NATIVE',
        'bq_kpi_codes': json.dumps(['Hold_Time_Ratio']),
        'bq_aggregation': 'AVG',
    },
]

conn = get_mysql_connection()
inserted = 0
try:
    with conn.cursor() as cur:
        for kpi in KPIS_TO_INSERT:
            cur.execute("""
                INSERT INTO config_kpis (code_kpi, libelle, description, univers, type, bq_kpi_codes, bq_aggregation, is_active)
                VALUES (%(code_kpi)s, %(libelle)s, %(description)s, %(univers)s, %(type)s, %(bq_kpi_codes)s, %(bq_aggregation)s, 1)
                ON DUPLICATE KEY UPDATE
                    libelle = VALUES(libelle),
                    bq_kpi_codes = VALUES(bq_kpi_codes),
                    bq_aggregation = VALUES(bq_aggregation),
                    is_active = 1
            """, kpi)
            inserted += 1
            print(f"  Inséré/mis à jour: {kpi['code_kpi']}")
    conn.commit()
    print(f"\n=== {inserted} KPIs insérés dans config_kpis ===")
except Exception as e:
    conn.rollback()
    print(f"Erreur: {e}")
    raise
finally:
    conn.close()

# Vérification
conn2 = get_mysql_connection()
with conn2.cursor(pymysql.cursors.DictCursor) as cur:
    cur.execute("SELECT code_kpi, bq_kpi_codes, bq_aggregation FROM config_kpis WHERE univers='PERF' AND type='NATIVE'")
    rows = cur.fetchall()
conn2.close()
print(f"\n=== Vérification config_kpis PERF NATIVE ===")
for r in rows:
    print(f"  {r['code_kpi']:25s}  bq_codes={r['bq_kpi_codes']}  agg={r['bq_aggregation']}")
