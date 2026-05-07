"""
Fichier : mapping_provider.py
Rôle    : Service gérant la table de correspondance des noms de projets (mapping) sur BigQuery.
          Permet d'ajouter, lister et supprimer des règles de mapping.
Module  : mypaie / backend / services / parametres
"""

import logging
from google.cloud.exceptions import GoogleCloudError
from config.dw_api_bigquery_connector import get_bigquery_client, GCP_PROJECT_ID, BQ_DATASET_PAIE

logger = logging.getLogger(__name__)

def ensure_mapping_table_exists():
    """Crée la table de mapping sur BigQuery si elle n'existe pas encore."""
    client = get_bigquery_client()
    table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.projet_mapping`"
    
    query = f"""
        CREATE TABLE IF NOT EXISTS {table_ref} (
            source_name STRING NOT NULL,
            standard_name STRING NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
        )
    """
    try:
        client.query(query).result()
    except GoogleCloudError as err:
        logger.error("Erreur lors de la création de la table de mapping: %s", err)

def get_mappings() -> list:
    """Récupère tous les mappings existants."""
    ensure_mapping_table_exists()
    client = get_bigquery_client()
    table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.projet_mapping`"
    
    query = f"SELECT source_name, standard_name, created_at FROM {table_ref} ORDER BY standard_name"
    try:
        rows = [dict(r) for r in client.query(query).result()]
        for r in rows:
            if r.get("created_at"):
                r["created_at"] = r["created_at"].isoformat()
        return rows
    except GoogleCloudError as err:
        logger.error("Erreur BigQuery lors de la lecture des mappings: %s", err)
        raise

def ensure_kpi_mapping_table_exists():
    """Crée la table de mapping des KPIs sur BigQuery si elle n'existe pas."""
    client = get_bigquery_client()
    table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.kpi_mapping`"
    
    query = f"""
        CREATE TABLE IF NOT EXISTS {table_ref} (
            source_name STRING NOT NULL,
            standard_name STRING NOT NULL,
            description STRING,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
        )
    """
    try:
        client.query(query).result()
    except GoogleCloudError as err:
        logger.error("Erreur lors de la création de la table kpi_mapping: %s", err)

def get_kpi_mappings() -> list:
    """Récupère tous les mappings de KPIs existants."""
    ensure_kpi_mapping_table_exists()
    client = get_bigquery_client()
    table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.kpi_mapping`"
    
    query = f"SELECT source_name, standard_name, description, created_at FROM {table_ref} ORDER BY standard_name"
    try:
        rows = [dict(r) for r in client.query(query).result()]
        for r in rows:
            if r.get("created_at"):
                r["created_at"] = r["created_at"].isoformat()
        return rows
    except GoogleCloudError as err:
        logger.error("Erreur BigQuery lors de la lecture des mappings KPIs: %s", err)
        raise

def add_kpi_mapping(source_name: str, standard_name: str, description: str = None):
    """Ajoute ou met à jour un mapping de KPI."""
    ensure_kpi_mapping_table_exists()
    client = get_bigquery_client()
    table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.kpi_mapping`"
    
    query = f"""
        DELETE FROM {table_ref} WHERE source_name = @source_name;
        INSERT INTO {table_ref} (source_name, standard_name, description) VALUES (@source_name, @standard_name, @description);
    """
    from google.cloud import bigquery as bq
    job_config = bq.QueryJobConfig(
        query_parameters=[
            bq.ScalarQueryParameter("source_name", "STRING", source_name),
            bq.ScalarQueryParameter("standard_name", "STRING", standard_name),
            bq.ScalarQueryParameter("description", "STRING", description),
        ]
    )
    
    try:
        client.query(query, job_config=job_config).result()
        return {"source_name": source_name, "standard_name": standard_name, "description": description, "status": "success"}
    except GoogleCloudError as err:
        logger.error("Erreur BigQuery lors de l'ajout du mapping KPI: %s", err)
        raise

def delete_kpi_mapping(source_name: str):
    """Supprime un mapping KPI."""
    ensure_kpi_mapping_table_exists()
    client = get_bigquery_client()
    table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.kpi_mapping`"
    
    query = f"DELETE FROM {table_ref} WHERE source_name = @source_name"
    from google.cloud import bigquery as bq
    job_config = bq.QueryJobConfig(
        query_parameters=[
            bq.ScalarQueryParameter("source_name", "STRING", source_name)
        ]
    )
    try:
        client.query(query, job_config=job_config).result()
        return {"source_name": source_name, "status": "deleted"}
    except GoogleCloudError as err:
        logger.error("Erreur BigQuery lors de la suppression du mapping KPI: %s", err)
        raise

# --- MAPPING PROJETS DYNAMIQUE (MYSQL) ---

def get_mysql_project_mappings() -> list:
    """Récupère tous les mappings de projets depuis MySQL."""
    from config.db_mysql_connector import get_mysql_connection
    connection = get_mysql_connection()
    try:
        with connection.cursor() as cursor:
            sql = """
                SELECT m.*, p.nom as standard_nom, f.libelle as file_nom, a.libelle as activite_nom
                FROM ref_projets_mapping m
                LEFT JOIN ref_projets p ON m.id_projet = p.id
                LEFT JOIN ref_files f ON m.id_file = f.id
                LEFT JOIN ref_activites a ON m.id_activite = a.id
                ORDER BY m.source_name
            """
            cursor.execute(sql)
            rows = cursor.fetchall()
            for r in rows:
                if r.get("created_at"): r["created_at"] = str(r["created_at"])
                if r.get("updated_at"): r["updated_at"] = str(r["updated_at"])
            return rows
    finally:
        connection.close()

def add_mysql_project_mapping(source_name: str, id_projet: int, id_file: int = None, id_activite: int = None, description: str = None):
    """Ajoute ou met à jour un mapping de projet dans MySQL."""
    from config.db_mysql_connector import get_mysql_connection
    connection = get_mysql_connection()
    try:
        with connection.cursor() as cursor:
            sql = """
                INSERT INTO ref_projets_mapping (source_name, id_projet, id_file, id_activite, description)
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE 
                    id_projet = VALUES(id_projet),
                    id_file = VALUES(id_file),
                    id_activite = VALUES(id_activite),
                    description = VALUES(description)
            """
            cursor.execute(sql, (source_name, id_projet, id_file, id_activite, description))
            connection.commit()
            return {"status": "success", "id": cursor.lastrowid}
    finally:
        connection.close()

def delete_mysql_project_mapping(mapping_id: int):
    """Supprime un mapping projet de MySQL."""
    from config.db_mysql_connector import get_mysql_connection
    connection = get_mysql_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM ref_projets_mapping WHERE id = %s", (mapping_id,))
            connection.commit()
            return {"status": "deleted"}
    finally:
        connection.close()

# --- MAPPING KPIS DYNAMIQUE (MYSQL) ---

def get_mysql_kpi_mappings() -> list:
    """Récupère tous les mappings de KPIs depuis MySQL."""
    from config.db_mysql_connector import get_mysql_connection
    connection = get_mysql_connection()
    try:
        with connection.cursor() as cursor:
            sql = """
                SELECT m.*, k.libelle as standard_libelle, p.nom as projet_nom
                FROM matrice_kpis_mapping m
                LEFT JOIN matrice_kpis k ON m.standard_kpi_code = k.code
                LEFT JOIN ref_projets p ON m.id_projet = p.id
                ORDER BY m.univers, m.source_table
            """
            cursor.execute(sql)
            rows = cursor.fetchall()
            for r in rows:
                if r.get("created_at"): r["created_at"] = str(r["created_at"])
                if r.get("updated_at"): r["updated_at"] = str(r["updated_at"])
            return rows
    finally:
        connection.close()

def add_mysql_kpi_mapping(univers: str, source_table: str, source_column: str, standard_kpi_code: str, id_projet: int = None, description: str = None, is_formula: bool = False, formula: str = None):
    """Ajoute ou met à jour un mapping de KPI dans MySQL."""
    from config.db_mysql_connector import get_mysql_connection
    connection = get_mysql_connection()
    try:
        with connection.cursor() as cursor:
            sql = """
                INSERT INTO matrice_kpis_mapping (univers, source_table, source_column, is_formula, formula, standard_kpi_code, id_projet, description)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE 
                    standard_kpi_code = VALUES(standard_kpi_code),
                    is_formula = VALUES(is_formula),
                    formula = VALUES(formula),
                    description = VALUES(description)
            """
            cursor.execute(sql, (univers, source_table, source_column, 1 if is_formula else 0, formula, standard_kpi_code, id_projet, description))
            connection.commit()
            return {"status": "success", "id": cursor.lastrowid}
    finally:
        connection.close()

def delete_mysql_kpi_mapping(mapping_id: int):
    """Supprime un mapping KPI de MySQL."""
    from config.db_mysql_connector import get_mysql_connection
    connection = get_mysql_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM matrice_kpis_mapping WHERE id = %s", (mapping_id,))
            connection.commit()
            return {"status": "deleted"}
    finally:
        connection.close()

# --- GESTION DU RÉFÉRENTIEL STANDARDS ---

def add_standard_kpi(code: str, libelle: str, univers: str, unite: str = None, description: str = None):
    """Ajoute un nouveau KPI au référentiel officiel (matrice_kpis)."""
    from config.db_mysql_connector import get_mysql_connection
    connection = get_mysql_connection()
    try:
        with connection.cursor() as cursor:
            sql = """
                INSERT INTO matrice_kpis (code, libelle, univers, unite, description)
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE 
                    libelle = VALUES(libelle),
                    unite = VALUES(unite),
                    description = VALUES(description)
            """
            cursor.execute(sql, (code.upper().strip(), libelle, univers, unite, description))
            connection.commit()
            return {"status": "success", "code": code.upper().strip()}
    finally:
        connection.close()

def add_mapping(source_name: str, standard_name: str):
    """Ajoute ou met à jour un mapping de projet."""
    ensure_mapping_table_exists()
    client = get_bigquery_client()
    table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.projet_mapping`"
    
    # Suppression de l'existant puis insertion (Upsert)
    query = f"""
        DELETE FROM {table_ref} WHERE source_name = @source_name;
        INSERT INTO {table_ref} (source_name, standard_name) VALUES (@source_name, @standard_name);
    """
    from google.cloud import bigquery as bq
    job_config = bq.QueryJobConfig(
        query_parameters=[
            bq.ScalarQueryParameter("source_name", "STRING", source_name),
            bq.ScalarQueryParameter("standard_name", "STRING", standard_name),
        ]
    )
    
    try:
        client.query(query, job_config=job_config).result()
        return {"source_name": source_name, "standard_name": standard_name, "status": "success"}
    except GoogleCloudError as err:
        logger.error("Erreur BigQuery lors de l'ajout du mapping: %s", err)
        raise

def delete_mapping(source_name: str):
    """Supprime un mapping."""
    ensure_mapping_table_exists()
    client = get_bigquery_client()
    table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.projet_mapping`"
    
    query = f"DELETE FROM {table_ref} WHERE source_name = @source_name"
    from google.cloud import bigquery as bq
    job_config = bq.QueryJobConfig(
        query_parameters=[
            bq.ScalarQueryParameter("source_name", "STRING", source_name)
        ]
    )
    try:
        client.query(query, job_config=job_config).result()
        return {"source_name": source_name, "status": "deleted"}
    except GoogleCloudError as err:
        logger.error("Erreur BigQuery lors de la suppression du mapping: %s", err)
        raise
