# ⚙️ Documentation : Service Performance BigQuery (`dw_api_performance_provider.py`)

## 📍 Rôle du fichier
Le fichier `dw_api_performance_provider.py` est le **coeur métier** de la lecture des données de Performance.

Il interroge les tables de la couche **Gold** de BigQuery (`paie_performance_mensuelle`, `paie_performance_hebdomadaire`) pour ramener les indicateurs métiers des agents.
Il inclut également une logique de **résolution des noms de projets** et un **moteur de calcul de formules** pour évaluer les KPIs virtuels à la volée.

---

## 🧠 Principes & Logique de conception

### 1. Le Découplage (Anti-Join BigQuery)
Dans une architecture Data standard, on ferait un `JOIN` dans BigQuery entre la table de performance et la table des projets.
Ici, l'architecture est **découplée** : 
- BigQuery ne stocke que la valeur brute venue de la téléphonie (ex: `PVCP-APEN`).
- Le mapping (PVCP-APEN = "Ventes Inbound") est stocké dans **MySQL**.
- La fonction `_load_projet_mapping()` charge le mapping depuis MySQL, puis le script Python remplace les noms à la volée (`_resolve_projet`). Cela permet de modifier un nom de projet dans le frontend sans jamais relancer de pipelines de données lourds sur Google Cloud.

### 2. Adaptation à la Granularité
Les données sont requêtées différemment selon le besoin du frontend (`granularity`):
- `month` ou `total` : lit la table mensuelle, rapide et agrégée.
- `week` : lit la table hebdomadaire (dates spécifiques).
Le typage des paramètres de la requête BigQuery s'adapte automatiquement (les mois sont des `STRING` "2023-01", les semaines sont des `DATE` "2023-01-15").

### 3. Le Moteur de Formules Dynamiques (KPI Virtuels)
Dans `get_perf_totaux_par_matricule`, en plus des KPIs hardcodés historiques (DMT, CVR), la fonction récupère le dictionnaire de KPIs applicatif (`get_kpi_registry`).
Elle injecte les agrégats bruts de BigQuery (ex: la somme totale des ventes) dans un `formula_ctx`.
Puis elle boucle sur tous les KPIs "VIRTUAL" de la base de données MySQL et utilise la fonction `evaluate_formula` pour calculer le résultat mathématique final avant de le renvoyer.

---

## 📂 Fonctions Exposées

### Helpers Locaux (Privés)
1. **`_load_projet_mapping()`** : Se connecte à MySQL, ramène les associations Nom brut -> Nom standard. Gère silencieusement l'échec si MySQL est injoignable.
2. **`_resolve_projet(raw_name, mapping)`** : Fonction pure qui fait le remplacement.

### Lecture de données
3. **`get_performance_pvcp(date_debut, date_fin, agent, granularity, limit, offset) -> dict`**
   - *Rôle :* Récupère la grille détaillée des performances. Renvoie les données et le compte total (pour la pagination `limit`/`offset`). Structure un dictionnaire "metrics_full" pour le frontend.

4. **`get_perf_totaux_par_matricule(date_debut, date_fin, matricules) -> dict`**
   - *Rôle :* Agrége massivement les données pour une liste d'agents donnés.
   - *Exemple de sortie :* `{ "12345": { "dmt": 300, "cvr": 25, "MON_NOUVEAU_KPI": 42 } }`

---

## 🛠️ Comment modifier ou ajouter un calcul de performance ?

### Ajouter un KPI simple depuis BigQuery
Si une nouvelle colonne (ex: `taux_absenteisme`) a été ajoutée à la table BigQuery `paie_performance_mensuelle` :

1. Modifiez `get_perf_totaux_par_matricule` et ajoutez le calcul SQL :
```sql
SELECT
    -- [...]
    AVG(taux_absenteisme) AS avg_abs, # <== Ajouté ici
```
2. Ajoutez-le dans l'objet de retour :
```python
            entry = {
                "dmt":       round(r["dmt_sec"], 1)       if r["dmt_sec"]    is not None else None,
                "tx_abs":    round(r["avg_abs"], 2)       if r["avg_abs"]    is not None else None, # <== Ajouté ici
```

### Rendre cette donnée disponible pour les KPIs Virtuels (Formules)
Si vous voulez que les utilisateurs puissent créer des formules (ex: `(CHIFFRE_AFFAIRE / 100) * TAUX_ABSENTEISME`) depuis l'interface :
1. Ajoutez la variable au `formula_ctx` :
```python
            formula_ctx = {
                "CHIFFRE_AFFAIRE":  r["sum_chiffre_affaire"],
                "TAUX_ABSENTEISME": r["avg_abs"], # <== Ajouté ici
            }
```
Ainsi, la variable `TAUX_ABSENTEISME` devient un "mot clé" utilisable dans l'éditeur de formules mathématiques du frontend.
