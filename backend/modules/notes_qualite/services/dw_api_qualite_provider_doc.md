# ⚙️ Documentation : Service Qualité BigQuery (`dw_api_qualite_provider.py`)

## 📍 Rôle du fichier
Le fichier `dw_api_qualite_provider.py` est le cœur de la communication entre l'application et les bases de données Qualité hébergées sur Google Cloud BigQuery.

Il a pour but de lire la table `paie_qualite` (alimentée par un logiciel tiers type Eval Plus) pour extraire les notes individuelles des agents ou les moyennes globales, appliquer des filtres temporels, et retourner le résultat au frontend ou au moteur de calcul de paie.

---

## 🧠 Principes & Logique de conception

### 1. Gestion des dates (Casting Automatique)
Contrairement à la Performance qui oscille entre "Mois" et "Semaine", la base Qualité descend au grain de la journée. Le paramétrage BQ force donc un `{"type": "DATE"}` et applique un `.split()[0]` (`"2023-10-25 15:00:00" -> "2023-10-25"`) pour assurer que BigQuery digère bien la requête.

### 2. Le Filtre Projets "Hardcodé"
Afin de ne pas remonter l'intégralité du Data Warehouse, toutes les requêtes intègrent par défaut un `where_clause` spécifique :
`"(LOWER(projet) LIKE '%pvcp%' OR LOWER(projet) LIKE '%batisante%' ...)"`.
Cela filtre la donnée BigQuery au moment de la lecture pour limiter les coûts et optimiser la bande passante.

### 3. Le Fallback par "Nom d'Agent" (Double Prédicat)
C'est la fonctionnalité clé de `get_qualite_totaux_par_matricule` :
Dans l'outil tiers (Eval Plus), l'Evaluateur remplit parfois mal le dossier et omet d'indiquer le Matricule (qui se retrouve NULL dans BQ).
La requête génère un **Prédicat d'identité combiné** : 
`(matricule IS NOT NULL AND matricule IN (...)) OR (matricule IS NULL AND LOWER(TRIM(agent)) IN (...))`
Cela permet de "sauver" les notes manquantes via le nom de l'agent fourni par le frontend.

### 4. Le Cache (TTL)
Pour les statistiques globales (`get_qualite_stats_projets` et `get_qualite_stats_global`), les requêtes peuvent être lourdes. Le fichier s'appuie donc sur `tools.cache` pour garder le JSON en mémoire pendant 5 minutes (`_CACHE_TTL_STATS = 300`).

---

## 📂 Fonctions Exposées

1. **`get_qualite_agents(date_debut, date_fin, agent, projet, limit, offset)`**
   - *Rôle :* Récupère la donnée détaillée pour alimenter un tableau UI. Gère la pagination (`LIMIT / OFFSET`).

2. **`get_qualite_totaux_par_matricule(date_debut, date_fin, matricules, nom_matricule_map)`**
   - *Rôle :* Agrége (Moyenne/`AVG`) les scores globaux d'une liste d'agents pour la paie, incluant le fallback intelligent si le matricule est NULL.
   - *Sortie :* `{ "10756": 85.4, "9923": 91.2 }`

3. **`get_qualite_stats_projets(...)`**
   - *Rôle :* Retourne la moyenne qualité par projet. (Mise en cache 5min).

4. **`get_qualite_stats_global(...)`**
   - *Rôle :* Retourne la moyenne mondiale de tout le plateau. (Mise en cache 5min).

---

## 🛠️ Helpers Internes

Ce fichier contient des fonctions privées de formatage très pratiques :

- **`_build_job_config(params)`** : Transforme un dictionnaire python classique de paramètres en objet `bigquery.QueryJobConfig()` exigé par le client GCP.
- **`_serialize_rows(rows)`** : Les objets Date/DateTime renvoyés par BQ font crasher la fonction `jsonify` de Flask. Ce helper les convertit en strings ISO.
- **`_repair_encoding(val)`** : Tente de réparer les problèmes de double-encodage (`latin-1` -> `utf-8`) qui arrivent fréquemment avec les logiciels tiers francophones (accents mal encodés type "QualitÃ©").
