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
                LEFT JOIN ref_sous_projet f ON m.id_file = f.id
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

def add_mysql_project_mapping(source_name: str, id_projet: int, id_sous_projet: int = None, id_activite: int = None, description: str = None):
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
            cursor.execute(sql, (source_name, id_projet, id_sous_projet, id_activite, description))
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

def add_kpi_registry_item(code: str, libelle: str, univers: str, kpi_type: str = 'VIRTUAL', formule: str = None, description: str = None) -> dict:
    """Ajoute un nouveau KPI (Natif ou Virtuel) au dictionnaire applicatif."""
    from config.db_mysql_connector import get_mysql_connection
    connection = get_mysql_connection()
    try:
        with connection.cursor() as cursor:
            sql = """
                INSERT INTO config_kpis (code_kpi, libelle, description, univers, type, formule, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, 1)
            """
            cursor.execute(sql, (code.upper().strip(), libelle, description, univers, kpi_type, formule))
            connection.commit()
            return {"status": "success", "code": code.upper().strip()}
    finally:
        connection.close()


def update_kpi_registry_item(code: str, libelle: str = None, description: str = None, formule: str = None, univers: str = None) -> dict:
    """Met à jour les informations d'un KPI existant."""
    from config.db_mysql_connector import get_mysql_connection
    connection = get_mysql_connection()
    try:
        with connection.cursor() as cursor:
            fields = []
            params = []
            if libelle is not None:
                fields.append("libelle = %s")
                params.append(libelle)
            if description is not None:
                fields.append("description = %s")
                params.append(description)
            if formule is not None:
                fields.append("formule = %s")
                params.append(formule)
            if univers is not None:
                fields.append("univers = %s")
                params.append(univers)
            
            if not fields:
                return {"status": "no_change"}
                
            sql = f"UPDATE config_kpis SET {', '.join(fields)} WHERE code_kpi = %s"
            params.append(code)
            
            cursor.execute(sql, tuple(params))
            if cursor.rowcount == 0:
                raise ValueError(f"KPI '{code}' introuvable.")
            connection.commit()
            return {"status": "success", "code": code}
    finally:
        connection.close()


def delete_kpi_registry_item(code: str) -> dict:
    """Supprime un KPI du registre (principalement pour les virtuels)."""
    from config.db_mysql_connector import get_mysql_connection
    connection = get_mysql_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM config_kpis WHERE code_kpi = %s", (code,))
            connection.commit()
            return {"status": "deleted", "code": code}
    finally:
        connection.close()


def get_all_kpis_with_status() -> list:
    """Retourne la liste des KPIs configurés (config_kpis) incluant le type et la formule."""
    from config.db_mysql_connector import get_mysql_connection
    import pymysql

    connection = get_mysql_connection()
    try:
        with connection.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute("""
                SELECT 
                    code_kpi as code, 
                    libelle, 
                    description,
                    univers, 
                    type,
                    formule,
                    is_active as actif, 
                    0 as nb_mappings 
                FROM config_kpis 
                ORDER BY univers, libelle
            """)
            return cur.fetchall()
    finally:
        connection.close()


def toggle_kpi_actif(code: str) -> dict:
    """Bascule le flag actif d'un KPI (1→0 ou 0→1) dans config_kpis."""
    from config.db_mysql_connector import get_mysql_connection
    import pymysql
    
    connection = get_mysql_connection()
    try:
        with connection.cursor(pymysql.cursors.DictCursor) as cursor:
            # Correction : on pointe sur config_kpis et on utilise code_kpi
            cursor.execute(
                "UPDATE config_kpis SET is_active = IF(is_active=1, 0, 1) WHERE code_kpi = %s",
                (code,)
            )
            if cursor.rowcount == 0:
                raise ValueError(f"KPI '{code}' introuvable.")
            connection.commit()
            
            cursor.execute("SELECT is_active as actif FROM config_kpis WHERE code_kpi = %s", (code,))
            row = cursor.fetchone()
            return {"code": code, "actif": bool(row["actif"])}
    finally:
        connection.close()


def get_etl_sources() -> list:
    """Retourne la liste des sources ETL configurées avec leurs champs structurels."""
    from config.db_mysql_connector import get_mysql_connection
    connection = get_mysql_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT projet, type_projet, source_table,
                       snapshot_date_expr, agent_field, op_field,
                       file_field, activite_field, week_field, year_code_field,
                       week_source, date_ref_field, is_active
                FROM ref_etl_config ORDER BY projet
            """)
            rows = cursor.fetchall()
            for r in rows:
                if r.get("created_at"): r["created_at"] = str(r["created_at"])
                if r.get("updated_at"): r["updated_at"] = str(r["updated_at"])
            return rows
    finally:
        connection.close()


def get_kpi_mappings_by_source(source_table: str) -> list:
    """Retourne les mappings KPI d'une source donnée, enrichis du libellé KPI et du statut actif."""
    from config.db_mysql_connector import get_mysql_connection
    connection = get_mysql_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT m.id, m.univers, m.source_table, m.source_column,
                       m.standard_kpi_code, m.dest_table, m.dest_column,
                       m.data_type, m.is_helper, m.is_formula, m.formula,
                       m.description,
                       k.libelle AS kpi_libelle, k.unite AS kpi_unite, k.actif AS kpi_actif
                FROM matrice_kpis_mapping m
                JOIN matrice_kpis k ON k.code = m.standard_kpi_code
                WHERE m.source_table = %s
                ORDER BY m.is_formula, m.id
            """, (source_table,))
            rows = cursor.fetchall()
            for r in rows:
                if r.get("created_at"): r["created_at"] = str(r["created_at"])
                if r.get("updated_at"): r["updated_at"] = str(r["updated_at"])
            return rows
    finally:
        connection.close()


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
