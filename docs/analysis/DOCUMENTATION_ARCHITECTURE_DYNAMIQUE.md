# Documentation Architecture Data : Vers un Modèle Dynamique et Élastique

## 1. Schéma Global de l'Architecture

```text
+------------------------+      +-------------------------+      +------------------------+
|   Tables Sources BQ    | ---> |     ETL Générique       | ---> | Table Cible Unique BQ  |
| (JSON/Vues standards)  |      |  (Aucun code en dur)    |      | (Format Clé-Valeur/JSON|
+------------------------+      +-------------------------+      +------------------------+
            |                               ^                            |
            v                               |                            v
+------------------------+      +-------------------------+      +------------------------+
| Interface Managers UI  | <--- |   Application Backend   | <--- |   Lecture Dynamique    |
| (Grilles de Primes)    |      | (Calcul des Ratios/Form)|      |  (Zéro modif de schéma)|
+------------------------+      +-------------------------+      +------------------------+
```

### Le concept Clé-Valeur appliqué aux KPIs
Au lieu de démultiplier les colonnes, les indicateurs sont mémorisés sous la forme d'un dictionnaire dynamique (JSON ou structures imbriquées). Les informations spécifiques à un agent pour une période donnée sont stockées de manière verticale ou encapsulées dans un objet sérialisé. Un nouvel indicateur n'est plus une nouvelle colonne, mais une nouvelle ligne ou une nouvelle entrée dans l'objet JSON.

---

## 2. Plan d'Implémentation Étape par Étape

### Étape 1 : Standardisation des Sources (Couche d'Abstraction)
Afin d'éviter que le moteur ETL ne doive s'adapter à des formats hétérogènes à chaque projet, il convient de mettre en place une couche de vues intermédiaires standards (*Views*) directement dans BigQuery au-dessus des tables brutes.

Chaque projet doit exposer ses données de performance à travers une structure unifiée, en utilisant des préfixes sémantiques clairs (ex: `val_ca`, `val_appels`, `val_ventes`).

Pour les données de type d'évaluation qualité où les données arrivent déjà sous forme d'un objet de métriques semi-structuré (colonne `METRICS` au format JSON STRING), la vue intermédiaire doit simplement isoler et nettoyer ce champ ainsi que les dimensions associées (`MATRICULE`, `PROJET`, `Date_Evaluation`).

### Étape 2 : Automatisation du Processus ETL (Moteur d'Ingestion Aveugle)
Le pipeline ETL ne doit plus contenir de règles de transformation écrites en dur colonne par colonne. Son rôle est d'analyser dynamiquement la structure source et de la transposer.

Dans le cas des structures contenant des chaînes JSON (comme la table `PVCP_QUALITY_FR`), l'ETL s'appuie sur des fonctions JavaScript temporaires (*UDF - User Defined Functions*) et sur l'opérateur `UNNEST` de BigQuery pour éclater dynamiquement le JSON en lignes SQL.

#### Requête ETL Dynamique Type (Modèle d'Ingestion) :
```sql
-- 1. Déclaration de la fonction JS permettant de parser et déplier le JSON de manière dynamique
CREATE TEMP FUNCTION deplier_json(json_str STRING)
RETURNS ARRAY<STRUCT<kpi_nom STRING, kpi_valeur FLOAT64>>
LANGUAGE js AS """
  try {
    const obj = JSON.parse(json_str);
    return Object.keys(obj).map(key => ({
      kpi_nom: key,
      kpi_valeur: parseFloat(obj[key])
    }));
  } catch (e) {
    return [];
  }
""";

-- 2. Insertion et normalisation au format Clé-Valeur
SELECT 
  unique_key,
  MATRICULE,
  NOMSIRH,
  PROJET,
  Date_Evaluation,
  unfolded_kpi.kpi_nom AS kpi_code,
  unfolded_kpi.kpi_valeur AS kpi_value
FROM 
  `projet_data.dataset_pvcp.PVCP_QUALITY_FR`,
  UNNEST(deplier_json(METRICS)) AS unfolded_kpi;
```

### Étape 3 : Structure de Stockage Cible (BigQuery)
La table consolidée finale (ex: `paie_performance_tv`) adopte l'un des deux formats cibles selon les préférences de requêtage de la plateforme applicative :

#### Option A : Format Table Longue (Clé-Valeur Vertical)
| MATRICULE | Date_Evaluation | kpi_code       | kpi_value |
|-----------|-----------------|----------------|-----------|
| 11904     | 2026-04-13      | PHASE_DACCUEIL | 100.0     |
| 11904     | 2026-04-13      | FORCE_DCOUTE   | 0.0       |
| 12640     | 2026-04-05      | SAVOIR_DIRE    | 100.0     |

#### Option B : Format Semi-Structuré (JSON Natif BQ)
| MATRICULE | Date_Evaluation | kpis_json (Type: JSON)                         |
|-----------|-----------------|------------------------------------------------|
| 11904     | 2026-04-13      | {"PHASE_DACCUEIL": 100.0, "FORCE_DCOUTE": 0.0} |
| 12640     | 2026-04-05      | {"PHASE_DACCUEIL": 100.0, "SAVOIR_DIRE": 100.0}|

### Étape 4 : Couche Applicative et Calcul Dynamique
L'application prend désormais en charge la logique métier et s'affranchit des contraintes de schémas de base de données.

*   **Extraction de la donnée** : Lors de l'appel d'un manager, le backend interroge BigQuery et récupère l'ensemble des KPIs sous forme de dictionnaire ou de liste Clé-Valeur pour la période demandée.
*   **Calcul des formules à la volée** : Les ratios et indicateurs complexes (comme le taux de conversion ou le score CSAT pondéré) ne sont plus stockés sous forme de requêtes textuelles complexes en base de données. Ils sont calculés directement par le code de l'application (NodeJS, Python, etc.) lors de l'exécution :
    $$\text{Taux de Conversion} = \frac{\sum \text{KPI\_VENTES}}{\sum \text{KPI\_APPELS}}$$
*   **Configuration UI** : L'interface utilisateur permet aux managers de définir les formules via un constructeur visuel d'indicateurs (ex: sélectionner "Ventes" puis l'opérateur "/" puis "Appels").

---

## 3. Gestion du Cycle de Vie des Indicateurs (KPIs)

La suppression de la table de mapping technique MySQL complexe simplifie radicalement les opérations de maintenance de l'administration système.

### Scénario A : Ajout d'un nouvel indicateur
1. L'indicateur apparaît à la source dans le JSON ou la table brute du projet.
2. L'ETL générique détecte automatiquement cette nouvelle clé lors de son exécution et l'intègre dans BigQuery.
3. Le backend de l'application détecte la nouvelle clé et la rend immédiatement disponible pour les managers dans l'interface de configuration des primes.
*Impact technique ou intervention BDD : Zéro.*

### Scénario B : Retrait ou désactivation d'un indicateur
Si un KPI devient obsolète ou non pertinent, il n'est pas nécessaire de purger l'historique ou de modifier la structure de la base de données. La gestion s'effectue exclusivement dans la table de configuration légère de l'application MySQL :

```sql
CREATE TABLE `config_kpis` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code_kpi` VARCHAR(50) UNIQUE NOT NULL,
  `libelle` VARCHAR(100) NOT NULL,
  `univers` ENUM('PERF', 'QUALITE', 'HEURES') NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1
);
```
Pour désactiver un indicateur, il suffit de passer son état `is_active` à 0. L'interface de l'application ignorera ce KPI pour les futures grilles de primes, tout en préservant l'intégrité des calculs et des données historiques.

---

## 4. Avantages et Robustesse de la Nouvelle Architecture

*   **Scalabilité infinie** : Le système peut supporter l'intégration immédiate de nouveaux projets, de nouvelles équipes ou de nouvelles typologies de campagnes de télévente sans modification structurelle.
*   **Résilience du code** : L'ETL n'est plus sujet aux pannes consécutives à des modifications légères des outils clients (changement de grilles d'évaluation qualité, introduction d'une nouvelle question).
*   **Autonomie des équipes métiers** : Les managers peuvent modifier, ajouter ou désactiver des règles d'indicateurs et des critères de rémunération variable directement depuis leur interface, sans solliciter l'intervention d'un ingénieur de données.
