import os
from google.cloud import bigquery
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv('.env.docker')

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "data-project-438313")
DATASET_PAIE = os.getenv("BQ_DATASET_PAIE", "gcp_my_paie")
cred_path = os.path.abspath("gcp-credentials.json")
if os.path.exists(cred_path): os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_path

client = bigquery.Client(project=PROJECT_ID)
TABLE_CONFIG = f"`{PROJECT_ID}.{DATASET_PAIE}.config_etl_sources`"

# Liste des colonnes de performance à extraire de la vue PIVOTÉE
perf_cols = "Incoming_Call, BKG, Revenue, Service_Revenue, Pct_Service_Revenue, ABV_Revenue, ABV_NBR, ABV_Service, Duration_call, Conversion_Agent, Hold_Rate, Hold_Time_Ratio, Nb_CSAT, AVR_CSAT"

query = f"""
UPDATE {TABLE_CONFIG} 
SET 
    type_structure = 'PIVOTED',
    colonne_kpi_code = '{perf_cols}',
    colonne_kpi_value = NULL,
    colonne_cle_json = NULL,
    colonne_matricule = 'NOMSIRH',
    colonne_date = 'call_date'
WHERE id = 9
"""
client.query(query).result()
print("ID 9 configuré en mode PIVOTED avec succès ! ✅")
