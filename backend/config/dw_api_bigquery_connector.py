"""
Fichier : dw_api_bigquery_connector.py
Rôle    : Initialise et expose le client BigQuery authentifié via les credentials GCP.
          Lecture des variables d'environnement pour éviter les credentials en dur.
Dépend  : google-cloud-bigquery, python-dotenv
Module  : mypaie / backend
"""

# #region IMPORTS
import os
from google.cloud import bigquery
from dotenv import load_dotenv
# #endregion

# #region INITIALISATION
# Chargement des variables d'environnement depuis le fichier .env
load_dotenv()

# Définition du chemin des credentials GCP via variable d'environnement
credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if not credentials_path:
    raise EnvironmentError(
        "La variable GOOGLE_APPLICATION_CREDENTIALS est absente du fichier .env."
    )

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path

# Identifiants du projet et du dataset BigQuery
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
BQ_DATASET_ID  = os.getenv("BQ_DATASET_ID")
BQ_TABLE_HEURES = os.getenv("BQ_TABLE_HEURES")

BQ_DATASET_QUALITE = os.getenv("BQ_DATASET_QUALITE")
BQ_TABLE_QUALITE   = os.getenv("BQ_TABLE_QUALITE")


# Client singleton — instancié une seule fois pour éviter le coût de reconnexion GCP
_bq_client: bigquery.Client | None = None

def get_bigquery_client() -> bigquery.Client:
    """Retourne le client BigQuery singleton (réutilisé entre les requêtes)."""
    global _bq_client
    if _bq_client is None:
        _bq_client = bigquery.Client(project=GCP_PROJECT_ID)
    return _bq_client
# #endregion
