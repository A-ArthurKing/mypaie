# Documentation : ETL Paie Performance (`etl_paie_performance.py`)

## 1. Rôle et Objectifs
Le worker **ETL Paie Performance** est le moteur central permettant de consolider les données brutes de performance des agents (issues de différentes sources/projets) vers une table normalisée unique : **`gcp_my_paie.paie_performance`**. 

Cette table normalisée est la base de référence utilisée ensuite pour le calcul automatique de la **paie variable** (primes, atteinte d'objectifs, etc.).

## 2. Architecture & Workflow Sécurisé

Le script fonctionne selon une approche **Méta-Data Driven** (piloté par la donnée) et **Idempotente** (peut être rejoué sans créer de doublons).

### Étape 1 : Lecture de la Configuration (MySQL)
L'ETL ne contient plus de dépendances "en dur". Au lancement, il se connecte à la base de données MySQL (`mypaie_config`) et lit la table **`ref_etl_config`**. 
Il récupère pour chaque projet actif :
- La table source dans BigQuery (ex: `dataset_pvcp.pvcp_data_outils_client_performance`).
- La famille métier du projet (ex: `TELEVENTE`).
- Le mapping JSON dynamique (comment extraire les bornes "Chiffre d'affaire", "Nb appels", etc., depuis la colonne source `METRICS`).

### Étape 2 : Extraction et Nettoyage (BigQuery)
Pour chaque projet configuré, le script génère dynamiquement une requête SQL exécutée dans BigQuery :
1. **Identification du dernier snapshot :** L'ETL isole la date d'importation la plus récente (`MAX(date_importation)`).
2. **Parsing JSON :** Traduction des variables du mapping MySQL en fonctions natives BQ `JSON_EXTRACT_SCALAR(METRICS, '$.champ')`. Prise en charge des mappings multiples avec `COALESCE`.
3. **Dédoublonnage Sécurisé :** Utilisation de la fonction analytique `QUALIFY ROW_NUMBER() OVER (...) = 1` pour garantir qu'aucune ligne en double (lié à un rejeu source) ne vienne fausser les KPIs.
4. **Normalisation de Nomenclature :** Nettoyage des dimensions croisées avec `UPPER(TRIM(...))` sur l'Opération, le Sous-Projet (File) et l'Activité.
5. **Agrégation :** Les données sont groupées à la maille : `Matricule × Opération × Sous-Projet × Activité × Semaine ISO`.

### Étape 3 : Chargement (MERGE / Upsert)
Le résultat de l'extraction est injecté dans `paie_performance` via une instruction **MERGE**. 
- Si la donnée (Agent/Opération/Semaine) existe déjà -> **UPDATE**
- Si la donnée est nouvelle -> **INSERT**
Cela garantit que relancer l'ETL plusieurs fois sur la même période ne fait que mettre à jour l'historique sans dupliquer.

### Étape 4 : Mise à jour des Vues
À la fin du traitement de tous les projets, l'ETL écrase/recrée deux vues agrégées instantanées consultables par le Frontend :
- `v_paie_agent_hebdo` (Synthèse à la semaine)
- `v_paie_agent_mensuel` (Synthèse au mois)

## 3. Paramétrage côté Base de Données

Pour ajouter un nouveau projet (ex: Projet B), aucune ligne de code Python n'est nécessaire.
Il suffit d'insérer l'enregistrement dans la table MySQL `ref_etl_config` :
```sql
INSERT INTO ref_etl_config (projet, type_projet, source_table, mapping_json) 
VALUES (
  'PROJET_B_PERF', 
  'RETENTION', 
  'gcp-project.dataset_b.raw_data_perf', 
  '{
     "fields": { "chiffre_affaire": "$.ca_global", "nb_appels": "$.calls" },
     "week_field": "$.semaine",
     "year_code_field": "$.annee"
  }'
);
```

## 4. Modes d'Exécution

**Exécution manuelle (CLI) :**
```bash
# Depuis le conteneur backend
python workers/etl_paie_performance.py
```

**Exécution via API (Frontend / Cron) :**
Une route asynchrone permet de déclencher l'ETL sans bloquer le client HTTP :
```http
POST /api/performance/etl/trigger
```
- Réponse immédiate HTTP `202 Accepted` de l'API.
- L'ETL tourne en tâche de fond (Thread) de manière silencieuse dans le backend.
