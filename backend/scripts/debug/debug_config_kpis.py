"""Debug: liste les KPIs dans config_kpis"""
import sys
sys.path.insert(0, '/app')

import pymysql
from config.db_mysql_connector import get_mysql_connection

conn = get_mysql_connection()
with conn.cursor(pymysql.cursors.DictCursor) as cur:
    cur.execute('SELECT code_kpi, libelle, univers, type, bq_kpi_codes, bq_aggregation FROM config_kpis ORDER BY univers, code_kpi')
    rows = cur.fetchall()
conn.close()

print(f"\n=== {len(rows)} KPIs dans config_kpis ===")
for r in rows:
    print(f"  {r['code_kpi']:30s}  univers={r['univers']}  type={r['type']}  bq_kpi_codes={r['bq_kpi_codes']}  agg={r['bq_aggregation']}")
