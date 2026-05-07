import os
import json
import logging
import unicodedata
import re
from datetime import datetime
from collections import defaultdict
from google.cloud import bigquery
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("migrate_pvcp")

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "data-project-438313")
DATASET_PAIE = "gcp_my_paie"
DATASET_QUALITE = "dataset_pvcp"

TABLES_SOURCE = {
    "fr": "pvcp_data_outils_client_qualite_fr",
    "ge": "pvcp_data_outils_client_qualite_ge",
    "be": "pvcp_data_outils_client_qualite_be"
}

TABLE_DEST = f"`{PROJECT_ID}.{DATASET_PAIE}.paie_qualite`"
TABLE_MAPPING = f"`{PROJECT_ID}.{DATASET_PAIE}.qualite_mapping`"
TABLE_STAGING = f"`{PROJECT_ID}.{DATASET_PAIE}.paie_qualite_staging`"

ITEMS_PRINCIPAUX = [
    ("item1", "Item1_Respect_des_criteres_et_procedures"),
    ("item2", "Item2_Savoir_etre_et_attitudes_commerciales"),
    ("item3", "Item3_Traitement_de_la_demande"),
    ("item4", "Item4_Savoir_faire"),
]

# Les mêmes règles de classification que dans etl_paie_qualite.py
_CLASSIFICATION_RULES = [
    ("item1", [
        "respect des criteres et procedures", "respect des criteres", "respect des procedures",
        "maitrise procedures", "consignes prioritaires", "traitement outils", "criteres d eligibilite",
        "disponibilite des factures", "validation des coordonnees", "maitrise des outils",
        "pertinence des qualifications", "veracite des informations", "respect du planning",
        "fiabilisation", "taux de resolution", "controle des ventes",
        "verifications", "verification", "process"
    ]),
    ("item2", [
        "savoir etre et attitudes commerciales", "savoir etre", "attitudes commerciales",
        "sourire", "empathie", "ecoute", "personnalisation", "politesse",
        "gestion des conflits", "ton", "vocabulaire", "dynamisme", "remerciement", "accueil",
        "prise de conge", "force d ecoute", "discours"
    ]),
    ("item3", [
        "traitement de la demande", "reponse au besoin", "solution", "delai", "completude", "precision",
        "traitement des objections", "argumentation", "conseil", "valorisation"
    ]),
    ("item4", [
        "savoir faire", "technique", "maitrise", "reformulation", "synthese", "conclusion",
        "gestion de la mise en attente", "anticipation"
    ]),
]

def _normalize(s: str) -> str:
    if not s: return ""
    s = s.lower().strip()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"['\u2019\u2018\-/\\]", " ", s)
    # Remplacer les underscores par des espaces pour les clés JSON
    s = s.replace('_', ' ')
    s = re.sub(r"\s+", " ", s).strip()
    return s

def classify_sous_item(sous_item: str) -> str:
    norm = _normalize(sous_item)
    for code, patterns in _CLASSIFICATION_RULES:
        for p in patterns:
            if p in norm:
                return code
    return "_non_classe"

def main():
    client = bigquery.Client(project=PROJECT_ID)
    
    # Etape 1 : Lire les données de toutes les tables, extraire les clés de METRICS
    all_data = []
    project_keys = defaultdict(set)
    
    for suffix, tbl_name in TABLES_SOURCE.items():
        log.info(f"Lecture de la table {tbl_name}...")
        q = f"SELECT * FROM `{PROJECT_ID}.{DATASET_QUALITE}.{tbl_name}`"
        rows = list(client.query(q).result())
        for row in rows:
            metrics_str = row.get("METRICS")
            if not metrics_str: continue
            try:
                metrics = json.loads(metrics_str)
                for key in metrics.keys():
                    project_keys[row["PROJET"]].add(key)
            except:
                pass
            all_data.append(dict(row))
            
    log.info(f"{len(all_data)} lignes lues au total.")
    
    # Etape 2 : Mapper les clés par projet et insérer dans qualite_mapping
    mapping_par_projet = {}
    for proj, keys in project_keys.items():
        mapping = {"item1": [], "item2": [], "item3": [], "item4": [], "_non_classe": []}
        for k in keys:
            code = classify_sous_item(k)
            mapping[code].append(k)
        
        mapping_par_projet[proj] = mapping
        log.info(f"Projet {proj} : {len(keys)} clés (Non classées: {len(mapping['_non_classe'])})")
        if mapping['_non_classe']:
            log.warning(f"  Non classées: {mapping['_non_classe']}")
            
        # Delete old mapping for this project
        client.query(f"DELETE FROM {TABLE_MAPPING} WHERE projet = '{proj}'").result()
        
        # Insert new mapping
        insert_q = f"""
            INSERT INTO {TABLE_MAPPING}
                (projet, dataset_source, Item1_Respect_des_criteres_et_procedures,
                 Item2_Savoir_etre_et_attitudes_commerciales, Item3_Traitement_de_la_demande,
                 Item4_Savoir_faire, date_importation)
            VALUES (@proj, @ds, @i1, @i2, @i3, @i4, @ts)
        """
        params = [
            bigquery.ScalarQueryParameter("proj", "STRING", proj),
            bigquery.ScalarQueryParameter("ds", "STRING", f"{DATASET_QUALITE}.pvcp_data_outils_client_qualite_*"),
            bigquery.ScalarQueryParameter("i1", "STRING", json.dumps(mapping["item1"], ensure_ascii=False)),
            bigquery.ScalarQueryParameter("i2", "STRING", json.dumps(mapping["item2"], ensure_ascii=False)),
            bigquery.ScalarQueryParameter("i3", "STRING", json.dumps(mapping["item3"], ensure_ascii=False)),
            bigquery.ScalarQueryParameter("i4", "STRING", json.dumps(mapping["item4"], ensure_ascii=False)),
            bigquery.ScalarQueryParameter("ts", "TIMESTAMP", datetime.utcnow()),
        ]
        client.query(insert_q, job_config=bigquery.QueryJobConfig(query_parameters=params)).result()
        log.info(f"Mapping inséré pour {proj}")

    # Etape 3 : Traiter les données et préparer pour paie_qualite
    # paie_qualite schema:
    # agent, matricule, projet, date_evaluation, score_global, date_importation,
    # item1_*, item1_Total, item2_*, item2_Total, etc.
    
    # On va agréger par agent, projet, date_evaluation (même si chaque ligne est probablement une éval)
    aggregated = defaultdict(list)
    for r in all_data:
        agent = r.get("Nom_de_l_agent", "").strip()
        mat = r.get("MATRICULE")
        proj = r["PROJET"]
        date_eval = r["Date_Evaluation"]
        if isinstance(date_eval, datetime):
            date_eval = date_eval.date().isoformat()
        elif hasattr(date_eval, "isoformat"):
            date_eval = date_eval.isoformat()
        else:
            date_eval = str(date_eval)
            
        key = (agent, proj, date_eval)
        aggregated[key].append(r)
        
    records_to_insert = []
    
    for (agent, proj, date_eval), rows_group in aggregated.items():
        mat = None
        for r in rows_group:
            if r.get("MATRICULE"): mat = r["MATRICULE"]
            
        item_scores = {"item1": [], "item2": [], "item3": [], "item4": []}
        item_details = {"item1": {}, "item2": {}, "item3": {}, "item4": {}}
        score_globaux = []
        
        for r in rows_group:
            try:
                metrics = json.loads(r["METRICS"])
            except:
                continue
                
            for k, val in metrics.items():
                if val is None: continue
                # Trouver à quel item ça appartient
                code = "item4" # par defaut
                for item_code in ["item1", "item2", "item3", "item4"]:
                    if k in mapping_par_projet[proj][item_code]:
                        code = item_code
                        break
                
                v = float(val)
                item_scores[code].append(v)
                
                # Pour le détail JSON, on fait la moyenne si c'est renseigné plusieurs fois (peu probable sur 1 jour)
                if k not in item_details[code]:
                    item_details[code][k] = []
                item_details[code][k].append(v)
                
        # Calculer les totaux
        rec = {
            "agent": agent,
            "matricule": mat,
            "projet": proj,
            "date_evaluation": date_eval,
            "date_importation": datetime.utcnow().isoformat(),
            "nb_evaluations": len(rows_group),
            "source_table": "dataset_pvcp.pvcp_data_outils_client_qualite_*",
            "processed_at": datetime.utcnow().isoformat()
        }
        
        total_global = 0
        nb_global = 0
        for code, col in ITEMS_PRINCIPAUX:
            avg_score = sum(item_scores[code]) / len(item_scores[code]) if item_scores[code] else None
            rec[f"{code}_Total"] = round(avg_score, 2) if avg_score is not None else None
            
            # Détails
            final_details = {}
            for k, vals in item_details[code].items():
                final_details[k] = round(sum(vals)/len(vals), 2)
            rec[col] = json.dumps(final_details, ensure_ascii=False) if final_details else None
            
            if avg_score is not None:
                total_global += avg_score
                nb_global += 1
                
        rec["score_global"] = round(total_global / nb_global, 2) if nb_global > 0 else None
        records_to_insert.append(rec)
        
    log.info(f"Préparation de {len(records_to_insert)} records pour paie_qualite.")
    
    # Etape 4 : Insérer dans paie_qualite
    import tempfile
    tmp_path = os.path.join(tempfile.gettempdir(), "pvcp_qualite.jsonl")
    with open(tmp_path, "w", encoding="utf-8") as f:
        for r in records_to_insert:
            f.write(json.dumps(r) + "\n")
            
    # Supprimer les anciennes données de ces projets pour éviter les doublons
    client.query(f"DELETE FROM {TABLE_DEST} WHERE projet IN ('PVCP_QUALITY_FR', 'PVCP_QUALITY_GE', 'PVCP_QUALITY_BE')").result()
            
    job_config = bigquery.LoadJobConfig(
        source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
        write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
    )
    
    with open(tmp_path, "rb") as f:
        job = client.load_table_from_file(f, TABLE_DEST.replace("`", ""), job_config=job_config)
    job.result()
    
    os.remove(tmp_path)
    log.info(f"Migration terminée ! {len(records_to_insert)} lignes insérées dans paie_qualite.")

if __name__ == "__main__":
    main()
