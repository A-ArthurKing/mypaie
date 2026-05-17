# ⚙️ Documentation : Worker ETL Universel Qualité (`universal_quality_etl.py`)

## 📍 Rôle du fichier
Le fichier `universal_quality_etl.py` est le script (Worker) jumeau de celui de la performance, mais dédié à l'intégration des notes d'évaluation de la **Qualité** (ex: grilles Eval Plus, Audits).

Il partage la même architecture Méta-Data Driven : il se base sur la table `config_etl_sources` de BigQuery pour ingérer dynamiquement n'importe quel nouveau projet.

---

## 🧠 Principes & Différences avec la Performance

Ce script respecte l'architecture Silver/Gold (normalisation via MERGE puis agrégation mensuelle). Cependant, la donnée Qualité présente deux défis uniques que ce script gère intelligemment :

### 1. Structure TALL vs JSON
Si la Performance est toujours livrée sous format JSON (une seule colonne avec un objet), la qualité arrive sous des formats très divers selon les pays ou les clients.
Le script gère deux `type_structure` dans sa boucle `run()` :
- **`JSON`** (Ex: `PVCP_FR`, `PVCP_BE`) : Le script déploie l'objet JSON (via la fonction UDF Javascript `deplier_json`) exactement comme pour la performance.
- **`TALL`** (Ex: `VENUM`, `BATISANTE`) : Les données sources sont *déjà* sous forme de lignes empilées (une ligne par sous-item audité). Le script bascule donc sur une requête SQL standard sans `UNNEST`.

### 2. Le Fallback du Matricule
Dans les outils de notation qualité, les évaluateurs oublient souvent de renseigner le matricule officiel de l'agent.
La table `config_etl_sources` contient donc deux colonnes : `colonne_matricule` et `colonne_agent_fallback`.
La requête génère un `COALESCE` automatique :
```sql
COALESCE(CAST(MATRICULE AS STRING), Nom_de_l_agent) as matricule
```
Si le matricule n'existe pas, il insère le texte du nom dans la colonne matricule. C'est ensuite au backend (via le module `notes_qualite`) de résoudre l'équivalence entre un nom et un ID lors du calcul de la paie.

### 3. La Couche Gold (Calcul de la Note)
Dans la fonction `gold()`, l'agrégation mensuelle de la qualité ne fait pas de sommes (`SUM`). Une note qualité ne s'additionne pas. 
Le script utilise `AVG(kpi_value)` pour faire une moyenne de toutes les notes sur le mois donné, et compte le nombre d'audits (`COUNT(*) as nb_evals`).

---

## 🛠️ Comment ajouter un projet Qualité ?

Même principe que pour la performance : aucune ligne de code Python n'est requise. Ajoutez une configuration dans BigQuery :

**Exemple d'ajout d'une source "TALL" (Déjà plate) :**
```sql
INSERT INTO `gcp_my_paie.config_etl_sources` 
(id, univers, projet_nom, table_source, type_structure, colonne_kpi_code, colonne_kpi_value, colonne_agent_fallback, colonne_date)
VALUES 
(8, 'QUALITE', 'NOUVEAU_PROJET', 'dataset_x.qualite_tall', 'TALL', 'Nom_Rubrique', 'Note_Obtenue', 'NomAgent', 'DateAudit')
```
L'ETL l'ingèrera de manière totalement transparente lors de son exécution.
