# ⚙️ Documentation : Requêtes BigQuery Mutualisées (`bigquery_queries.py`)

## 📍 Rôle du fichier
Le fichier `bigquery_queries.py` (situé dans le dossier `tools/`) agit comme une **Bibliothèque centrale** pour toutes les requêtes d'extraction de données complexes destinées à l'entrepôt Google Cloud BigQuery.

Il isole la complexité du langage SQL BigQuery (qui peut parfois nécessiter des syntaxes analytiques très denses) de la logique Python (les Providers).

---

## 🧠 Principes & Logique de conception

### 1. Paramétrage Flex (Construction dynamique)
Contrairement aux requêtes MySQL qui utilisent un simple `%s`, les requêtes BigQuery sont souvent construites de manière dynamique car le nom de la table peut changer (ex: table mensuelle ou hebdomadaire), ainsi que les filtres (les clauses `WHERE`).

C'est pourquoi les fonctions de ce fichier prennent souvent en paramètres :
- `table_ref` : Le nom de la table cible (injecté via f-string Python, car le nom d'une table ne peut pas être passé en paramètre sécurisé dans SQL).
- `where_str` : Les conditions de filtrage préalablement construites par le Provider.

**⚠️ Règle de Sécurité Absolue :** Ne jamais construire de `where_str` en concaténant des variables utilisateurs ! Utilisez toujours les `QueryParameter` (ex: `@agent`, `@date_debut`) de la librairie Google Cloud, que BigQuery se chargera d'évaluer de manière 100% sécurisée contre les injections.

### 2. Isolation Data vs Web
L'un des avantages de ce fichier est que si un Data Engineer modifie le schéma de la base BigQuery (ex: renommer la colonne `nb_ventes` en `bookings_val`), il n'a pas besoin de fouiller dans les méandres de l'application Flask/Python. Il lui suffit d'ouvrir ce fichier SQL central et de mettre à jour le `SELECT`.

---

## 📂 Organisation du fichier

Les requêtes sont regroupées par univers métier :

1. **HEURES AGENTS**
   - `query_heures_detail` : L'extraction complète pour la pagination.
   - `query_equipes_distinctes` / `query_projets_heures_distincts` : Les requêtes d'alimentation des filtres dropdown (menus déroulants) de l'interface.

2. **QUALITÉ**
   - `query_qualite_detail` : Liste individuelle des évaluations.
   - `query_qualite_stats_projets` : Agrégation macro pour le reporting projet.
   - `query_qualite_stats_global` : Usage de l'instruction analytique BigQuery `ROLLUP` pour grouper intelligemment par Item et Sous-Item en une seule requête.

3. **PERFORMANCE**
   - `query_performance_detail` : Calcule les KPIs (Somme de ventes, temps travaillé, taux de conversion, moyenne de qualité croisée) pour générer le tableau de bord des agents.

---

## 🛠️ Comment utiliser cet outil ?

### Étape 1 : Créer la requête dans `bigquery_queries.py`
Créez la requête avec ses "trous" pour la table et les conditions :

```python
def query_top_vendeurs(table_ref, where_str):
    """Calcule le classement des vendeurs sur la période."""
    return f"""
        SELECT 
            matricule, agent_nom, SUM(nb_ventes) as total_ventes
        FROM {table_ref}
        {where_str}
        GROUP BY matricule, agent_nom
        ORDER BY total_ventes DESC
        LIMIT @limit
    """
```

### Étape 2 : L'appeler depuis un Provider BigQuery

Dans `modules/performance/services/dw_api_performance_provider.py` :

```python
from tools.bigquery_queries import query_top_vendeurs
from google.cloud import bigquery

def get_top_agents(date_cible: str):
    client = get_bigquery_client()
    table_ref = f"`gcp-project.dataset.paie_perf`"
    
    # Construction sécurisée du filtre BigQuery (avec paramètre @date)
    where_str = "WHERE mois = @date_cible"
    params = [bigquery.ScalarQueryParameter("date_cible", "STRING", date_cible)]
    
    # Récupération de la requête depuis l'outil
    sql = query_top_vendeurs(table_ref, where_str)
    
    # Exécution
    job_config = bigquery.QueryJobConfig(query_parameters=params)
    rows = client.query(sql, job_config=job_config).result()
    return [dict(r) for r in rows]
```
