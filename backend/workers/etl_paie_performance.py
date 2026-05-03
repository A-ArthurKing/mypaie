"""
Fichier : etl_paie_performance.py
Rôle    : Worker ETL — consolide les données brutes de performance (PVCP, ...)
          en une table normalisée `gcp_my_paie.paie_performance` utilisable
          pour le calcul de la paie variable.
Architecture :
    - Lecture du DERNIER snapshot disponible dans la source (date_importation MAX)
    - Mapping configurable par projet (MAPPING_CONFIG)
    - Granularité : agent × opération × activité × semaine ISO
    - Idempotent : MERGE sur la clé fonctionnelle
    - Crée la table si absente, crée les vues mensuelle/hebdo
Module  : mypaie / backend / workers
"""

# #region IMPORTS
import os
import sys
import logging
from datetime import datetime
from google.cloud import bigquery
from dotenv import load_dotenv
# #endregion

# #region CONFIG
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("etl_paie_perf")

PROJECT_ID = os.getenv("GCP_PROJECT_ID")
DATASET_PAIE = os.getenv("BQ_DATASET_PAIE", "gcp_my_paie")
TABLE_PAIE = os.getenv("BQ_TABLE_PAIE_PERF", "paie_performance")
DATASET_PERF = os.getenv("BQ_DATASET_PERF", "dataset_pvcp")
TABLE_PERF = os.getenv("BQ_TABLE_PERF", "pvcp_data_outils_client_performance")

# Référence pleinement qualifiée
TABLE_PAIE_REF = f"`{PROJECT_ID}.{DATASET_PAIE}.{TABLE_PAIE}`"
TABLE_PERF_REF = f"`{PROJECT_ID}.{DATASET_PERF}.{TABLE_PERF}`"
# #endregion

# #region MAPPING CONFIG
# Configuration centralisée du mapping JSON METRICS -> colonnes paie_performance.
# Pour ajouter un nouveau projet, ajouter une entrée ici sans toucher au reste.
MAPPING_CONFIG = {
    "PVCP_PERFORMANCE": {
        "type_projet": "TELEVENTE",
        "source_table": TABLE_PERF_REF,
        "fields": {
            "chiffre_affaire": "$.revenue_amt_eur",
            "nb_ventes": "$.booking_nbr",
            "nb_appels": "$.in_call_nbr",
            "temps_production_min": "$.agent_logged_time_min_nbr",
            "temps_appel_min": "$.in_call_min_nbr",
            "csat_score": "$.total_csat_num",
            "csat_count": "$.csat_nbr",
            "in_hold_min": "$.in_hold_min_nbr",
        },
        # Champs JSON utilisés pour reconstruire la date de référence
        "week_field": "$.woy_iso_desc_en",          # "Week 14"
        "year_code_field": "$.last_or_current_year_code",  # 'N' = current, sinon précédent
    },
}
# #endregion

# #region DDL
DDL_TABLE = f"""
CREATE TABLE IF NOT EXISTS {TABLE_PAIE_REF} (
    matricule          STRING   NOT NULL,
    agent_nom          STRING,
    nomsirh            STRING,
    operation          STRING,
    metier             STRING,
    activite           STRING,
    projet             STRING   NOT NULL,
    type_projet        STRING   NOT NULL,
    annee_iso          INT64    NOT NULL,
    semaine_iso        INT64    NOT NULL,
    date_ref           DATE     NOT NULL,
    mois               STRING,
    chiffre_affaire    FLOAT64,
    nb_ventes          INT64,
    nb_appels          INT64,
    temps_production   FLOAT64,
    temps_appel        FLOAT64,
    taux_conversion    FLOAT64,
    tx_mea             FLOAT64,
    csat               FLOAT64,
    nb_csat            INT64,
    source_table       STRING,
    snapshot_date      TIMESTAMP,
    processed_at       TIMESTAMP NOT NULL
)
PARTITION BY date_ref
CLUSTER BY matricule, projet, operation
OPTIONS (
    description = "Table normalisée des KPI de performance par agent et semaine ISO. Source unique pour le calcul de la paie variable."
)
"""

# Vue consolidée : par agent × mois
DDL_VIEW_MONTH = f"""
CREATE OR REPLACE VIEW `{PROJECT_ID}.{DATASET_PAIE}.v_paie_agent_mensuel` AS
SELECT
    matricule,
    ANY_VALUE(agent_nom)  AS agent_nom,
    ANY_VALUE(nomsirh)    AS nomsirh,
    ANY_VALUE(operation)  AS operation,
    projet,
    type_projet,
    mois,
    SUM(chiffre_affaire)            AS chiffre_affaire,
    SUM(nb_ventes)                  AS nb_ventes,
    SUM(nb_appels)                  AS nb_appels,
    SUM(temps_production)           AS temps_production,
    SUM(temps_appel)                AS temps_appel,
    SAFE_DIVIDE(SUM(nb_ventes), NULLIF(SUM(nb_appels),0)) AS taux_conversion,
    AVG(tx_mea)                     AS tx_mea,
    SAFE_DIVIDE(SUM(csat * nb_csat), NULLIF(SUM(nb_csat),0)) AS csat,
    SUM(nb_csat)                    AS nb_csat,
    COUNT(DISTINCT semaine_iso)     AS nb_semaines
FROM {TABLE_PAIE_REF}
GROUP BY matricule, projet, type_projet, mois
"""

# Vue consolidée : par agent × semaine ISO
DDL_VIEW_WEEK = f"""
CREATE OR REPLACE VIEW `{PROJECT_ID}.{DATASET_PAIE}.v_paie_agent_hebdo` AS
SELECT
    matricule,
    ANY_VALUE(agent_nom)  AS agent_nom,
    ANY_VALUE(nomsirh)    AS nomsirh,
    ANY_VALUE(operation)  AS operation,
    projet,
    type_projet,
    annee_iso,
    semaine_iso,
    date_ref,
    SUM(chiffre_affaire)  AS chiffre_affaire,
    SUM(nb_ventes)        AS nb_ventes,
    SUM(nb_appels)        AS nb_appels,
    SUM(temps_production) AS temps_production,
    SUM(temps_appel)      AS temps_appel,
    SAFE_DIVIDE(SUM(nb_ventes), NULLIF(SUM(nb_appels),0)) AS taux_conversion,
    AVG(tx_mea)           AS tx_mea,
    SAFE_DIVIDE(SUM(csat * nb_csat), NULLIF(SUM(nb_csat),0)) AS csat,
    SUM(nb_csat)          AS nb_csat
FROM {TABLE_PAIE_REF}
GROUP BY matricule, projet, type_projet, annee_iso, semaine_iso, date_ref
"""

# NB : Pas de vue journalière — la donnée source PVCP est agrégée à la semaine ISO,
# une vue par jour serait techniquement possible mais sans valeur métier (toutes
# les lignes d'une même semaine porteraient la même date_ref). Non pertinente.
# #endregion

def get_dynamic_kpi_mapping(client: bigquery.Client, base_fields: dict) -> dict:
    """Récupère le mapping KPI depuis BigQuery."""
    try:
        query = f"SELECT source_name, standard_name FROM `{PROJECT_ID}.{DATASET_PAIE}.kpi_mapping`"
        rows = list(client.query(query).result())
        mapping_dict = {row["standard_name"].strip().lower(): row["source_name"].strip() for row in rows}
        
        # Associer les noms standards métier aux clés internes de notre base de données "paie_performance"
        db_to_standard = {
            "chiffre_affaire": "ca",
            "nb_ventes": "nb ventes",
            "nb_appels": "nb appels",
            "temps_production_min": "temps production",
            "temps_appel_min": "temps appel",
            "csat_score": "score csat",
            "csat_count": "nb csat",
            "in_hold_min": "temps attente"
        }
        
        new_fields = dict(base_fields)
        for db_key, std_name in db_to_standard.items():
            if std_name in mapping_dict:
                raw_sources = mapping_dict[std_name]
                # Si l'utilisateur a mis des virgules, on crée un COALESCE de JSON_EXTRACT
                if "," in raw_sources:
                    sources = [s.strip() for s in raw_sources.split(",") if s.strip()]
                    extracts = [f"JSON_EXTRACT_SCALAR(METRICS, '$.{s}')" for s in sources]
                    new_fields[db_key] = f"COALESCE({', '.join(extracts)})"
                else:
                    new_fields[db_key] = f"JSON_EXTRACT_SCALAR(METRICS, '$.{raw_sources}')"
            else:
                # Fallback config par défaut si pas de mapping
                new_fields[db_key] = f"JSON_EXTRACT_SCALAR(METRICS, '{base_fields[db_key]}')"
                
        return new_fields
    except Exception as e:
        log.warning(f"Impossible de lire kpi_mapping, utilisation de la config par défaut : {e}")
        return base_fields

# #region ETL CORE
def run_etl_pvcp(client: bigquery.Client) -> int:
    """
    Charge le dernier snapshot PVCP, applique le mapping et MERGE dans paie_performance.
    Retourne le nombre de lignes affectées.
    """
    cfg = MAPPING_CONFIG["PVCP_PERFORMANCE"]
    f = get_dynamic_kpi_mapping(client, cfg["fields"])

    # Sélection du dernier snapshot
    snapshot_q = f"SELECT MAX(date_importation) AS d FROM {cfg['source_table']}"
    snapshot_date = list(client.query(snapshot_q).result())[0]["d"]
    if not snapshot_date:
        log.error("Aucun snapshot disponible dans la source.")
        return 0
    log.info(f"Snapshot source utilisé : {snapshot_date}")

    # Requête de transformation
    transform_sql = f"""
    WITH base AS (
        SELECT
            MATRICULE              AS matricule,
            Nom_de_l_agent         AS agent_nom,
            NOMSIRH                AS nomsirh,
            OPERATION              AS operation,
            FILE                   AS metier,
            ACTIVITE               AS activite,
            PROJET                 AS projet,
            -- Extraction de la semaine ISO depuis "Week NN"
            SAFE_CAST(REGEXP_EXTRACT(JSON_EXTRACT_SCALAR(METRICS, '{cfg['week_field']}'), r'(\\d+)') AS INT64) AS semaine_iso,
            -- Année ISO : 'N' = année du snapshot, sinon année précédente
            CASE
                WHEN JSON_EXTRACT_SCALAR(METRICS, '{cfg['year_code_field']}') = 'N'
                    THEN EXTRACT(ISOYEAR FROM DATE(@snap))
                ELSE EXTRACT(ISOYEAR FROM DATE(@snap)) - 1
            END AS annee_iso,
            SAFE_CAST({f['chiffre_affaire']} AS FLOAT64) AS chiffre_affaire,
            SAFE_CAST({f['nb_ventes']}       AS FLOAT64) AS nb_ventes,
            SAFE_CAST({f['nb_appels']}       AS FLOAT64) AS nb_appels,
            SAFE_CAST({f['temps_production_min']} AS FLOAT64) AS temps_production,
            SAFE_CAST({f['temps_appel_min']}      AS FLOAT64) AS temps_appel,
            SAFE_CAST({f['in_hold_min']}          AS FLOAT64) AS in_hold_min,
            SAFE_CAST({f['csat_score']} AS FLOAT64) AS csat_score,
            SAFE_CAST({f['csat_count']} AS FLOAT64) AS csat_count
        FROM {cfg['source_table']}
        WHERE date_importation = @snap
          AND MATRICULE IS NOT NULL
          AND JSON_EXTRACT_SCALAR(METRICS, '{cfg['week_field']}') IS NOT NULL
    ),
    agg AS (
        SELECT
            matricule,
            ANY_VALUE(agent_nom)  AS agent_nom,
            ANY_VALUE(nomsirh)    AS nomsirh,
            operation,
            metier,
            activite,
            projet,
            annee_iso,
            semaine_iso,
            -- Lundi de la semaine ISO
            PARSE_DATE('%G-W%V-%u', CONCAT(CAST(annee_iso AS STRING),'-W',LPAD(CAST(semaine_iso AS STRING),2,'0'),'-1')) AS date_ref,
            SUM(chiffre_affaire)  AS chiffre_affaire,
            CAST(SUM(nb_ventes) AS INT64)  AS nb_ventes,
            CAST(SUM(nb_appels) AS INT64)  AS nb_appels,
            SUM(temps_production) AS temps_production,
            SUM(temps_appel)      AS temps_appel,
            SAFE_DIVIDE(SUM(in_hold_min), NULLIF(SUM(temps_appel),0)) * 100 AS tx_mea,
            -- total_csat_num est déjà une somme de notes, donc on le somme directement
            SAFE_DIVIDE(SUM(csat_score), NULLIF(SUM(csat_count),0)) AS csat,
            CAST(SUM(csat_count) AS INT64) AS nb_csat
        FROM base
        WHERE annee_iso IS NOT NULL AND semaine_iso IS NOT NULL
        GROUP BY matricule, operation, metier, activite, projet, annee_iso, semaine_iso
    )
    SELECT
        matricule, agent_nom, nomsirh, operation, metier, activite, projet,
        '{cfg['type_projet']}' AS type_projet,
        annee_iso, semaine_iso, date_ref,
        FORMAT_DATE('%Y-%m', date_ref) AS mois,
        chiffre_affaire, nb_ventes, nb_appels,
        temps_production, temps_appel,
        SAFE_DIVIDE(nb_ventes, NULLIF(nb_appels,0)) AS taux_conversion,
        tx_mea,
        csat, nb_csat,
        '{cfg['source_table'].strip("`")}' AS source_table,
        TIMESTAMP(@snap) AS snapshot_date,
        CURRENT_TIMESTAMP() AS processed_at
    FROM agg
    """

    merge_sql = f"""
    MERGE {TABLE_PAIE_REF} T
    USING ( {transform_sql} ) S
    ON  T.matricule    = S.matricule
    AND T.projet       = S.projet
    AND T.operation    = S.operation
    AND T.activite     = S.activite
    AND T.annee_iso    = S.annee_iso
    AND T.semaine_iso  = S.semaine_iso
    WHEN MATCHED THEN UPDATE SET
        agent_nom        = S.agent_nom,
        nomsirh          = S.nomsirh,
        metier           = S.metier,
        type_projet      = S.type_projet,
        date_ref         = S.date_ref,
        mois             = S.mois,
        chiffre_affaire  = S.chiffre_affaire,
        nb_ventes        = S.nb_ventes,
        nb_appels        = S.nb_appels,
        temps_production = S.temps_production,
        temps_appel      = S.temps_appel,
        taux_conversion  = S.taux_conversion,
        tx_mea           = S.tx_mea,
        csat             = S.csat,
        nb_csat          = S.nb_csat,
        source_table     = S.source_table,
        snapshot_date    = S.snapshot_date,
        processed_at     = S.processed_at
    WHEN NOT MATCHED THEN INSERT (
        matricule, agent_nom, nomsirh, operation, metier, activite, projet, type_projet,
        annee_iso, semaine_iso, date_ref, mois,
        chiffre_affaire, nb_ventes, nb_appels, temps_production, temps_appel,
        taux_conversion, tx_mea, csat, nb_csat,
        source_table, snapshot_date, processed_at
    ) VALUES (
        S.matricule, S.agent_nom, S.nomsirh, S.operation, S.metier, S.activite, S.projet, S.type_projet,
        S.annee_iso, S.semaine_iso, S.date_ref, S.mois,
        S.chiffre_affaire, S.nb_ventes, S.nb_appels, S.temps_production, S.temps_appel,
        S.taux_conversion, S.tx_mea, S.csat, S.nb_csat,
        S.source_table, S.snapshot_date, S.processed_at
    )
    """

    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("snap", "TIMESTAMP", snapshot_date)]
    )
    job = client.query(merge_sql, job_config=job_config)
    job.result()
    affected = job.num_dml_affected_rows or 0
    log.info(f"MERGE PVCP terminé — {affected} lignes affectées.")
    return affected
# #endregion

# #region MAIN
def ensure_dataset(client: bigquery.Client) -> None:
    """Crée le dataset paie s'il n'existe pas (région EU par défaut)."""
    ds_ref = bigquery.Dataset(f"{PROJECT_ID}.{DATASET_PAIE}")
    ds_ref.location = "EU"
    try:
        client.get_dataset(ds_ref)
        log.info(f"Dataset {DATASET_PAIE} déjà présent.")
    except Exception:
        client.create_dataset(ds_ref, exists_ok=True)
        log.info(f"Dataset {DATASET_PAIE} créé.")


def main():
    t0 = datetime.now()
    log.info("=" * 60)
    log.info(f"ETL paie_performance — démarrage {t0:%Y-%m-%d %H:%M:%S}")
    log.info("=" * 60)

    client = bigquery.Client(project=PROJECT_ID)

    # 1. Dataset + table
    ensure_dataset(client)
    log.info("Création/vérification de la table paie_performance...")
    client.query(DDL_TABLE).result()

    # 2. ETL par projet
    total = 0
    try:
        total += run_etl_pvcp(client)
    except Exception as e:
        log.exception(f"Échec ETL PVCP : {e}")
        sys.exit(1)

    # 3. Vues consolidées
    log.info("Création/mise à jour des vues consolidées...")
    client.query(DDL_VIEW_WEEK).result()
    log.info("  ✓ v_paie_agent_hebdo")
    client.query(DDL_VIEW_MONTH).result()
    log.info("  ✓ v_paie_agent_mensuel")
    log.info("  (vue journalière non créée — granularité source = semaine ISO)")

    # 4. Stats finales
    stats_q = f"""
    SELECT
        COUNT(*) AS total_rows,
        COUNT(DISTINCT matricule) AS nb_agents,
        COUNT(DISTINCT CONCAT(annee_iso,'-',semaine_iso)) AS nb_semaines,
        MIN(date_ref) AS premiere_semaine,
        MAX(date_ref) AS derniere_semaine
    FROM {TABLE_PAIE_REF}
    """
    stats = list(client.query(stats_q).result())[0]
    elapsed = (datetime.now() - t0).total_seconds()

    log.info("=" * 60)
    log.info(f"BILAN — {elapsed:.1f}s")
    log.info(f"  Total lignes      : {stats['total_rows']}")
    log.info(f"  Agents distincts  : {stats['nb_agents']}")
    log.info(f"  Semaines couvertes: {stats['nb_semaines']}")
    log.info(f"  Période           : {stats['premiere_semaine']} → {stats['derniere_semaine']}")
    log.info(f"  Lignes mergées    : {total}")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
# #endregion
