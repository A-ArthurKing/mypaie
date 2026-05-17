# ⚙️ Documentation : Worker ETL Universel Performance (`universal_performance_etl.py`)

## 📍 Rôle du fichier
Le fichier `universal_performance_etl.py` est le script central (Worker) responsable de consolider les données de **Performance** éparpillées sur Google Cloud Platform (GCP) vers une base unifiée pour MyPaie.

Il s'agit de la **nouvelle architecture ETL Universelle** (Méta-Data Driven). Contrairement à l'ancienne version qui lisait des fichiers en dur, cet ETL est capable de traiter n'importe quel nouveau projet de l'entreprise simplement en lisant la table de configuration `config_etl_sources`.

---

## 🧠 Principes & Architecture Silver / Gold

Ce script s'appuie sur la méthodologie standard Medallion Architecture (Bronze / Silver / Gold) très utilisée en Data Engineering :

### 1. La Couche Configuration (`config_etl_sources`)
Le script commence par lire cette table BigQuery. C'est ici qu'on définit que "Pour le projet PVCP, va lire la table X, et la colonne qui contient le JSON s'appelle METRICS".

### 2. La Couche Silver (`paie_performance`)
La fonction `run()` extrait les données des tables sources (souvent en format JSON brut / Bronze) et les normalise en mode **Tall Data** (Données longues) :
`[Matricule] | [Date] | [Projet] | [Code KPI] | [Valeur]`
*Note: Il utilise une fonction Javascript stockée dans BQ (`deplier_json`) pour exploser un JSON en de multiples lignes SQL à la volée grâce à un `UNNEST`.*

L'insertion dans Silver se fait via un **MERGE** (Upsert) pour garantir l'idempotence : si on relance l'ETL deux fois le même jour, il ne crée pas de doublons, il met simplement la valeur à jour.

### 3. La Couche Gold (`paie_performance_mensuelle`)
La fonction `gold()` est chargée d'optimiser la donnée pour la lecture rapide par l'application web. 
Elle regroupe toutes les lignes journalières par **Mois** (ex: `2026-05`). Elle calcule les sommes (`valeur_sum`) et les moyennes (`valeur_avg`). La table résultante est "Clustered" (indexée) par matricule et mois pour que le backend de la paie puisse l'interroger en quelques millisecondes.

---

## 🛠️ Comment ajouter un projet Performance ?

Vous n'avez pas besoin de toucher à ce code Python !

Si un nouveau projet s'ajoute (ex: "TOTAL_ENERGIES"), ajoutez simplement une ligne dans la table `config_etl_sources` de BigQuery :
```sql
INSERT INTO `gcp_my_paie.config_etl_sources` 
(id, univers, projet_nom, table_source, type_structure, colonne_cle_json, colonne_matricule, colonne_date)
VALUES 
(3, 'PERFORMANCE', 'TOTAL_PERF', 'dataset_total.data_outils_perf', 'JSON', 'METRICS', 'MATRICULE', 'date_importation')
```
Au prochain passage, la boucle `for src in sources:` du script détectera le nouveau projet et l'ingèrera automatiquement dans la table Silver puis Gold.
