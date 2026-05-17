# ⚙️ Documentation : Service des Référentiels & Cache (`reference_provider.py`)

## 📍 Rôle du fichier
Le fichier `reference_provider.py` est un **Service métier (Provider)** spécialisé dans la **lecture optimisée** de toutes les données de référence de l'application MyPaie.

Son but est de charger, d'un seul coup, tout l'arbre organisationnel (Projets, Opérations, Sous-projets, Activités), les statuts, et le catalogue des KPIs. Il retourne un "Méga-Dictionnaire" qui est consommé par le frontend pour afficher tous les menus déroulants et toutes les interfaces de paramétrage.

**Point clé :** Comme ces données sont lues en permanence mais modifiées très rarement, ce fichier utilise un mécanisme de **Mise en cache (Caching)** pour soulager la base de données MySQL.

---

## 🧠 Principes & Logique de conception

### 1. Le Caching Actif
- Le fichier utilise un module interne `tools.cache` (probablement basé sur Redis ou en mémoire RAM).
- La clé de cache utilisée est `parametres:references` avec un **TTL (Time To Live)** de 5 minutes (`300` secondes).
- Quand le frontend demande les référentiels :
  - **Cache HIT :** Si la donnée est en cache, on la retourne instantanément. Zéro requête SQL.
  - **Cache MISS :** Si le cache est expiré ou vide, on fait toutes les requêtes SQL, on stocke le résultat dans le cache, puis on le retourne.

### 2. Invalidation Forcée
La fonction `invalidate_references_cache()` est vitale. Elle est appelée massivement dans `routes.py` à chaque fois qu'un utilisateur fait un `POST`, `PUT`, `PATCH`, ou `DELETE` (par exemple : changer le libellé d'un projet, activer/désactiver un KPI). 
Cela détruit la clé `parametres:references` en cache. Ainsi, le prochain rechargement (`GET`) ira obligatoirement chercher les données fraîches en base.

### 3. Regroupement (Batching)
Plutôt que d'avoir 7 routes API différentes (une pour les projets, une pour les opérations, etc.), la fonction `get_all_references()` fait toutes les requêtes d'un coup et renvoie un grand objet consolidé. C'est beaucoup plus performant pour le réseau.

### 4. Formatage Métier (DictCursor)
Il utilise `pymysql.cursors.DictCursor` pour que les requêtes renvoient directement des listes de dictionnaires JSON (ex: `[{"id": 1, "libelle": "RH"}]`) au lieu de tuples bruts `[(1, "RH")]`.
Il applique aussi une logique métier : les KPIs sont automatiquement groupés par "Univers" (PERF, QUALITE, etc.) pour simplifier l'affichage côté frontend.

---

## 📂 Fonctions Exposées

1. **`get_all_references()`**
   - *Rôle :* Extrait toutes les tables de référence (`ref_projets`, `ref_operations`, `ref_sous_projet`, `ref_activites`, `matrice_statuts`, `ref_structure_map`, `config_kpis`).
   - *Sortie :* Dictionnaire global mis en cache.

2. **`invalidate_references_cache() -> None`**
   - *Rôle :* Détruit le cache pour forcer un rechargement. Appelée après toute mutation.

---

## 🛠️ Comment ajouter un nouveau référentiel ?

Si demain vous créez une table `ref_departements` et que vous voulez que le frontend y ait accès pour les menus déroulants :

### Étape 1 : Ajouter la requête dans `get_all_references`
Ajoutez le `cur.execute` et la récupération des données :

```python
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            # [...] Requêtes existantes
            
            # 1. Votre nouvelle requête
            cur.execute("SELECT id, libelle FROM ref_departements ORDER BY libelle")
            departements = cur.fetchall()

            # 2. Ajout dans le dictionnaire de retour (result)
            result = {
                "projets": projets,
                "operations": ops,
                "sous_projets": sous_projets,
                "activites": acts,
                "statuts": statuts,
                "structure": structure,
                "kpis": kpis_grouped,
                "departements": departements  # <== Ajouté ici
            }
```

Dès le prochain rechargement, le frontend recevra le nouveau bloc `departements` et pourra l'utiliser dans toute l'application. N'oubliez pas que toute modification de cette nouvelle table (ajout/édition d'un département) devra appeler `invalidate_references_cache()` dans `routes.py` !
