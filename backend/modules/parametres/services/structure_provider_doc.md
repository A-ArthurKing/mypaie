# ⚙️ Documentation : Service Structure Organisationnelle (`structure_provider.py`)

## 📍 Rôle du fichier
Le fichier `structure_provider.py` est un **Service métier (Provider)** responsable du **CRUD (Create, Read, Update, Delete)** de la hiérarchie standard de l'application (l'arbre de structure).

C'est ce fichier qui exécute les requêtes SQL `INSERT`, `UPDATE` et `DELETE` sur les tables MySQL qui définissent la structure organisationnelle de l'entreprise :
- **Projets** (ex: `ref_projets`)
- **Opérations** (ex: `ref_operations`)
- **Sous-Projets / Files** (ex: `ref_sous_projet`)
- **Activités** (ex: `ref_activites`)
- **Liaisons (Structure Map)** (ex: `ref_structure_map`)

---

## 🧠 Principes & Logique de conception

La conception de ce fichier est volontairement extrêmement **simple, linéaire et répétitive**. Chaque fonction suit scrupuleusement la même architecture sécurisée :

1. **Ouverture de connexion :** Appel à `get_mysql_connection()`.
2. **Bloc Try/Finally :** Le `with conn.cursor() as cur:` gère le curseur, et le `finally: conn.close()` garantit à 100% que la base de données ne souffrira jamais de "connexions fantômes" non fermées, même si la requête SQL échoue.
3. **Requêtes paramétrées :** Les requêtes SQL utilisent toujours le format `%s` et passent un tuple `(valeur,)`. **Il n'y a aucune concaténation de chaînes (f-strings)** pour les valeurs, éliminant ainsi tout risque d'injection SQL.
4. **Commit manuel :** Les requêtes de modification (INSERT/UPDATE/DELETE) nécessitent explicitement un `conn.commit()` pour valider la transaction.
5. **Retour formaté :** 
   - Pour les `INSERT`, on utilise `cur.lastrowid` pour renvoyer au frontend l'ID de la ligne nouvellement créée en base.
   - Pour les `DELETE`, on retourne un simple `{ "status": "deleted" }`.

---

## 📂 Organisation du fichier

Le fichier est découpé en 5 blocs identiques, correspondant aux 5 entités du dictionnaire :

### 1. `--- PROJETS ---`
Gère la table `ref_projets`.
- `add_project(nom, code)`
- `update_project(id, nom, code)`
- `delete_project(id)`

### 2. `--- OPERATIONS ---`
Gère la table `ref_operations`.
- `add_operation(libelle)` *(Note: le paramètre id_projet est optionnel dans la signature mais pas inséré en base, à revoir selon l'évolution du modèle de données).*
- `update_operation(...)` / `delete_operation(...)`

### 3. `--- SOUS-PROJETS ---`
Gère la table `ref_sous_projet`. Souvent appelés "Files" dans le frontend.

### 4. `--- ACTIVITES ---`
Gère la table `ref_activites`.

### 5. `--- STRUCTURE MAP (Liaisons) ---`
Gère la table de jointure `ref_structure_map`. C'est l'arbre qui relie les éléments entre eux (Un Projet est lié à une Opération, etc.).
- `add_structure_mapping(...)`
- `delete_structure_mapping(...)`

*(Note : Il n'y a pas de fonction "Read/Get" dans ce fichier. La lecture globale de la structure est gérée par `reference_provider.py` de manière optimisée).*

---

## 🛠️ Comment ajouter/modifier une table de structure ?

Si demain l'organisation évolue et qu'on doit ajouter un niveau "Département" au-dessus des "Projets" :

### Étape 1 : Créer le bloc CRUD
Ajoutez un nouveau bloc à la fin du fichier :

```python
# --- DEPARTEMENTS ---
def add_departement(libelle: str):
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO ref_departements (libelle) VALUES (%s)", (libelle,))
            conn.commit()
            return {"id": cur.lastrowid, "libelle": libelle}
    finally: conn.close()

def update_departement(id: int, libelle: str):
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE ref_departements SET libelle = %s WHERE id = %s", (libelle, id))
            conn.commit()
            return {"id": id, "libelle": libelle}
    finally: conn.close()

def delete_departement(id: int):
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ref_departements WHERE id = %s", (id,))
            conn.commit()
            return {"status": "deleted"}
    finally: conn.close()
```

### Étape 2 : L'exposer dans les routes
Ensuite, allez dans `modules/parametres/routes.py`, importez ces fonctions et créez les endpoints `@parametres_bp.route(...)` correspondants. N'oubliez pas d'utiliser `_emit_structure_update()` dans la route pour que l'interface de tous les utilisateurs se rafraîchisse instantanément.
