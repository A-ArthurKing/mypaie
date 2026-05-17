"""
Fichier : universal_quality_etl.py
Rôle : Moteur ETL Qualité (Silver & Gold) piloté par métadonnées.
"""
import os, json, logging
from datetime import datetime
from google.cloud import bigquery
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("etl_qual")

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "data-project-438313")
DATASET_PAIE = os.getenv("BQ_DATASET_PAIE", "gcp_my_paie")
cred_path = os.path.abspath("backend/gcp-credentials.json")
if os.path.exists(cred_path): os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_path

client = bigquery.Client(project=PROJECT_ID)

TABLE_CONFIG = f"`{PROJECT_ID}.{DATASET_PAIE}.config_etl_sources`"
TABLE_SILVER = f"`{PROJECT_ID}.{DATASET_PAIE}.paie_qualite`"
TABLE_GOLD = f"`{PROJECT_ID}.{DATASET_PAIE}.paie_qualite_mensuelle`"

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
DDL_SILVER = f"CREATE TABLE IF NOT EXISTS {TABLE_SILVER} (matricule STRING NOT NULL, date_ref DATE NOT NULL, projet STRING NOT NULL, kpi_code STRING NOT NULL, kpi_value FLOAT64, processed_at TIMESTAMP NOT NULL) PARTITION BY date_ref CLUSTER BY matricule, projet, kpi_code"

def setup():
    client.query(DDL_CONFIG).result()
    client.query(DDL_SILVER).result()

def seed():
    if list(client.query(f"SELECT COUNT(*) as c FROM {TABLE_CONFIG} WHERE univers = 'QUALITE'").result())[0]["c"] == 0:
        client.query(f"""
        INSERT INTO {TABLE_CONFIG} (id, univers, projet_nom, table_source, type_structure, colonne_cle_json, colonne_kpi_code, colonne_kpi_value, colonne_matricule, colonne_agent_fallback, colonne_date)
        VALUES 
            (3, 'QUALITE', 'PVCP_GE', 'dataset_pvcp.pvcp_data_outils_client_qualite_ge', 'JSON', 'METRICS', NULL, NULL, 'MATRICULE', 'Nom_de_l_agent', 'Date_Evaluation'),
            (4, 'QUALITE', 'PVCP_FR', 'dataset_pvcp.pvcp_data_outils_client_qualite_fr', 'JSON', 'METRICS', NULL, NULL, 'MATRICULE', 'Nom_de_l_agent', 'Date_Evaluation'),
            (5, 'QUALITE', 'PVCP_BE', 'dataset_pvcp.pvcp_data_outils_client_qualite_be', 'JSON', 'METRICS', NULL, NULL, 'MATRICULE', 'Nom_de_l_agent', 'Date_Evaluation'),
            (6, 'QUALITE', 'VENUM', 'dataset_venum.venum_data_outil_evalPlus_qualite', 'TALL', NULL, 'Sous_Item', 'Note_Sous_Item', NULL, 'Agent', 'Date_Evaluation'),
            (7, 'QUALITE', 'BATISANTE', 'dataset_batisante.batisante_data_outil_evalPlus_qualite', 'TALL', NULL, 'Sous_Item', 'Note_Sous_Item', NULL, 'Agent', 'Date_Evaluation')
        """).result()

def run():
    sources = list(client.query(f"SELECT * FROM {TABLE_CONFIG} WHERE is_active = TRUE AND univers = 'QUALITE'").result())
    for src in sources:
        log.info(f"Projet : {src.projet_nom}")
        mat_expr = f"COALESCE(CAST({src.colonne_matricule} AS STRING), {src.colonne_agent_fallback})" if src.colonne_matricule else src.colonne_agent_fallback
        if src.type_structure == "JSON":
            sql = f"SELECT {mat_expr} as matricule, DATE({src.colonne_date}) as date_ref, '{src.projet_nom}' as projet, u.kpi_nom as kpi_code, u.kpi_valeur as kpi_value, CURRENT_TIMESTAMP() as processed_at FROM `{PROJECT_ID}.{src.table_source}`, UNNEST(`{PROJECT_ID}.{DATASET_PAIE}.deplier_json`({src.colonne_cle_json})) as u WHERE {src.colonne_agent_fallback} IS NOT NULL"
        else:
            sql = f"SELECT {mat_expr} as matricule, DATE({src.colonne_date}) as date_ref, '{src.projet_nom}' as projet, {src.colonne_kpi_code} as kpi_code, CAST({src.colonne_kpi_value} AS FLOAT64) as kpi_value, CURRENT_TIMESTAMP() as processed_at FROM `{PROJECT_ID}.{src.table_source}` WHERE {src.colonne_agent_fallback} IS NOT NULL"
        client.query(f"MERGE {TABLE_SILVER} T USING ({sql}) S ON T.matricule=S.matricule AND T.date_ref=S.date_ref AND T.projet=S.projet AND T.kpi_code=S.kpi_code WHEN MATCHED THEN UPDATE SET kpi_value=S.kpi_value, processed_at=S.processed_at WHEN NOT MATCHED THEN INSERT (matricule, date_ref, projet, kpi_code, kpi_value, processed_at) VALUES (S.matricule, S.date_ref, S.projet, S.kpi_code, S.kpi_value, S.processed_at)").result()

def gold():
    log.info("Actualisation Gold Qualité...")
    client.query(f"DROP TABLE IF EXISTS {TABLE_GOLD}").result()
    client.query(f"CREATE TABLE {TABLE_GOLD} CLUSTER BY matricule, mois, kpi_code AS SELECT matricule, FORMAT_DATE('%Y-%m', date_ref) as mois, projet, kpi_code, AVG(kpi_value) as valeur_avg, COUNT(*) as nb_evals, CURRENT_TIMESTAMP() as last_update FROM {TABLE_SILVER} GROUP BY 1,2,3,4").result()

if __name__ == "__main__":
    setup()
    seed()
    run()
    gold()
