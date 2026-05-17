# ⚙️ Documentation : Service MySQL Règles de Primes (`dw_api_regles_provider.py`)

## 📍 Rôle du fichier
Le fichier `dw_api_regles_provider.py` est le **Service métier (Provider)** responsable du **CRUD complet** des règles de primes et de la **gestion des versions (configurations)** des grilles d'objectifs dans la base de données MySQL.

*Note : Bien que son nom contienne `dw_api_` (qui sous-entend souvent Data Warehouse / BigQuery dans le reste de l'application), ce fichier ne communique **que** avec MySQL. Il gère le stockage applicatif.*

---

## 🧠 Principes & Logique de conception

### 1. Structure de données (Les 2 tables principales)
Ce Provider orchestre principalement deux tables MySQL :
- **`matrice_primes`** : Stocke l'en-tête de la règle (Nom, Description, Périodicité, Lien avec la structure organisationnelle). Elle contient aussi un champ historique `grille_objectifs` (JSON).
- **`matrice_primes_configs`** : Stocke les versions (snapshots) des grilles. Permet de garder un historique (ex: Grille Prime 2024, Grille Prime 2025) et de switcher d'une grille à l'autre via le booléen `est_active`.

### 2. Le mécanisme de Fusion (Merge) de la configuration active
C'est le point de conception le plus complexe et critique du fichier, visible dans `get_regle_by_id()` :
Quand on charge une règle, le système va :
1. Charger la règle de base (avec son champ `grille_objectifs` par défaut).
2. Chercher dans `matrice_primes_configs` s'il existe une configuration marquée `est_active = 1`.
3. Si oui, il **fusionne** le contenu de cette configuration par-dessus la grille par défaut. 
Cela permet au moteur de calcul de toujours utiliser la version la plus à jour sans écraser définitivement la grille d'origine.

### 3. Sécurité Transactionnelle
Comme pour les autres providers, chaque fonction s'occupe de sa propre connexion MySQL, utilise des requêtes paramétrées anti-injection (`%s`), commite (`conn.commit()`) et garantit la fermeture dans un bloc `finally`.

---

## 📂 Fonctions Exposées

Le fichier est découpé en deux grandes sections.

### Section 1 : Configurations de Grilles (Versions)
Gère la table `matrice_primes_configs`.
- **`get_regle_configs(regle_id)`** : Liste toutes les versions existantes pour une règle donnée.
- **`create_regle_config(...)`** : Sauvegarde une nouvelle version JSON de la grille.
- **`set_active_config(regle_id, config_id)`** : Logique de "Toggle". Passe toutes les configs à 0, puis passe la config ciblée à 1.
- **`update_grilles_order(...)`** : Permet de réorganiser l'ordre d'affichage s'il y a plusieurs grilles en cascade.
- **`delete_grille(regle_id, grille_uuid)`** : Supprime une version spécifique.

### Section 2 : CRUD des Règles de Primes
Gère la table `matrice_primes`.
- **`get_regle_by_id(regle_id)`** : Fonction complexe avec jointure sur la hiérarchie (`ref_projets`, etc.) et fusion de la config active.
- **`get_regles()`** : Liste toutes les règles pour le tableau de bord, avec plusieurs `LEFT JOIN` pour afficher les noms lisibles des projets et opérations rattachés (au lieu de simples IDs).
- **`create_regle(data)`** : Génère un identifiant unique (ex: `REGLE_8F2A9B...`) et insère la règle.
- **`update_regle(regle_id, data)`** : Met à jour les métadonnées (Nom, Description, etc.).
- **`update_regle_grille(regle_id, grille_objectifs)`** : Mise à jour rapide (Fast-Patch) du JSON racine.
- **`delete_regle(regle_id)`** : Supprime la règle.

---

## 🛠️ Comment ajouter un nouveau champ à la règle ?

Si les Ressources Humaines demandent d'ajouter un "Budget Maximum" à chaque règle de prime :

1. Modifiez la table MySQL `matrice_primes` pour ajouter la colonne `budget_max DECIMAL(10,2)`.
2. Mettez à jour la requête de création (`create_regle`) :
```python
            sql = """
                INSERT INTO matrice_primes
                (code, libelle, budget_max, ...) # <== Ajouter budget_max
                VALUES (%s, %s, %s, ...)
            """
            cursor.execute(sql, (code, nom, data.get("budget_max", 0), ...))
```
3. Mettez à jour la requête de modification (`update_regle`).
4. Mettez à jour la lecture globale (`get_regle_by_id` et `get_regles`) pour que le champ soit retourné au frontend :
```python
            return {
                "id": row["id"],
                "code": row["code"],
                "budget_max": float(row["budget_max"]) if row["budget_max"] else 0.0, # <== Ajouter ici
                # ...
            }
```
