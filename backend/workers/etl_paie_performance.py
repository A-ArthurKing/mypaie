"""
Fichier : etl_paie_performance.py
Rôle    : Worker ETL — consolide les données brutes de performance (PVCP, ...)
          en une table normalisÃ©e `gcp_my_paie.paie_performance_tv` utilisable
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
from dotenv import load_dotenv

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from config.db_mysql_connector import get_mysql_connection
from google.cloud import bigquery
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
TABLE_PAIE = os.getenv("BQ_TABLE_PAIE_PERF", "paie_performance_tv")
DATASET_PERF = os.getenv("BQ_DATASET_PERF", "dataset_pvcp")
TABLE_PERF = os.getenv("BQ_TABLE_PERF", "pvcp_data_outils_client_performance")

# Référence pleinement qualifiée
TABLE_PAIE_REF = f"`{PROJECT_ID}.{DATASET_PAIE}.{TABLE_PAIE}`"
TABLE_PERF_REF = f"`{PROJECT_ID}.{DATASET_PERF}.{TABLE_PERF}`"
# #endregion

# #region MAPPING CONFIG
def get_etl_config_from_db():
    """Lit la configuration structurelle ETL depuis ref_etl_config."""
    config_dict = {}
    try:
        conn = get_mysql_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT projet, type_projet, source_table,
                       snapshot_date_expr, agent_field, op_field,
                       file_field, activite_field, week_field, year_code_field,
                       week_source, date_ref_field, matricule_expr
                FROM ref_etl_config WHERE is_active = TRUE
            """)
            for row in cursor.fetchall():
                src = row["source_table"].replace("{PROJECT_ID}", PROJECT_ID or "")
                if not src.startswith("`"):
                    src = f"`{src}`"
                config_dict[row["projet"]] = {
                    "type_projet":        row["type_projet"],
                    "source_table":       src,
                    "snapshot_date_expr": row.get("snapshot_date_expr") or "date_importation",
                    "agent_field":        row.get("agent_field")        or "Nom_de_l_agent",
                    "op_field":           row.get("op_field"),
                    "file_field":         row.get("file_field"),
                    "activite_field":     row.get("activite_field"),
                    "week_field":         row.get("week_field")         or "$.woy_iso_desc_en",
                    "year_code_field":    row.get("year_code_field")    or "$.last_or_current_year_code",
                    "week_source":        row.get("week_source")        or "metrics_json",
                    "date_ref_field":     row.get("date_ref_field"),
                    "matricule_expr":     row.get("matricule_expr"),
                }
        conn.close()
    except Exception as e:
        log.error(f"Erreur config MySQL: {e}")
    return config_dict


def get_kpi_mapping_from_db(source_table_key: str) -> list:
    """
    Retourne les mappings KPI actifs pour une source donnée.
    Filtre sur matrice_kpis.actif = 1 : toggle actif/inactif sans toucher au code.
    Catégories : direct (is_formula=0, is_helper=0),
                 helper (is_formula=0, is_helper=1),
                 formula (is_formula=1).
    """
    rows = []
    try:
        conn = get_mysql_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT km.source_column, km.dest_column,
                       km.data_type, km.is_helper, km.is_formula, km.formula,
                       mk.code AS kpi_code
                FROM matrice_kpis_mapping km
                JOIN matrice_kpis mk ON mk.code = km.standard_kpi_code
                WHERE km.source_table = %s AND mk.actif = 1
                ORDER BY km.is_formula ASC, km.id ASC
            """, (source_table_key,))
            rows = cursor.fetchall()
        conn.close()
    except Exception as e:
        log.error(f"Erreur lecture matrice_kpis_mapping '{source_table_key}': {e}")
    return rows
# #endregion

# #region DDL
DDL_TABLE = f"""
CREATE TABLE IF NOT EXISTS {TABLE_PAIE_REF} (
    projet             STRING   NOT NULL,
    sous_projet        STRING,
    operation          STRING,
    activite           STRING,
    matricule          STRING   NOT NULL,
    agent_nom          STRING,
    nomsirh            STRING,
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
CREATE OR REPLACE VIEW `{PROJECT_ID}.{DATASET_PAIE}.v_paie_agent_mensuel_tv` AS
SELECT
    projet,
    ANY_VALUE(sous_projet) AS sous_projet,
    ANY_VALUE(operation)  AS operation,
    ANY_VALUE(activite)   AS activite,
    matricule,
    ANY_VALUE(agent_nom)  AS agent_nom,
    ANY_VALUE(nomsirh)    AS nomsirh,
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
CREATE OR REPLACE VIEW `{PROJECT_ID}.{DATASET_PAIE}.v_paie_agent_hebdo_tv` AS
SELECT
    projet,
    ANY_VALUE(sous_projet) AS sous_projet,
    ANY_VALUE(operation)  AS operation,
    ANY_VALUE(activite)   AS activite,
    matricule,
    ANY_VALUE(agent_nom)  AS agent_nom,
    ANY_VALUE(nomsirh)    AS nomsirh,
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

# #region ETL CORE
def run_etl_project(client: bigquery.Client, projet_name: str, cfg: dict) -> int:
    """
    Charge le dernier snapshot pour un projet donné, lit les KPIs actifs depuis
    matrice_kpis_mapping et MERGE dans la table de destination configurée.
    Retourne le nombre de lignes affectées.
    """
    # Normalise la clé source (retire backticks et préfixe projet BQ)
    source_key = cfg["source_table"].strip("`")
    if PROJECT_ID and source_key.startswith(f"{PROJECT_ID}."):
        source_key = source_key[len(PROJECT_ID) + 1:]
    source_key = source_key.lstrip(".")

    kpi_rows = get_kpi_mapping_from_db(source_key)
    if not kpi_rows:
        log.warning(f"Aucun KPI actif pour '{projet_name}' (source: {source_key}). Projet ignoré.")
        return 0

    # ── Champs structurels ──────────────────────────────────────────────
    snap_expr     = cfg["snapshot_date_expr"]
    agent_field   = cfg["agent_field"]
    week_source   = cfg.get("week_source", "metrics_json")
    week_field    = cfg["week_field"]
    year_field    = cfg["year_code_field"]
    date_ref_col  = cfg.get("date_ref_field") or "DATE(date_importation)"
    matricule_raw = cfg.get("matricule_expr") or "MATRICULE"

    # op_field : peut être une colonne BQ directe ou un JSON path dans METRICS ($.xxx)
    def _struct_expr(field):
        if not field:
            return "CAST(NULL AS STRING)"
        if field.startswith("$."):
            return f"UPPER(TRIM(JSON_VALUE(METRICS, '{field}')))"
        return f"UPPER(TRIM({field}))"

    op_expr       = _struct_expr(cfg.get("op_field"))
    file_expr     = _struct_expr(cfg.get("file_field"))
    activite_expr = _struct_expr(cfg.get("activite_field"))

    # ── Calcul semaine ISO selon la source ──────────────────────────────
    if week_source == "date_column":
        semaine_sql = f"EXTRACT(ISOWEEK FROM DATE({date_ref_col}))"
        annee_sql   = f"EXTRACT(ISOYEAR FROM DATE({date_ref_col}))"
        qualify_partition_week = f"DATE({date_ref_col})"
        # Pour les sources à granularité journalière, filtrer sur DATE du snapshot
        snap_filter = f"DATE({snap_expr}) = DATE(@snap)"
    else:  # metrics_json (PVCP)
        semaine_sql = (
            f"SAFE_CAST(REGEXP_EXTRACT("
            f"JSON_EXTRACT_SCALAR(METRICS, '{week_field}'), r'(\\d+)') AS INT64)"
        )
        annee_sql = (
            f"CASE WHEN JSON_EXTRACT_SCALAR(METRICS, '{year_field}') = 'N' "
            f"THEN EXTRACT(ISOYEAR FROM DATE(@snap)) "
            f"ELSE EXTRACT(ISOYEAR FROM DATE(@snap)) - 1 END"
        )
        qualify_partition_week = f"JSON_EXTRACT_SCALAR(METRICS, '{week_field}')"
        snap_filter = f"{snap_expr} = @snap"

    # ── Catégorisation des KPIs ─────────────────────────────────────────
    direct_kpis  = [r for r in kpi_rows if not r["is_formula"] and not r["is_helper"]]
    helper_kpis  = [r for r in kpi_rows if not r["is_formula"] and     r["is_helper"]]
    formula_kpis = [r for r in kpi_rows if     r["is_formula"]]

    # ── Génération des fragments SQL ────────────────────────────────────
    def _extract_expr(r):
        bq_type = "INT64" if r["data_type"] == "INT" else "FLOAT64"
        src   = r["source_column"]
        alias = r["dest_column"]
        raw   = f"JSON_EXTRACT_SCALAR(METRICS, '{src}')" if src.startswith("$.") else src
        return f"            SAFE_CAST({raw} AS {bq_type}) AS {alias}"

    base_kpi_lines = [_extract_expr(r) for r in direct_kpis + helper_kpis]
    base_kpi_block = (",\n".join(base_kpi_lines) + ",") if base_kpi_lines else ""

    def _agg_expr(r):
        col = r["dest_column"]
        return (f"        CAST(SUM({col}) AS INT64) AS {col}" if r["data_type"] == "INT"
                else f"        SUM({col}) AS {col}")

    agg_lines = (
        [_agg_expr(r)                                              for r in direct_kpis]
      + [f"        SUM({r['dest_column']}) AS {r['dest_column']}" for r in helper_kpis]
      + [f"        {r['formula']} AS {r['dest_column']}"          for r in formula_kpis]
    )
    agg_kpi_block   = (",\n".join(agg_lines) + ",") if agg_lines else ""
    final_kpi_cols  = [r["dest_column"] for r in direct_kpis + formula_kpis]
    final_kpi_block = (",\n".join(f"        {c}" for c in final_kpi_cols) + ",") if final_kpi_cols else ""

    # ── Snapshot detection ───────────────────────────────────────────────
    snapshot_q    = f"SELECT MAX({snap_expr}) AS d FROM {cfg['source_table']}"
    snapshot_date = list(client.query(snapshot_q).result())[0]["d"]
    if not snapshot_date:
        log.warning(f"Aucun snapshot disponible pour {projet_name}.")
        return 0
    log.info(f"Snapshot source utilisé : {snapshot_date}")

    # ── Transform SQL ────────────────────────────────────────────────────
    transform_sql = f"""
    WITH base AS (
        SELECT
            CAST({matricule_raw} AS STRING) AS matricule,
            {agent_field}          AS agent_nom,
            NOMSIRH                AS nomsirh,
            {op_expr}              AS operation,
            {file_expr}            AS sous_projet,
            {activite_expr}        AS activite,
            '{projet_name}'        AS projet,
            {semaine_sql}          AS semaine_iso,
            {annee_sql}            AS annee_iso,
{base_kpi_block}
        FROM {cfg['source_table']}
        WHERE {snap_filter}
          AND MATRICULE IS NOT NULL
        QUALIFY ROW_NUMBER() OVER (
            PARTITION BY MATRICULE, {op_expr}, {file_expr}, {activite_expr},
                {qualify_partition_week}
            ORDER BY {snap_expr} DESC
        ) = 1
    ),
    agg AS (
        SELECT
            matricule,
            ANY_VALUE(agent_nom)  AS agent_nom,
            ANY_VALUE(nomsirh)    AS nomsirh,
            operation,
            sous_projet,
            activite,
            projet,
            annee_iso,
            semaine_iso,
            PARSE_DATE('%G-W%V-%u', CONCAT(
                CAST(annee_iso AS STRING), '-W',
                LPAD(CAST(semaine_iso AS STRING), 2, '0'), '-1'
            ))                    AS date_ref,
{agg_kpi_block}
        FROM base
        WHERE annee_iso IS NOT NULL AND semaine_iso IS NOT NULL
        GROUP BY matricule, operation, sous_projet, activite, projet, annee_iso, semaine_iso
    )
    SELECT
        matricule, agent_nom, nomsirh, operation, sous_projet, activite, projet,
        '{cfg['type_projet']}' AS type_projet,
        annee_iso, semaine_iso, date_ref,
        FORMAT_DATE('%Y-%m', date_ref) AS mois,
{final_kpi_block}
        '{source_key}'         AS source_table,
        TIMESTAMP(@snap)       AS snapshot_date,
        CURRENT_TIMESTAMP()    AS processed_at
    FROM agg
    """

    # ── MERGE SQL ────────────────────────────────────────────────────────
    fixed_upd  = ["agent_nom", "nomsirh", "sous_projet", "type_projet",
                  "date_ref", "mois", "source_table", "snapshot_date", "processed_at"]
    update_set = ",\n        ".join(f"{c} = S.{c}" for c in fixed_upd + final_kpi_cols)
    id_cols    = ["matricule", "agent_nom", "nomsirh", "operation", "sous_projet",
                  "activite", "projet", "type_projet", "annee_iso", "semaine_iso",
                  "date_ref", "mois"] + final_kpi_cols + ["source_table", "snapshot_date", "processed_at"]
    col_list   = ", ".join(id_cols)
    val_list   = ", ".join(f"S.{c}" for c in id_cols)

    merge_sql = f"""
    MERGE {TABLE_PAIE_REF} T
    USING ( {transform_sql} ) S
    ON  T.projet       = S.projet
    AND (T.sous_projet = S.sous_projet OR (T.sous_projet IS NULL AND S.sous_projet IS NULL))
    AND T.operation    = S.operation
    AND (T.activite    = S.activite    OR (T.activite    IS NULL AND S.activite    IS NULL))
    AND T.matricule    = S.matricule
    AND T.annee_iso    = S.annee_iso
    AND T.semaine_iso  = S.semaine_iso
    WHEN MATCHED THEN UPDATE SET
        {update_set}
    WHEN NOT MATCHED THEN INSERT (
        {col_list}
    ) VALUES (
        {val_list}
    )
    """

    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("snap", "TIMESTAMP", snapshot_date)]
    )
    job = client.query(merge_sql, job_config=job_config)
    job.result()
    affected = job.num_dml_affected_rows or 0
    log.info(f"MERGE {projet_name} terminé — {affected} lignes affectées.")
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
    log.info(f"ETL paie_performance_tv — démarrage {t0:%Y-%m-%d %H:%M:%S}")
    log.info("=" * 60)

    client = bigquery.Client(project=PROJECT_ID)

    # 1. Dataset + table
    ensure_dataset(client)
    log.info("Création/vérification de la table paie_performance_tv...")
    client.query(DDL_TABLE).result()

    # 2. ETL par projet
    total = 0
    mapping_config = get_etl_config_from_db()
    if not mapping_config:
        log.warning("Aucune configuration ETL trouvée en base de données.")
        return

    for projet_name, cfg in mapping_config.items():
        try:
            log.info(f"Lancement ETL pour le projet : {projet_name}")
            total += run_etl_project(client, projet_name, cfg)
        except Exception as e:
            log.exception(f"Ã‰chec ETL pour {projet_name} : {e}")
            # On continue vers les autres projets malgrÃ© l'erreur


    # 3. Vues consolidées
    log.info("Création/mise à jour des vues consolidées...")
    client.query(DDL_VIEW_WEEK).result()
    log.info("  ✓ v_paie_agent_hebdo_tv")
    client.query(DDL_VIEW_MONTH).result()
    log.info("  ✓ v_paie_agent_mensuel_tv")
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
