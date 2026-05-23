# ⚙️ Documentation : Worker ETL Universel (`universal_etl.py`)

## 📍 Rôle du fichier
Le fichier `universal_etl.py` est le script centralisé (Worker) de la plateforme MyPaie. Il fusionne les anciens scripts de performance et de qualité en **un seul et unique chef d'orchestre**.

Son rôle est d'ingérer toutes les données de production (ventes, appels, évaluations, etc.) depuis Google Cloud Platform (GCP) vers les tables consolidées de MyPaie. L'architecture est totalement **pilotée par métadonnées** : le script lit la table de configuration `config_etl_sources` et s'adapte automatiquement à l'univers (Performance ou Qualité) et à la structure de la donnée (JSON ou TALL).

---

## 🧠 Architecture Medallion (Silver / Gold)

Ce script repose sur une architecture standardisée :

### 1. La Couche de Configuration (`config_etl_sources`)
Le point d'entrée. L'ETL liste toutes les sources avec `is_active = TRUE`. Selon la valeur de la colonne `univers`, il route la donnée vers le bon moteur de traitement.

### 2. La Couche Silver (`paie_performance` & `paie_qualite`)
Normalisation des données brutes en format long (Tall Data) : `[Matricule] | [Date] | [Projet] | [Code KPI] | [Valeur]`.
L'insertion se fait via un **MERGE** (Upsert) pour garantir qu'aucune donnée n'est dupliquée si l'ETL est lancé plusieurs fois le même jour.
- **Performance** : Les métriques de la même journée sont additionnées (`SUM`).
- **Qualité** : Les notes de la même journée sont moyennées (`AVG`). La Qualité bénéficie également d'un système de "fallback" (si le matricule est absent, le nom de l'agent est utilisé).

### 3. La Couche Gold (`paie_performance_mensuelle` & `paie_qualite_mensuelle`)
Une fois toutes les sources Silver mises à jour, la fonction `gold()` recalcule les tables mensuelles. Ce sont ces tables qui sont lues par l'application Mypaie (`get_unified_agent_data`) pour le calcul en temps réel des primes.
- **Performance Mensuelle** : Regroupe par mois avec `SUM(valeur)` et `AVG(valeur)`.
- **Qualité Mensuelle** : Regroupe par mois avec `AVG(valeur)` et compte le nombre d'audits.

---

## 🏗️ Structures de données supportées

L'ETL gère nativement deux types de structures de tables sources (`type_structure`) :
1. **`JSON`** : La table source contient une seule colonne (ex: `METRICS`) avec un objet JSON `{ "CA": 100, "Appels": 50 }`. L'ETL utilise une fonction BigQuery pour déplier ce JSON automatiquement.
2. **`TALL`** (ou Unpivot) : La table source possède explicitement une colonne pour le nom de l'indicateur et une colonne pour sa valeur. C'est le format le plus optimisé.

---

## 🛠️ Comment ajouter un nouveau projet ?

Aucune ligne de code Python n'est requise. Ajoutez simplement une ligne dans la table `config_etl_sources` de BigQuery.

### Exemple 1 : Ajout d'une source Performance (Format JSON)
```sql
INSERT INTO `gcp_my_paie.config_etl_sources` 
(id, univers, projet_nom, table_source, type_structure, colonne_cle_json, colonne_matricule, colonne_date)
VALUES 
(10, 'PERFORMANCE', 'NOUVEAU_CLIENT', 'dataset_x.perf_json', 'JSON', 'METRICS', 'MATRICULE', 'date_importation')
```

### Exemple 2 : Ajout d'une source Qualité (Format TALL)
```sql
INSERT INTO `gcp_my_paie.config_etl_sources` 
(id, univers, projet_nom, table_source, type_structure, colonne_kpi_code, colonne_kpi_value, colonne_agent_fallback, colonne_date)
VALUES 
(11, 'QUALITE', 'NOUVEL_AUDIT', 'dataset_x.qualite_tall', 'TALL', 'Critere', 'Note', 'Nom_Agent', 'Date_Eval')
```

---

## 🌌 Comment ajouter un NOUVEL UNIVERS (ex: Heures, Absences) ?

Si vous devez gérer un domaine de données complètement inédit (qui ne suit ni la logique de somme de la Performance, ni la logique de moyenne de la Qualité), voici les étapes pour étendre le script Python `universal_etl.py` :

1. **Déclarer les tables cibles** :
   Au début du fichier, ajoutez vos variables `TABLE_NOUVEAU_SILVER` et `TABLE_NOUVEAU_GOLD`. Modifiez la fonction `setup()` pour créer la table Silver au besoin.

2. **Créer la fonction de traitement (Silver)** :
   Créez une fonction `def _run_nouveau(src):` qui définit la logique métier (comment grouper les données ? Faut-il faire un `SUM`, un `MAX` ou un calcul complexe avant le `MERGE` ?).

3. **Brancher la fonction au Chef d'Orchestre** :
   Dans la fonction `run()`, ajoutez votre condition :
   ```python
   elif src.univers == 'NOUVEL_UNIVERS':
       _run_nouveau(src)
   ```

4. **Ajouter la consolidation (Gold)** :
   Dans la fonction `gold()`, ajoutez la requête qui écrase et recrée la table mensuelle pour ce nouvel univers en appliquant vos règles métier d'agrégation.

Une fois ces modifications faites dans le code, vous pourrez ajouter vos projets dans `config_etl_sources` avec ce nouvel univers de manière illimitée !

---

## 🚀 Comment exécuter l'ETL ?

Pour lancer l'extraction et la consolidation de **toutes les données** de MyPaie, exécutez une seule commande depuis la racine de votre projet :

```bash
docker exec mypaie_backend python3 /app/workers/universal_etl.py
```

> ⚠️ **Important** : L'ETL doit impérativement être lancé **à l'intérieur du conteneur Docker** `mypaie_backend` (grâce à `docker exec ...`), et non directement sur votre machine locale Windows via un `.venv`. Cela garantit que le script a bien accès :
> - À la base de données MySQL interne de Docker (pour la résolution des alias de KPIs).
> - Aux variables d'environnement (`GCP_PROJECT_ID`, `BQ_DATASET_PAIE`).
> - Aux identifiants Google Cloud sécurisés (`gcp-credentials.json`).
