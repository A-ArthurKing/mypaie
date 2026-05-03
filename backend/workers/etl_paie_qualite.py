"""
Fichier : etl_paie_qualite.py
Rôle    : Worker ETL — consolide les notes brutes qualité (Eval Plus)
          depuis dataset_pvcp en une table normalisée gcp_my_paie.paie_qualite
          avec ventilation par item principal via la table qualite_mapping.

Architecture :
    - Lecture du DERNIER snapshot disponible (MAX Date_Import) dans la source
    - Mapping configurable par projet (table qualite_mapping)
    - Agrégation : agent × projet × date_evaluation
    - Ventilation des sous-items dans 4 items principaux (JSON) + Total par item
    - Idempotent : MERGE sur la clé (agent, projet, date_evaluation)
    - Crée les tables si absentes, seed initial du mapping si vide

Usage :
    python etl_paie_qualite.py                        # ETL complet (PVCP par défaut)
    python etl_paie_qualite.py --projet PVCP          # ETL pour un projet spécifique
    python etl_paie_qualite.py --discover             # Liste les sous-items distincts de la source
    python etl_paie_qualite.py --all-snapshots        # Traite tous les snapshots, pas seulement le dernier

Module  : mypaie / backend / workers
"""

# #region IMPORTS
import os
import sys
import json
import logging
import math
import re
import unicodedata
from collections import defaultdict
from datetime import datetime, date

from google.cloud import bigquery
from google.cloud.exceptions import GoogleCloudError
from dotenv import load_dotenv
# #endregion

# #region CONFIG
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("etl_paie_qual")

PROJECT_ID      = os.getenv("GCP_PROJECT_ID")
DATASET_PAIE    = os.getenv("BQ_DATASET_PAIE",    "gcp_my_paie")
DATASET_QUALITE = os.getenv("BQ_DATASET_QUALITE", "dataset_pvcp")
TABLE_SOURCE    = os.getenv("BQ_TABLE_QUALITE",   "pvcp_data_outils_client_qualite_fr")

TABLE_DEST    = "paie_qualite"
TABLE_MAPPING = "qualite_mapping"
TABLE_STAGING = "paie_qualite_staging"

TABLE_DEST_REF    = f"`{PROJECT_ID}.{DATASET_PAIE}.{TABLE_DEST}`"
TABLE_MAPPING_REF = f"`{PROJECT_ID}.{DATASET_PAIE}.{TABLE_MAPPING}`"
TABLE_SOURCE_REF  = f"`{PROJECT_ID}.{DATASET_QUALITE}.{TABLE_SOURCE}`"
TABLE_STAGING_REF = f"`{PROJECT_ID}.{DATASET_PAIE}.{TABLE_STAGING}`"

# Identifiants canoniques des 4 items principaux
# (code_interne, colonne_bq, libellé_affiché)
ITEMS_PRINCIPAUX = [
    ("item1", "Item1_Respect_des_criteres_et_procedures",        "Respect des critères et procédures"),
    ("item2", "Item2_Savoir_etre_et_attitudes_commerciales",     "Savoir être et attitudes commerciales"),
    ("item3", "Item3_Traitement_de_la_demande",                  "Traitement de la demande"),
    ("item4", "Item4_Savoir_faire",                              "Savoir faire"),
]

# Map : code_interne → nom_colonne dans qualite_mapping
ITEM_COL_MAPPING = {code: col for code, col, _ in ITEMS_PRINCIPAUX}
# #endregion


# #region DDL

DDL_QUALITE_MAPPING = f"""
CREATE TABLE IF NOT EXISTS {TABLE_MAPPING_REF} (
    projet                                          STRING    NOT NULL,
    dataset_source                                  STRING    NOT NULL,
    Item1_Respect_des_criteres_et_procedures        STRING,
    Item2_Savoir_etre_et_attitudes_commerciales     STRING,
    Item3_Traitement_de_la_demande                  STRING,
    Item4_Savoir_faire                              STRING,
    date_importation                                TIMESTAMP
)
OPTIONS (
    description = 'Regles de mapping des sous-items qualite vers les 4 items principaux, par projet et source de donnees. Chaque colonne Item contient un tableau JSON de noms de sous-items.'
)
"""

DDL_PAIE_QUALITE = f"""
CREATE TABLE IF NOT EXISTS {TABLE_DEST_REF} (
    agent              STRING,
    matricule          STRING,
    projet             STRING    NOT NULL,
    date_evaluation    DATE      NOT NULL,
    score_global       FLOAT64,
    date_importation   TIMESTAMP,
    item1_Respect_des_criteres_et_procedures        STRING,
    item1_Total                                     FLOAT64,
    item2_Savoir_etre_et_attitudes_commerciales     STRING,
    item2_Total                                     FLOAT64,
    item3_Traitement_de_la_demande                  STRING,
    item3_Total                                     FLOAT64,
    item4_Savoir_faire                              STRING,
    item4_Total                                     FLOAT64,
    nb_evaluations     INT64,
    source_table       STRING,
    processed_at       TIMESTAMP NOT NULL
)
PARTITION BY date_evaluation
CLUSTER BY agent, projet
OPTIONS (
    description = 'Table normalisee des notes qualite par agent et date evaluation. Les colonnes item contiennent un JSON sous_item:note_moyenne. Alimentee par etl_paie_qualite.py.'
)
"""

# Table staging recréée à chaque exécution (transitoire)
DDL_STAGING = f"""
CREATE OR REPLACE TABLE {TABLE_STAGING_REF} (
    agent              STRING,
    matricule          STRING,
    projet             STRING,
    date_evaluation    DATE,
    score_global       FLOAT64,
    date_importation   TIMESTAMP,
    item1_Respect_des_criteres_et_procedures        STRING,
    item1_Total                                     FLOAT64,
    item2_Savoir_etre_et_attitudes_commerciales     STRING,
    item2_Total                                     FLOAT64,
    item3_Traitement_de_la_demande                  STRING,
    item3_Total                                     FLOAT64,
    item4_Savoir_faire                              STRING,
    item4_Total                                     FLOAT64,
    nb_evaluations     INT64,
    source_table       STRING,
    processed_at       TIMESTAMP
)
"""
# #endregion


# #region SEED MAPPING PAR DÉFAUT
# Seed inséré si la table qualite_mapping est vide au premier lancement.
# Les tableaux de sous-items sont vides — à configurer via --discover puis UPDATE BQ.
DEFAULT_MAPPING_SEED = {
    "projet":          "PVCP",
    "dataset_source":  f"{DATASET_QUALITE}.{TABLE_SOURCE}",
    "Item1_Respect_des_criteres_et_procedures":        json.dumps([]),
    "Item2_Savoir_etre_et_attitudes_commerciales":     json.dumps([]),
    "Item3_Traitement_de_la_demande":                  json.dumps([]),
    "Item4_Savoir_faire":                              json.dumps([]),
    "date_importation": datetime.utcnow().isoformat() + "Z",
}
# #endregion


# #region INFRASTRUCTURE
def ensure_dataset(client: bigquery.Client) -> None:
    """Crée le dataset gcp_my_paie s'il n'existe pas (région EU)."""
    ds_ref = bigquery.Dataset(f"{PROJECT_ID}.{DATASET_PAIE}")
    ds_ref.location = "EU"
    client.create_dataset(ds_ref, exists_ok=True)
    log.info(f"Dataset '{DATASET_PAIE}' vérifié.")


def ensure_tables(client: bigquery.Client) -> None:
    """Crée qualite_mapping et paie_qualite si absentes.
    Si paie_qualite existe déjà avec un schéma incompatible, la recrée.
    """
    client.query(DDL_QUALITE_MAPPING).result()
    log.info(f"Table '{TABLE_MAPPING}' vérifiée.")

    # Suppression de l'ancienne table paie_qualite si elle existe (mise à jour schéma)
    drop_sql = f"DROP TABLE IF EXISTS {TABLE_DEST_REF}"
    client.query(drop_sql).result()
    log.info(f"Table '{TABLE_DEST}' supprimée (si existante) — recréation avec le nouveau schéma.")

    client.query(DDL_PAIE_QUALITE).result()
    log.info(f"Table '{TABLE_DEST}' créée avec le nouveau schéma.")


def seed_mapping_if_empty(client: bigquery.Client) -> None:
    """Insère un seed vide pour PVCP si qualite_mapping est complètement vide.
    Utilise du DML pur (pas de streaming) pour éviter les conflits de buffer BigQuery.
    """
    check_q = f"SELECT COUNT(*) AS c FROM {TABLE_MAPPING_REF}"
    count = list(client.query(check_q).result())[0]["c"]
    if count == 0:
        log.info("Table mapping vide — insertion du seed PVCP (sous-items à configurer via --auto-map).")
        insert_q = f"""
            INSERT INTO {TABLE_MAPPING_REF}
                (projet, dataset_source,
                 Item1_Respect_des_criteres_et_procedures,
                 Item2_Savoir_etre_et_attitudes_commerciales,
                 Item3_Traitement_de_la_demande,
                 Item4_Savoir_faire,
                 date_importation)
            VALUES
                (@proj, @ds, @i1, @i2, @i3, @i4, @ts)
        """
        params = [
            bigquery.ScalarQueryParameter("proj", "STRING",    "PVCP"),
            bigquery.ScalarQueryParameter("ds",   "STRING",    f"{DATASET_QUALITE}.{TABLE_SOURCE}"),
            bigquery.ScalarQueryParameter("i1",   "STRING",    "[]"),
            bigquery.ScalarQueryParameter("i2",   "STRING",    "[]"),
            bigquery.ScalarQueryParameter("i3",   "STRING",    "[]"),
            bigquery.ScalarQueryParameter("i4",   "STRING",    "[]"),
            bigquery.ScalarQueryParameter("ts",   "TIMESTAMP", datetime.utcnow()),
        ]
        client.query(insert_q, job_config=bigquery.QueryJobConfig(query_parameters=params)).result()
        log.info("  Seed PVCP inséré.")
# #endregion


# #region MODE DÉCOUVERTE
def discover_sous_items(client: bigquery.Client) -> None:
    """
    Liste les Sous_Item et Item_Global distincts depuis la source.
    Permet de remplir manuellement (ou via update_mapping) les colonnes JSON du mapping.
    """
    q = f"""
        SELECT
            Projet                  AS projet,
            Item_Global             AS item_global,
            Sous_Item               AS sous_item,
            COUNT(*)                AS nb_evaluations,
            ROUND(AVG(SAFE_CAST(Note_Sous_Item AS FLOAT64)), 2) AS note_moyenne
        FROM {TABLE_SOURCE_REF}
        WHERE Sous_Item IS NOT NULL
        GROUP BY projet, item_global, sous_item
        ORDER BY projet, item_global, sous_item
    """
    log.info("=" * 60)
    log.info(f"MODE DISCOVER — sous-items distincts dans '{DATASET_QUALITE}.{TABLE_SOURCE}'")
    log.info("=" * 60)

    try:
        rows = list(client.query(q).result())
    except GoogleCloudError as e:
        log.error(f"Erreur BigQuery lors du discover : {e}")
        return

    if not rows:
        log.warning("Aucune donnée dans la source.")
        return

    current_projet = None
    current_item   = None
    for r in rows:
        if r["projet"] != current_projet:
            current_projet = r["projet"]
            log.info(f"\n{'─'*50}")
            log.info(f"  Projet : {current_projet}")
            log.info(f"{'─'*50}")
        if r["item_global"] != current_item:
            current_item = r["item_global"]
            log.info(f"    Item_Global : {current_item}")
        log.info(f"      └─ {r['sous_item']}  ({r['nb_evaluations']} évals | moy: {r['note_moyenne']})")

    log.info("\n" + "=" * 60)
    log.info("Copiez les sous-items dans les colonnes JSON de qualite_mapping.")
    log.info("Exemple UPDATE BigQuery :")
    log.info(f"""
    UPDATE `{PROJECT_ID}.{DATASET_PAIE}.{TABLE_MAPPING}`
    SET Item1_Respect_des_criteres_et_procedures = '["Sous_Item_A", "Sous_Item_B"]',
        Item2_Savoir_etre_et_attitudes_commerciales = '["Sous_Item_C"]',
        Item3_Traitement_de_la_demande = '["Sous_Item_D", "Sous_Item_E"]',
        Item4_Savoir_faire = '["Sous_Item_F"]'
    WHERE projet = 'PVCP'
    """)
    log.info("=" * 60)
# #endregion


# #region AUTO-MAP
def _normalize(s: str) -> str:
    """Minuscules, sans accents, apostrophes/tirets/slashes → espace, espaces normalisés."""
    if not s:
        return ""
    s = s.lower().strip()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    # Remplace les apostrophes, tirets, slashes par un espace pour unifier les variantes
    s = re.sub(r"['\u2019\u2018\-/\\]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


# Règles de classification des Item_Global vers les 4 items principaux.
# Ordre : du plus spécifique au plus général.
# Chaque règle est (item_code, [patterns_sous-chaine_normalisee]).
_CLASSIFICATION_RULES = [
    # ── Item 1 : Respect des critères et procédures ──────────────────────
    ("item1", [
        "respect des criteres et procedures",
        "respect des criteres",
        "respect des procedures",
        "maitrise procedures clients",
        "maitrise procedures",
        "consignes prioritaires",
        "traitement outils",
        "criteres d eligibilite",
        "disponibilite des factures",
        "validation des coordonnees",
        "maitrise des outils",
        "pertinence des qualifications",
        "veracite des informations",
        "respect du planning",
        "fiabilisation",            # PVCP : vérification des procédures
        "taux de resolution",       # PVCP : taux de résolution au 1er contact
        "controle des ventes",      # PVCP : contrôle des ventes
    ]),
    # ── Item 2 : Savoir être et attitudes commerciales ───────────────────
    ("item2", [
        "savoir etre et attitudes commerciales",
        "savoir etre et attitudes",
        "attitudes commerciales",
        "savoir etre",
        "traitement avec le client",
        "courtoisie",
        "directivite",
        "discours souple",
        "ecoute et reactivite",
        "attitude du conseiller",
        "niveau linguistique",
        "experience client",        # PVCP : expérience client
        "posture",
        "relationnel",              # PVCP : relationnel
        "qualite humain",           # PVCP : qualité de la réponse & qualité humain(e)
        "porter de l attention",    # PVCP-APSO : porter de l'attention
    ]),
    # ── Item 3 : Traitement de la demande ────────────────────────────────
    ("item3", [
        "traitement de la demande procedures",
        "traitement de la demande process",
        "traitement de la demande",
        "traitement  de la demande",
        "structure de la demande",
        "anticipation",             # PVCP : Anticipation / Suite à donner
        "suite a donner",
        "reponse adaptee",
        "reponse apportee",
        "qualification du traitement",
        "identification de la reservation",  # PVCP-APSO
    ]),
    # ── Item 4 : Savoir faire ─────────────────────────────────────────────
    ("item4", [
        "savoir faire",
        "structure de l entretien",
        "structure entretien",
        "gestion d appel",
        "gestion appel",
        "prise de contact ou prise en charge",
        "prise de contact",
        "prise de conge",           # PVCP : prise de congé personnalisée
        "analyse du besoin",
        "argumentation",
        "closing",
        "cloture de l appel",
        "cloture",                  # PVCP : Clôture / Clôture & Satisfaction
        "conclusion de l echange",  # PVCP : Conclusion de l'échange
        "creer l echange",          # PVCP : Créer l'échange
        "preparation de l arrivee", # PVCP : Préparation de l'arrivée
        "preparation & infos",      # PVCP-APSO : Préparation & Infos Utiles
        "vente add",                # PVCP : Vente ADD-ON
        "decouverte ou diagnostic",
        "repechage des rdv",
        "conclure",
        "connaitre",
        "contacter",
        "convaincre",
    ]),
    # ── Règles génériques (catch-all) ────────────────────────────────────
    ("item1", ["respect", "maitrise", "consigne", "procedure", "critere", "fiabilit", "veracit", "controle"]),
    ("item2", ["savoir etre", "attitude", "commercial", "experience client", "relationnel"]),
    ("item3", ["traitement", "demande", "anticipat", "suite a donner", "identification"]),
    ("item4", ["savoir", "structure", "entretien", "gestion", "argumentation", "conge", "cloture", "conclusion", "preparation", "vente add"]),
]


def classify_item_global(raw: str) -> str | None:
    """
    Classe un Item_Global dans l'un des 4 codes item (item1..item4).
    Retourne None si aucune règle ne correspond.
    Les règles sont évaluées dans l'ordre — la plus spécifique d'abord.
    """
    n = _normalize(raw)
    if not n:
        return None
    for item_code, patterns in _CLASSIFICATION_RULES:
        for p in patterns:
            if p in n:
                return item_code
    return None


def auto_map_project(client: bigquery.Client, projet_filter: str) -> None:
    """
    Lit tous les (Item_Global, Sous_Item) distincts de la source pour le projet donné,
    classifie chaque Item_Global dans les 4 items principaux,
    et met à jour (ou insère) la ligne dans qualite_mapping.

    Les lignes où Sous_Item == Item_Global sont exclues (lignes agrégées/totaux).
    """
    log.info("=" * 60)
    log.info(f"MODE AUTO-MAP — projet : '{projet_filter}'")
    log.info(f"Source : {DATASET_QUALITE}.{TABLE_SOURCE}")
    log.info("=" * 60)

    # ── 1. Lecture des (Item_Global, Sous_Item) distincts ─────
    q = f"""
        SELECT
            TRIM(Projet)      AS projet,
            TRIM(Item_Global) AS item_global,
            TRIM(Sous_Item)   AS sous_item
        FROM {TABLE_SOURCE_REF}
        WHERE Sous_Item IS NOT NULL
          AND Item_Global IS NOT NULL
          AND TRIM(Sous_Item) != TRIM(Item_Global)
          AND TRIM(Projet) LIKE @filtre
        GROUP BY 1, 2, 3
        ORDER BY 1, 2, 3
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("filtre", "STRING", f"%{projet_filter}%")
        ]
    )
    try:
        rows = list(client.query(q, job_config=job_config).result())
    except GoogleCloudError as e:
        log.error(f"Erreur lecture source : {e}")
        return

    if not rows:
        log.warning(f"Aucune donnée pour le filtre projet '{projet_filter}'.")
        return

    log.info(f"  {len(rows)} paires (Item_Global, Sous_Item) distinctes lues.")

    # ── 2. Groupement par projet ──────────────────────────────
    # { projet: { item_code: [sous_items] } }
    by_projet: dict[str, dict[str, list]] = defaultdict(
        lambda: {"item1": [], "item2": [], "item3": [], "item4": [], "_non_classe": []}
    )

    # Déduplification des sous-items par (projet, item_code)
    seen: dict[str, set] = defaultdict(set)

    for r in rows:
        projet  = r["projet"]
        ig      = r["item_global"]
        si      = r["sous_item"]
        code    = classify_item_global(ig)
        key     = f"{projet}|{code or '_non_classe'}"

        if si not in seen[key]:
            seen[key].add(si)
            by_projet[projet][code or "_non_classe"].append(si)

    # ── 3. Rapport de classification ──────────────────────────
    log.info("")
    for projet, items in sorted(by_projet.items()):
        log.info(f"  Projet : {projet}")
        for code, _, label in ITEMS_PRINCIPAUX:
            count = len(items[code])
            log.info(f"    {label[:45]:<45} → {count:3d} sous-items")
        non_cls = items["_non_classe"]
        if non_cls:
            log.warning(f"    ⚠ Non classifiés ({len(non_cls)}) sous-items : {non_cls[:5]}{'...' if len(non_cls) > 5 else ''}")
        log.info("")

    # Rapport des Item_Global non classifiés (aide au diagnostic des règles)
    unclassified_ig: dict[str, set] = defaultdict(set)
    for r in rows:
        ig   = r["item_global"]
        proj = r["projet"]
        if classify_item_global(ig) is None:
            unclassified_ig[proj].add(ig)

    has_unclassified = any(v for v in unclassified_ig.values())
    if has_unclassified:
        log.warning("─" * 60)
        log.warning("Item_Global NON CLASSIFIÉS (à ajouter dans _CLASSIFICATION_RULES) :")
        for proj, igs in sorted(unclassified_ig.items()):
            log.warning(f"  Projet '{proj}' :")
            for ig in sorted(igs):
                log.warning(f"    • \"{ig}\"  →  normalisé: \"{_normalize(ig)}\"")
        log.warning("─" * 60)

    # ── 4. Upsert dans qualite_mapping via TRUNCATE + INSERT DML ─
    # TRUNCATE vide le streaming buffer BigQuery et permet les DML ensuite.
    log.info(f"  TRUNCATE qualite_mapping (vide le streaming buffer)...")
    client.query(f"TRUNCATE TABLE {TABLE_MAPPING_REF}").result()

    for projet, items in sorted(by_projet.items()):
        item1_json = json.dumps(sorted(items["item1"]), ensure_ascii=False)
        item2_json = json.dumps(sorted(items["item2"]), ensure_ascii=False)
        item3_json = json.dumps(sorted(items["item3"]), ensure_ascii=False)
        item4_json = json.dumps(sorted(items["item4"]), ensure_ascii=False)

        insert_q = f"""
            INSERT INTO {TABLE_MAPPING_REF}
                (projet, dataset_source,
                 Item1_Respect_des_criteres_et_procedures,
                 Item2_Savoir_etre_et_attitudes_commerciales,
                 Item3_Traitement_de_la_demande,
                 Item4_Savoir_faire,
                 date_importation)
            VALUES
                (@proj, @ds, @i1, @i2, @i3, @i4, @ts)
        """
        params = [
            bigquery.ScalarQueryParameter("proj", "STRING",    projet),
            bigquery.ScalarQueryParameter("ds",   "STRING",    f"{DATASET_QUALITE}.{TABLE_SOURCE}"),
            bigquery.ScalarQueryParameter("i1",   "STRING",    item1_json),
            bigquery.ScalarQueryParameter("i2",   "STRING",    item2_json),
            bigquery.ScalarQueryParameter("i3",   "STRING",    item3_json),
            bigquery.ScalarQueryParameter("i4",   "STRING",    item4_json),
            bigquery.ScalarQueryParameter("ts",   "TIMESTAMP", datetime.utcnow()),
        ]
        client.query(insert_q, job_config=bigquery.QueryJobConfig(query_parameters=params)).result()
        log.info(f"  ✓ INSERT qualite_mapping — projet '{projet}'")

    log.info("=" * 60)
    log.info("Auto-map terminé. Vérifiez le résultat dans BigQuery Console.")
    log.info(f"  SELECT * FROM `{PROJECT_ID}.{DATASET_PAIE}.{TABLE_MAPPING}`")
    log.info("=" * 60)
# #endregion


# #region LECTURE SOURCE
def get_snapshot_dates(client: bigquery.Client, only_last: bool = True) -> list:
    """Retourne la ou les dates de snapshot à traiter."""
    if only_last:
        q = f"SELECT MAX(Date_Import) AS d FROM {TABLE_SOURCE_REF}"
        rows = list(client.query(q).result())
        d = rows[0]["d"] if rows else None
        return [d] if d else []
    else:
        q = f"SELECT DISTINCT Date_Import AS d FROM {TABLE_SOURCE_REF} ORDER BY d"
        return [r["d"] for r in client.query(q).result()]


def fetch_source_data(client: bigquery.Client, snapshot_date) -> list:
    """
    Lit toutes les lignes de notes qualité pour un snapshot donné.
    Retourne une liste de dicts avec les colonnes normalisées.
    """
    q = f"""
        SELECT
            TRIM(Agent)               AS agent,
            TRIM(Projet)              AS projet,
            DATE(Date_Evaluation)     AS date_evaluation,
            TRIM(Sous_Item)           AS sous_item,
            TRIM(Item_Global)         AS item_global,
            SAFE_CAST(Note_Sous_Item AS FLOAT64) AS note,
            Date_Import               AS date_importation
        FROM {TABLE_SOURCE_REF}
        WHERE Date_Import = @snap
          AND Agent        IS NOT NULL
          AND Sous_Item    IS NOT NULL
          AND Note_Sous_Item IS NOT NULL
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("snap", "DATETIME", snapshot_date)]
    )
    try:
        rows = list(client.query(q, job_config=job_config).result())
        log.info(f"  {len(rows)} lignes lues (snapshot {snapshot_date}).")
        return [dict(r) for r in rows]
    except GoogleCloudError as e:
        log.error(f"Erreur lecture source : {e}")
        raise
# #endregion


# #region MAPPING
def load_mapping(client: bigquery.Client, projet: str) -> dict[str, set]:
    """
    Charge le mapping qualite_mapping pour un projet.
    Cherche d'abord le projet exact, puis le wildcard '*'.
    Retourne { "item1": {"sous_item_a", "sous_item_b"}, "item2": {...}, ... }
    """
    q = f"""
        SELECT
            Item1_Respect_des_criteres_et_procedures,
            Item2_Savoir_etre_et_attitudes_commerciales,
            Item3_Traitement_de_la_demande,
            Item4_Savoir_faire
        FROM {TABLE_MAPPING_REF}
        WHERE projet = @projet OR projet = '*'
        ORDER BY CASE WHEN projet = @projet THEN 0 ELSE 1 END
        LIMIT 1
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("projet", "STRING", projet)]
    )
    rows = list(client.query(q, job_config=job_config).result())

    result: dict[str, set] = {code: set() for code, _, _ in ITEMS_PRINCIPAUX}

    if not rows:
        log.warning(f"Aucun mapping trouvé pour le projet '{projet}' ni pour '*'. Tous les sous-items seront non-classifiés.")
        return result

    row = dict(rows[0])
    for code, col, label in ITEMS_PRINCIPAUX:
        raw = row.get(col) or "[]"
        try:
            items_list = json.loads(raw)
            # Normalisation : lowercase + strip pour la comparaison
            result[code] = {si.strip() for si in items_list}
        except (json.JSONDecodeError, TypeError):
            log.warning(f"  JSON invalide pour {col} : {raw}")
            result[code] = set()

    total = sum(len(v) for v in result.values())
    log.info(f"  Mapping chargé : {total} sous-items configurés pour le projet '{projet}'.")
    return result
# #endregion


# #region AGRÉGATION
def _safe_round(value, decimals: int = 4):
    """Arrondi sécurisé, retourne None si NaN/Inf."""
    if value is None:
        return None
    try:
        if math.isnan(value) or math.isinf(value):
            return None
        return round(value, decimals)
    except (TypeError, ValueError):
        return None


def _serialize_date(d) -> str | None:
    """Convertit date/datetime en string YYYY-MM-DD pour BigQuery."""
    if d is None:
        return None
    if isinstance(d, str):
        return d[:10]
    if isinstance(d, (date, datetime)):
        return d.strftime("%Y-%m-%d")
    return str(d)[:10]


def _serialize_timestamp(ts) -> str | None:
    """Convertit un timestamp en string ISO pour BigQuery."""
    if ts is None:
        return None
    if isinstance(ts, str):
        return ts
    if isinstance(ts, datetime):
        return ts.isoformat() + "Z"
    return str(ts)


def aggregate_rows(rows: list, mapping: dict[str, set], source_table: str) -> list:
    """
    Agrège les notes par (agent, projet, date_evaluation).

    Pour chaque groupe :
      - Moyenne par sous-item → affectation à l'item principal via mapping
      - Sérialisation en JSON {"sous_item": note_moy, ...} par item
      - Calcul des totaux par item (moyenne des moyennes de sous-items)
      - Score global = moyenne de toutes les notes brutes du groupe
    """
    # Groupement primaire : {(agent, projet, date_eval): {sous_item: [notes brutes]}}
    grouped: dict[tuple, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    # Conservation de la date_importation par groupe (on prend la première rencontrée)
    date_importation_map: dict[tuple, any] = {}

    for r in rows:
        key = (r["agent"], r["projet"], _serialize_date(r["date_evaluation"]))
        grouped[key][r["sous_item"]].append(r["note"])
        if key not in date_importation_map:
            date_importation_map[key] = r["date_importation"]

    # Index inverse : sous_item (normalisé) → code item
    sous_item_to_code: dict[str, str] = {}
    for code, sous_items_set in mapping.items():
        for si in sous_items_set:
            sous_item_to_code[si.strip()] = code

    records = []
    for (agent, projet, date_eval), sous_items_notes in grouped.items():

        # Moyenne par sous-item
        avg_per_sous_item = {
            si: _safe_round(sum(notes) / len(notes))
            for si, notes in sous_items_notes.items()
            if notes
        }

        # Ventilation dans les 4 items
        items_data: dict[str, dict] = {"item1": {}, "item2": {}, "item3": {}, "item4": {}}
        non_mappes: dict[str, float] = {}

        for si, avg in avg_per_sous_item.items():
            code = sous_item_to_code.get(si.strip())
            if code and code in items_data:
                items_data[code][si] = avg
            else:
                non_mappes[si] = avg

        if non_mappes:
            log.debug(f"  [{agent} / {projet} / {date_eval}] sous-items non mappés : {list(non_mappes.keys())}")

        # Total par item (moyenne des moyennes de sous-items de l'item)
        def item_total(data: dict) -> float | None:
            vals = [v for v in data.values() if v is not None]
            return _safe_round(sum(vals) / len(vals)) if vals else None

        # Score global = moyenne de toutes les notes brutes du groupe
        all_notes = [n for notes in sous_items_notes.values() for n in notes if n is not None]
        score_global = _safe_round(sum(all_notes) / len(all_notes)) if all_notes else None

        records.append({
            "agent":            agent,
            "matricule":        None,   # enrichi dans enrich_matricules() si table agent_mapping dispo
            "projet":           projet,
            "date_evaluation":  date_eval,
            "score_global":     score_global,
            "date_importation": _serialize_timestamp(date_importation_map.get((agent, projet, date_eval))),
            # Item 1 — Respect des critères et procédures
            "item1_Respect_des_criteres_et_procedures":       json.dumps(items_data["item1"], ensure_ascii=False),
            "item1_Total":                                    item_total(items_data["item1"]),
            # Item 2 — Savoir être et attitudes commerciales
            "item2_Savoir_etre_et_attitudes_commerciales":    json.dumps(items_data["item2"], ensure_ascii=False),
            "item2_Total":                                    item_total(items_data["item2"]),
            # Item 3 — Traitement de la demande
            "item3_Traitement_de_la_demande":                 json.dumps(items_data["item3"], ensure_ascii=False),
            "item3_Total":                                    item_total(items_data["item3"]),
            # Item 4 — Savoir faire
            "item4_Savoir_faire":                             json.dumps(items_data["item4"], ensure_ascii=False),
            "item4_Total":                                    item_total(items_data["item4"]),
            "nb_evaluations":   len(sous_items_notes),
            "source_table":     source_table,
            "processed_at":     datetime.utcnow().isoformat() + "Z",
        })

    return records
# #endregion


# #region ENRICHISSEMENT MATRICULES
def enrich_matricules(client: bigquery.Client, records: list) -> list:
    """
    Tente d'enrichir les matricules depuis gcp_my_paie.agent_mapping (table optionnelle).
    Colonnes attendues dans agent_mapping : agent_nom STRING, matricule STRING.
    Si la table n'existe pas, les matricules restent NULL.
    """
    agent_map_ref = f"`{PROJECT_ID}.{DATASET_PAIE}.agent_mapping`"
    try:
        q = f"SELECT TRIM(agent_nom) AS agent_nom, matricule FROM {agent_map_ref}"
        rows = list(client.query(q).result())
        mapping = {r["agent_nom"].strip().lower(): r["matricule"] for r in rows if r["agent_nom"]}
        matched = 0
        for rec in records:
            if rec.get("agent"):
                m = mapping.get(rec["agent"].strip().lower())
                if m:
                    rec["matricule"] = m
                    matched += 1
        log.info(f"  Enrichissement matricules — {len(mapping)} agents dans agent_mapping, {matched}/{len(records)} records enrichis.")
    except GoogleCloudError as e:
        log.warning(f"  Table agent_mapping introuvable ou inaccessible — matricule restera NULL. ({e})")
    return records
# #endregion


# #region CHARGEMENT STAGING + MERGE
_BATCH_SIZE = 5_000   # insert_rows_json : max recommandé BigQuery


def load_to_staging(client: bigquery.Client, records: list) -> None:
    """
    Crée la table staging (CREATE OR REPLACE) et charge les records par batches.
    """
    # Recréation de la staging table à chaque run
    client.query(DDL_STAGING).result()

    if not records:
        log.warning("  Aucun record à charger dans staging.")
        return

    table_id = f"{PROJECT_ID}.{DATASET_PAIE}.{TABLE_STAGING}"
    total_errors = []

    for i in range(0, len(records), _BATCH_SIZE):
        batch = records[i : i + _BATCH_SIZE]
        errors = client.insert_rows_json(table_id, batch)
        if errors:
            total_errors.extend(errors[:3])  # on garde seulement les 3 premiers pour le log
        log.info(f"  Batch {i // _BATCH_SIZE + 1} : {len(batch)} records insérés.")

    if total_errors:
        log.error(f"Erreurs lors de l'insert staging (extraits) : {total_errors}")
        raise RuntimeError("Échec partiel du chargement staging.")

    log.info(f"  Total staging : {len(records)} records.")


def merge_staging_to_dest(client: bigquery.Client) -> int:
    """
    MERGE idempotent depuis staging vers paie_qualite.
    Clé de merge : (agent, projet, date_evaluation).
    """
    merge_sql = f"""
    MERGE {TABLE_DEST_REF} T
    USING {TABLE_STAGING_REF} S
    ON  T.agent            = S.agent
    AND T.projet           = S.projet
    AND T.date_evaluation  = S.date_evaluation
    WHEN MATCHED THEN UPDATE SET
        -- Conservation du matricule existant si le nouveau est NULL
        matricule          = COALESCE(S.matricule, T.matricule),
        score_global       = S.score_global,
        date_importation   = S.date_importation,
        item1_Respect_des_criteres_et_procedures        = S.item1_Respect_des_criteres_et_procedures,
        item1_Total                                     = S.item1_Total,
        item2_Savoir_etre_et_attitudes_commerciales     = S.item2_Savoir_etre_et_attitudes_commerciales,
        item2_Total                                     = S.item2_Total,
        item3_Traitement_de_la_demande                  = S.item3_Traitement_de_la_demande,
        item3_Total                                     = S.item3_Total,
        item4_Savoir_faire                              = S.item4_Savoir_faire,
        item4_Total                                     = S.item4_Total,
        nb_evaluations     = S.nb_evaluations,
        source_table       = S.source_table,
        processed_at       = S.processed_at
    WHEN NOT MATCHED THEN INSERT (
        agent, matricule, projet, date_evaluation, score_global, date_importation,
        item1_Respect_des_criteres_et_procedures, item1_Total,
        item2_Savoir_etre_et_attitudes_commerciales, item2_Total,
        item3_Traitement_de_la_demande, item3_Total,
        item4_Savoir_faire, item4_Total,
        nb_evaluations, source_table, processed_at
    ) VALUES (
        S.agent, S.matricule, S.projet, S.date_evaluation, S.score_global, S.date_importation,
        S.item1_Respect_des_criteres_et_procedures, S.item1_Total,
        S.item2_Savoir_etre_et_attitudes_commerciales, S.item2_Total,
        S.item3_Traitement_de_la_demande, S.item3_Total,
        S.item4_Savoir_faire, S.item4_Total,
        S.nb_evaluations, S.source_table, S.processed_at
    )
    """
    job = client.query(merge_sql)
    job.result()
    affected = job.num_dml_affected_rows or 0
    log.info(f"  MERGE terminé — {affected} lignes affectées.")
    return affected
# #endregion


# #region MAIN
def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="ETL paie_qualite — consolide les notes brutes Eval Plus en table normalisée."
    )
    parser.add_argument(
        "--discover",
        action="store_true",
        help="Mode découverte : liste les sous-items distincts depuis la source (ne fait pas d'ETL).",
    )
    parser.add_argument(
        "--projet",
        default="PVCP",
        help="Projet à utiliser pour le mapping (défaut: PVCP). Utilisé aussi comme filtre si --filter-projet est activé.",
    )
    parser.add_argument(
        "--all-snapshots",
        action="store_true",
        help="Traite tous les snapshots disponibles, pas seulement le dernier.",
    )
    parser.add_argument(
        "--auto-map",
        action="store_true",
        help="Lit la source BigQuery et classe automatiquement les sous-items dans les 4 items principaux via matching par mots-clés. Met à jour qualite_mapping.",
    )
    args = parser.parse_args()

    t0 = datetime.now()
    log.info("=" * 60)
    log.info(f"ETL paie_qualite — démarrage {t0:%Y-%m-%d %H:%M:%S}")
    log.info(f"Source  : {PROJECT_ID}.{DATASET_QUALITE}.{TABLE_SOURCE}")
    log.info(f"Dest    : {PROJECT_ID}.{DATASET_PAIE}.{TABLE_DEST}")
    log.info("=" * 60)

    client = bigquery.Client(project=PROJECT_ID)

    # ── 1. Infrastructure ─────────────────────────────────────
    ensure_dataset(client)
    ensure_tables(client)
    seed_mapping_if_empty(client)

    # ── Mode découverte ───────────────────────────────────────
    if args.discover:
        discover_sous_items(client)
        log.info("Mode discover terminé. Configurez qualite_mapping puis relancez sans --discover.")
        return

    # ── Mode auto-map ─────────────────────────────────────────
    if args.auto_map:
        auto_map_project(client, args.projet)
        return

    # ── 2. Snapshots à traiter ────────────────────────────────
    log.info("Recherche des snapshots disponibles dans la source...")
    snapshots = get_snapshot_dates(client, only_last=not args.all_snapshots)
    if not snapshots:
        log.error("Aucun snapshot disponible dans la source. ETL abandonné.")
        sys.exit(1)
    log.info(f"  {len(snapshots)} snapshot(s) à traiter.")

    # ── 3. Mapping ────────────────────────────────────────────
    log.info(f"Chargement du mapping pour le projet '{args.projet}'...")
    mapping = load_mapping(client, args.projet)
    configured_count = sum(len(v) for v in mapping.values())
    if configured_count == 0:
        log.warning("  Mapping vide — tous les sous-items seront non-classifiés dans les items.")
        log.warning("  Lancez avec --discover pour obtenir la liste des sous-items à configurer.")

    # ── 4. ETL par snapshot ───────────────────────────────────
    total_affected = 0
    source_table_str = f"{DATASET_QUALITE}.{TABLE_SOURCE}"

    for snap in snapshots:
        log.info(f"\n{'─'*50}")
        log.info(f"Snapshot : {snap}")
        log.info(f"{'─'*50}")

        # Lecture
        log.info("  Lecture des données source...")
        rows = fetch_source_data(client, snap)
        if not rows:
            log.warning(f"  Aucune donnée pour le snapshot {snap}. Ignoré.")
            continue

        # Agrégation
        log.info("  Agrégation en cours...")
        records = aggregate_rows(rows, mapping, source_table_str)
        log.info(f"  → {len(records)} records (agent × projet × date_evaluation).")

        # Enrichissement matricules
        log.info("  Enrichissement matricules...")
        records = enrich_matricules(client, records)

        # Staging
        log.info("  Chargement staging...")
        load_to_staging(client, records)

        # MERGE
        log.info("  MERGE vers paie_qualite...")
        affected = merge_staging_to_dest(client)
        total_affected += affected

    # ── 5. Stats finales ──────────────────────────────────────
    stats_q = f"""
        SELECT
            COUNT(*)             AS total_lignes,
            COUNT(DISTINCT agent) AS nb_agents,
            COUNT(DISTINCT projet) AS nb_projets,
            MIN(date_evaluation) AS premiere_eval,
            MAX(date_evaluation) AS derniere_eval,
            COUNTIF(matricule IS NOT NULL) AS nb_avec_matricule
        FROM {TABLE_DEST_REF}
    """
    stats = list(client.query(stats_q).result())[0]
    elapsed = (datetime.now() - t0).total_seconds()

    log.info("\n" + "=" * 60)
    log.info(f"BILAN — {elapsed:.1f}s")
    log.info(f"  Total lignes paie_qualite  : {stats['total_lignes']}")
    log.info(f"  Agents distincts            : {stats['nb_agents']}")
    log.info(f"  Projets distincts           : {stats['nb_projets']}")
    log.info(f"  Première évaluation         : {stats['premiere_eval']}")
    log.info(f"  Dernière évaluation         : {stats['derniere_eval']}")
    log.info(f"  Lignes avec matricule       : {stats['nb_avec_matricule']}")
    log.info(f"  Lignes MERGE ce run         : {total_affected}")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
# #endregion
