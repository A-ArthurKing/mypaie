"""
Fichier : universal_etl.py
Rôle : Moteur ETL Universel (Performance & Qualité) piloté par métadonnées.
"""
import os, sys, json, logging
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from google.cloud import bigquery
from dotenv import load_dotenv

from config.db_mysql_connector import get_mysql_connection

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("universal_etl")

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "data-project-438313")
DATASET_PAIE = os.getenv("BQ_DATASET_PAIE", "gcp_my_paie")
cred_path = os.path.abspath("backend/gcp-credentials.json")
if os.path.exists(cred_path): os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_path

client = bigquery.Client(project=PROJECT_ID)

TABLE_CONFIG = f"`{PROJECT_ID}.{DATASET_PAIE}.config_etl_sources`"

# Tables Performance
TABLE_PERF_SILVER = f"`{PROJECT_ID}.{DATASET_PAIE}.paie_performance`"
TABLE_PERF_GOLD = f"`{PROJECT_ID}.{DATASET_PAIE}.paie_performance_mensuelle`"

# Tables Qualité
TABLE_QUAL_SILVER = f"`{PROJECT_ID}.{DATASET_PAIE}.paie_qualite`"
TABLE_QUAL_GOLD   = f"`{PROJECT_ID}.{DATASET_PAIE}.paie_qualite_mensuelle`"

# ── INITIALISATION ──────────────────────────────────────────────────────────────
DDL_CONFIG = f"""
CREATE TABLE IF NOT EXISTS {TABLE_CONFIG} (
    id INT64,
    univers STRING NOT NULL,
    projet_nom STRING NOT NULL,
    table_source STRING NOT NULL,
    type_structure STRING NOT NULL,
    colonne_cle_json STRING,
    colonne_kpi_code STRING,
    colonne_kpi_value STRING,
    colonne_matricule STRING,
    colonne_agent_fallback STRING,
    colonne_date STRING NOT NULL,
    is_active BOOL DEFAULT TRUE
)
"""
DDL_SILVER_TEMPLATE = "CREATE TABLE IF NOT EXISTS {table} (matricule STRING NOT NULL, date_ref DATE NOT NULL, projet STRING NOT NULL, kpi_code STRING NOT NULL, kpi_value FLOAT64, processed_at TIMESTAMP NOT NULL) PARTITION BY date_ref CLUSTER BY matricule, projet, kpi_code"

def setup():
    client.query(DDL_CONFIG).result()
    client.query(DDL_SILVER_TEMPLATE.format(table=TABLE_PERF_SILVER)).result()
    client.query(DDL_SILVER_TEMPLATE.format(table=TABLE_QUAL_SILVER)).result()
    # Ajout de la colonne scale_max
    client.query(f"ALTER TABLE {TABLE_CONFIG} ADD COLUMN IF NOT EXISTS scale_max FLOAT64").result()
    
    udf = f"CREATE OR REPLACE FUNCTION `{PROJECT_ID}.{DATASET_PAIE}.deplier_json`(json_str STRING) RETURNS ARRAY<STRUCT<kpi_nom STRING, kpi_valeur FLOAT64>> LANGUAGE js AS 'try {{ if (!json_str) return []; const obj = JSON.parse(json_str); return Object.keys(obj).map(key => ({{ kpi_nom: key, kpi_valeur: parseFloat(obj[key]) }})); }} catch (e) {{ return []; }}';"
    client.query(udf).result()

# ── RÉSOLUTION DES RÈGLES DYNAMIQUES ───────────────────────────────────────────
def _get_date_expr(col_name):
    """
    Tente de convertir une colonne en DATE BigQuery.
    Gère le format standard YYYY-MM-DD et le format spécifique DD-MM-YY HH:MM.
    """
    return f"""
        CASE 
            WHEN REGEXP_CONTAINS(CAST({col_name} AS STRING), r'^\\d{{2}}-\\d{{2}}-\\d{{2}} \\d{{2}}:\\d{{2}}$')
                THEN PARSE_DATE('%d-%m-%y', SPLIT(CAST({col_name} AS STRING), ' ')[OFFSET(0)])
            ELSE SAFE_CAST(CAST({col_name} AS STRING) AS DATE)
        END
    """

def _get_sql_expressions(src, raw_col_code, raw_col_val):
    # 1. Alias via MySQL
    try:
        conn = get_mysql_connection()
        cur = conn.cursor()
        cur.execute("SELECT code_brut_source, code_kpi_officiel FROM config_kpi_aliases WHERE projet = %s", (src.projet_nom,))
        aliases = cur.fetchall()
        cur.close()
        conn.close()
    except Exception as e:
        aliases = []
        log.error(f"MySQL Error: {e}")

    cleaned_code = f"TRIM(REGEXP_REPLACE(TRIM({raw_col_code}), r'\\\\s+', ' '))"
    if aliases:
        cases = " ".join([f"WHEN {cleaned_code} = '{a['code_brut_source']}' THEN '{a['code_kpi_officiel']}'" for a in aliases])
        kpi_code_sql = f"CASE {cases} ELSE {cleaned_code} END"
    else:
        kpi_code_sql = cleaned_code

    # 2. Gestion de l'échelle (Scale max)
    base_val = f"CAST({raw_col_val} AS FLOAT64)"
    max_scale = src.scale_max
    
    if max_scale and max_scale != 100.0:
        factor = round(100.0 / max_scale, 10)
        kpi_val_sql = f"ROUND({base_val} * {factor}, 4)"
    else:
        kpi_val_sql = base_val

    return kpi_code_sql, kpi_val_sql

# ── PROCESS PERFORMANCE ─────────────────────────────────────────────────────────
def _run_performance(src, days_back=730):
    date_expr = _get_date_expr(src.colonne_date)
    date_filter = f"AND {date_expr} >= DATE_SUB(CURRENT_DATE(), INTERVAL {days_back} DAY)" if days_back else ""
    
    if src.type_structure == "JSON":
        kpi_code_sql, kpi_val_sql = _get_sql_expressions(src, "u.kpi_nom", "u.kpi_valeur")
        base_sql = f"SELECT CAST({src.colonne_matricule} AS STRING) as matricule, {date_expr} as date_ref, '{src.projet_nom}' as projet, {kpi_code_sql} as kpi_code, {kpi_val_sql} as kpi_value FROM `{PROJECT_ID}.{src.table_source}`, UNNEST(`{PROJECT_ID}.{DATASET_PAIE}.deplier_json`({src.colonne_cle_json})) as u WHERE {src.colonne_matricule} IS NOT NULL {date_filter}"
        sql = f"SELECT matricule, date_ref, projet, kpi_code, SUM(kpi_value) as kpi_value, CURRENT_TIMESTAMP() as processed_at FROM ({base_sql}) WHERE kpi_code IS NOT NULL GROUP BY matricule, date_ref, projet, kpi_code"

    elif src.type_structure == "TALL":
        kpi_code_sql, kpi_val_sql = _get_sql_expressions(src, src.colonne_kpi_code, src.colonne_kpi_value)
        base_sql = f"SELECT CAST({src.colonne_matricule} AS STRING) as matricule, {date_expr} as date_ref, '{src.projet_nom}' as projet, {kpi_code_sql} as kpi_code, {kpi_val_sql} as kpi_value FROM `{PROJECT_ID}.{src.table_source}` WHERE {src.colonne_matricule} IS NOT NULL AND {src.colonne_kpi_value} IS NOT NULL AND {src.colonne_date} IS NOT NULL {date_filter}"
        sql = f"SELECT matricule, date_ref, projet, kpi_code, SUM(kpi_value) as kpi_value, CURRENT_TIMESTAMP() as processed_at FROM ({base_sql}) WHERE kpi_code IS NOT NULL GROUP BY matricule, date_ref, projet, kpi_code"
    
    else:
        log.warning(f"Type de structure {src.type_structure} non supporté pour PERFORMANCE.")
        return

    target_filter = f"AND T.date_ref >= DATE_SUB(CURRENT_DATE(), INTERVAL {days_back} DAY)" if days_back else ""
    client.query(f"MERGE {TABLE_PERF_SILVER} T USING ({sql}) S ON T.matricule=S.matricule AND T.date_ref=S.date_ref AND T.projet=S.projet AND T.kpi_code=S.kpi_code {target_filter} WHEN MATCHED THEN UPDATE SET kpi_value=S.kpi_value, processed_at=S.processed_at WHEN NOT MATCHED THEN INSERT (matricule, date_ref, projet, kpi_code, kpi_value, processed_at) VALUES (S.matricule, S.date_ref, S.projet, S.kpi_code, S.kpi_value, S.processed_at)").result()

# ── PROCESS QUALITE ─────────────────────────────────────────────────────────────
def _run_quality(src, days_back=730):
    date_expr = _get_date_expr(src.colonne_date)
    date_filter = f"AND {date_expr} >= DATE_SUB(CURRENT_DATE(), INTERVAL {days_back} DAY)" if days_back else ""
    mat_expr = f"COALESCE(CAST({src.colonne_matricule} AS STRING), {src.colonne_agent_fallback})" if src.colonne_matricule else src.colonne_agent_fallback
    
    # Si le projet est configuré sur DYNAMIC, on lit la colonne "Projet" de la vue
    projet_expr = "Projet" if src.projet_nom.upper() == "DYNAMIC" else f"'{src.projet_nom}'"
    
    if src.type_structure == "JSON":
        kpi_code_sql, kpi_val_sql = _get_sql_expressions(src, "u.kpi_nom", "u.kpi_valeur")
        base_sql = (f"SELECT {mat_expr} as matricule, {date_expr} as date_ref,"
               f" {projet_expr} as projet,"
               f" ({kpi_code_sql}) as kpi_code,"
               f" ({kpi_val_sql}) as kpi_value"
               f" FROM `{PROJECT_ID}.{src.table_source}`,"
               f" UNNEST(`{PROJECT_ID}.{DATASET_PAIE}.deplier_json`({src.colonne_cle_json})) as u"
               f" WHERE {src.colonne_agent_fallback} IS NOT NULL {date_filter}")
    else:
        kpi_code_sql, kpi_val_sql = _get_sql_expressions(src, src.colonne_kpi_code, src.colonne_kpi_value)
        base_sql = (f"SELECT {mat_expr} as matricule, {date_expr} as date_ref,"
               f" {projet_expr} as projet,"
               f" ({kpi_code_sql}) as kpi_code,"
               f" ({kpi_val_sql}) as kpi_value"
               f" FROM `{PROJECT_ID}.{src.table_source}`"
               f" WHERE {src.colonne_agent_fallback} IS NOT NULL {date_filter}")
               
    sql = f"""
        SELECT matricule, date_ref, projet, kpi_code, AVG(kpi_value) as kpi_value, CURRENT_TIMESTAMP() as processed_at
        FROM ({base_sql})
        WHERE kpi_code IS NOT NULL
        GROUP BY matricule, date_ref, projet, kpi_code
    """
    
    target_filter = f"AND T.date_ref >= DATE_SUB(CURRENT_DATE(), INTERVAL {days_back} DAY)" if days_back else ""
    client.query(f"MERGE {TABLE_QUAL_SILVER} T USING ({sql}) S ON T.matricule=S.matricule AND T.date_ref=S.date_ref AND T.projet=S.projet AND T.kpi_code=S.kpi_code {target_filter} WHEN MATCHED THEN UPDATE SET kpi_value=S.kpi_value, processed_at=S.processed_at WHEN NOT MATCHED THEN INSERT (matricule, date_ref, projet, kpi_code, kpi_value, processed_at) VALUES (S.matricule, S.date_ref, S.projet, S.kpi_code, S.kpi_value, S.processed_at)").result()

# ── ORCHESTRATION ───────────────────────────────────────────────────────────────
def run(days_back=730):
    sources = list(client.query(f"SELECT * FROM {TABLE_CONFIG} WHERE is_active = TRUE").result())
    for src in sources:
        log.info(f"Traitement : [{src.univers}] {src.projet_nom}")
        
        if src.univers == 'PERFORMANCE':
            _run_performance(src, days_back=days_back)
        elif src.univers == 'QUALITE':
            _run_quality(src, days_back=days_back)
        else:
            log.warning(f"Univers inconnu et ignoré: {src.univers}")

def gold():
    log.info("Actualisation Gold Performance...")
    client.query(f"DROP TABLE IF EXISTS {TABLE_PERF_GOLD}").result()
    client.query(f"CREATE TABLE {TABLE_PERF_GOLD} CLUSTER BY matricule, mois, kpi_code AS SELECT matricule, FORMAT_DATE('%Y-%m', date_ref) as mois, projet, kpi_code, SUM(kpi_value) as valeur_sum, AVG(kpi_value) as valeur_avg, COUNT(DISTINCT date_ref) as nb_jours, CURRENT_TIMESTAMP() as last_update FROM {TABLE_PERF_SILVER} GROUP BY 1,2,3,4").result()

    log.info("Actualisation Gold Qualité...")
    client.query(f"DROP TABLE IF EXISTS {TABLE_QUAL_GOLD}").result()
    client.query(f"CREATE TABLE {TABLE_QUAL_GOLD} CLUSTER BY matricule, mois, kpi_code AS SELECT matricule, FORMAT_DATE('%Y-%m', date_ref) as mois, projet, kpi_code, AVG(kpi_value) as valeur_avg, COUNT(*) as nb_evals, CURRENT_TIMESTAMP() as last_update FROM {TABLE_QUAL_SILVER} GROUP BY 1,2,3,4").result()

if __name__ == "__main__":
    setup()
    run()
    gold()
    log.info("ETL Universel terminé avec succès ! ✅")
