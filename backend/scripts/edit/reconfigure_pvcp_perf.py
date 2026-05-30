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

# Configuration pour lire la vue suivi_agents_sortant en mode JSON
# On remplace l'ID 9 (ou on en crée un nouveau si on veut garder l'ancien)
# Ici on met à jour l'ID 9 car c'est celui que vous vouliez traiter pour PVCP Performance
query = f"""
UPDATE {TABLE_CONFIG} 
SET 
    projet_nom = 'PVCP',
    table_source = 'dataset_pvcp.pvcp_data_outils_client_suivi_agents_sortant',
    type_structure = 'JSON',
    colonne_cle_json = 'METRICS',
    colonne_matricule = 'MATRICULE',
    colonne_date = 'Debut_de_l_intervalle',
    colonne_agent_fallback = 'ID_de_l_agent',
    is_active = TRUE
WHERE id = 9
"""
client.query(query).result()
print("ID 9 (PVCP PERFORMANCE) mis à jour pour utiliser la vue JSON ! ✅")
