import sys
import os
import json
from dotenv import load_dotenv

sys.path.append(os.path.abspath(os.path.join(os.getcwd(), 'backend')))
from config.db_mysql_connector import get_mysql_connection

load_dotenv(os.path.join(os.getcwd(), 'backend', '.env'))

mapping = {
    "fields": {
        "chiffre_affaire": "$.revenue_amt_eur",
        "nb_ventes": "$.booking_nbr",
        "nb_appels": "$.in_call_nbr",
        "temps_production_min": "$.agent_logged_time_min_nbr",
        "temps_appel_min": "$.in_call_min_nbr",
        "csat_score": "$.total_csat_num",
        "csat_count": "$.csat_nbr",
        "in_hold_min": "$.in_hold_min_nbr"
    },
    "week_field": "$.woy_iso_desc_en",
    "year_code_field": "$.last_or_current_year_code"
}

conn = get_mysql_connection()
with conn.cursor() as c:
    c.execute("""
        INSERT INTO ref_etl_config (projet, type_projet, source_table, mapping_json) 
        VALUES (%s, %s, %s, %s) 
        ON DUPLICATE KEY UPDATE mapping_json=VALUES(mapping_json)
    """, ("PVCP_PERFORMANCE", "TELEVENTE", "gcp-my-paie-dev.dataset_pvcp.pvcp_data_outils_client_performance", json.dumps(mapping).replace('','')))
conn.commit()
print("Insert done.")
