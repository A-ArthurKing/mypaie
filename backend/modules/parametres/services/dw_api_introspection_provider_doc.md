# ⚙️ Documentation : Service Introspection BigQuery (`dw_api_introspection_provider.py`)

## 📍 Rôle du fichier
Le fichier `dw_api_introspection_provider.py` est un **Service métier (Provider)** spécialisé dans l'interrogation du schéma et du contenu de Google BigQuery (Data Warehouse).

Il agit comme un "explorateur" : il ne modifie jamais les données, mais permet à l'application web de **découvrir dynamiquement** ce qui existe dans la base de données Data (tables, colonnes, valeurs uniques). 
C'est notamment utilisé dans l'interface de paramétrage (Mapping des Projets et Découverte des KPIs) pour que le frontend puisse générer des menus déroulants automatiquement basés sur le contenu réel de BigQuery.

---

## 🧠 Principes & Logique de conception

1. **Client BigQuery centralisé :** Toutes les fonctions appellent `get_bigquery_client()` depuis le fichier de configuration `config.dw_api_bigquery_connector.py`.
2. **Backticks pour la sécurité :** Lors de l'écriture de requêtes SQL pour BigQuery, les noms de table complexes au format `Projet.Dataset.Table` sont toujours entourés de backticks (\`) pour éviter les erreurs de parsing côté Google Cloud.
3. **Architecture "Fail-Safe" :** Si BigQuery n'est pas accessible ou que la table demandée n'existe pas, la fonction intercepte l'erreur, la trace dans les logs (`logger.error`), et renvoie **une liste vide `[]`** plutôt que de faire crasher toute l'application.

---

## 📂 Fonctions Exposées

1. **`list_bigquery_tables(dataset_id) -> List[Dict]`**
   - *Rôle :* Liste toutes les tables et vues disponibles dans le dataset de paie.
   - *Sortie :* `[{"id": "paie_performance_mensuelle", "type": "TABLE"}, ...]`

2. **`list_table_columns(table_id, dataset_id) -> List[Dict]`**
   - *Rôle :* Extrait le schéma (les colonnes) d'une table spécifique.
   - *Sortie :* `[{"name": "agent", "type": "STRING", "description": ""}, ...]`

3. **`get_unique_column_values(table_id, column_name, dataset_id) -> List[str]`**
   - *Rôle :* Fait un `SELECT DISTINCT` sur une colonne pour récupérer toutes ses valeurs possibles, sans les "NULL". 
   - *Exemple d'usage :* Récupérer tous les noms bruts de projets (PVCP, TOTAL, etc.) pour alimenter le sélecteur "Valeur brute" du Mapping Projets.

4. **`discover_gold_kpis(projet) -> List[Dict]`**
   - *Rôle :* Fait un pont entre l'application et la donnée pure. Interroge les tables Gold (Performance et Qualité) pour extraire la liste exhaustive des "kpi_code" existants (les KPIs techniques calculés par l'ETL).

---

## 🛠️ Comment ajouter une nouvelle fonction d'introspection ?

Si vous avez besoin d'une nouvelle information dynamique en provenance de BigQuery (par exemple, récupérer la liste des années/mois disponibles dans les données pour faire un filtre temporel sur le frontend) :

### Étape 1 : Créer la fonction dans le Provider
Ouvrez `dw_api_introspection_provider.py` et ajoutez votre fonction en utilisant le pattern "try/except" avec retour sécurisé :

```python
def get_available_months() -> List[str]:
    """Récupère tous les mois uniques disponibles dans la table de performance."""
    client = get_bigquery_client()
    try:
        # 1. Toujours utiliser les backticks pour BigQuery
        table_ref = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.paie_performance_mensuelle`"
        
        # 2. Rédiger la requête
        query = f"SELECT DISTINCT mois_str FROM {table_ref} ORDER BY mois_str DESC"
        
        # 3. Exécuter
        rows = client.query(query).result()
        
        # 4. Formater le retour
        return [row[0] for row in rows]
        
    except Exception as e:
        logger.error(f"Erreur get_available_months : {e}")
        return [] # <== Ne jamais crasher
```

### Étape 2 : L'exposer dans les routes
Ensuite, allez dans `modules/parametres/routes.py` pour l'importer et l'exposer via un endpoint HTTP classique, comme expliqué dans `routes_doc.md`.
