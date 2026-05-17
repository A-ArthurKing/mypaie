# ⚙️ Documentation : Service des Mappings et KPIs (`mapping_provider.py`)

## 📍 Rôle du fichier
Le fichier `mapping_provider.py` est le **Service métier central** pour la gestion des correspondances (mappings) entre les données brutes (Data Warehouse / ETL) et les référentiels propres de l'application (MySQL).

Il gère également le **Registre des KPIs**, c'est-à-dire le dictionnaire applicatif qui définit les indicateurs (leurs libellés, s'ils sont actifs, et s'ils sont virtuels/calculés).
Toutes les interactions avec la base de données MySQL pour ces aspects se font ici.

---

## 🧠 Principes & Logique de conception

1. **Connexions MySQL transactionnelles :** Chaque fonction récupère une connexion via `get_mysql_connection()`, utilise un `cursor()` (souvent `DictCursor` pour récupérer des objets JSON directement), exécute sa requête, et n'oublie pas le `conn.commit()` pour les modifications (INSERT/UPDATE/DELETE).
2. **Fermeture garantie (`finally`) :** La connexion à la base de données est toujours fermée (`conn.close()`) dans un bloc `finally` pour éviter les fuites de mémoire (memory leaks) ou la saturation du pool de connexions, même en cas de crash.
3. **Logique "Upsert" :** Beaucoup de fonctions d'ajout (ex: `add_mysql_project_mapping`) sont conçues pour faire de la mise à jour si l'élément existe déjà (logique d'`INSERT ... ON DUPLICATE KEY UPDATE`), garantissant ainsi l'idempotence.

---

## 📂 Les 3 Grands Blocs de Fonctions

### 1. Mapping de Projets (`ref_projets_mapping`)
*Permet de relier un nom de projet brut issu de l'ETL (ex: `PVCP-APEN`) à la hiérarchie standard (Projet > Sous-projet > Activité).*
- **`get_mysql_project_mappings()`** : Liste tous les mappings existants, en effectuant les jointures SQL pour récupérer les noms lisibles des projets associés.
- **`add_mysql_project_mapping()`** : Crée ou met à jour l'association.
- **`delete_mysql_project_mapping()`** : Supprime une règle de mapping.

### 2. Le Registre des KPIs (`config_kpis`)
*Le dictionnaire applicatif des KPIs. Un KPI peut être "Natif" (issu de la Data) ou "Virtuel" (formule mathématique).*
- **`get_all_kpis_with_status()`** : Renvoie le catalogue complet.
- **`toggle_kpi_actif()`** : Active ou désactive un KPI (bascule de `is_active` de 1 à 0 ou inversement).
- **`add_kpi_registry_item() / update... / delete...`** : Gère le CRUD (Création/Mise à jour/Suppression) des KPIs, notamment les KPIs virtuels créés depuis l'UI avec des formules.

### 3. Mapping des KPIs ETL (`ref_etl_kpi_mapping` & `ref_etl_config`)
*Définit comment une colonne d'une table source spécifique doit se déverser dans un KPI standard.*
- **`get_etl_sources()`** : Liste les sources de données configurées pour l'ETL.
- **`get_kpi_mappings_by_source()`** : Pour une source donnée, liste quelles colonnes alimentent quels KPIs.
- **`add_mysql_kpi_mapping() / delete...`** : Gestion de ces règles.

*(Note : Le fichier contient aussi quelques anciennes fonctions comme `ensure_mapping_table_exists` ou `get_mappings` qui semblent être du code Legacy lié à BigQuery, potentiellement à nettoyer plus tard).*

---

## 🛠️ Comment ajouter une nouvelle fonction de Mapping ?

Si vous avez besoin d'ajouter une fonction, par exemple pour **récupérer un KPI spécifique par son code** :

### Structure standard d'une fonction Provider MySQL

```python
from config.db_mysql_connector import get_mysql_connection
import pymysql

def get_kpi_by_code(code: str) -> dict | None:
    """Récupère les détails d'un KPI spécifique par son code."""
    
    # 1. Obtenir la connexion MySQL
    conn = get_mysql_connection()
    try:
        # 2. Utiliser un DictCursor pour avoir un dictionnaire { 'colonne': 'valeur' }
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            sql = "SELECT * FROM config_kpis WHERE code_kpi = %s"
            
            # 3. Toujours passer les paramètres dans un tuple (anti-injection SQL)
            cur.execute(sql, (code,))
            
            # 4. Récupérer le résultat
            result = cur.fetchone()
            return result
            
    except Exception as e:
        # 5. Logger proprement l'erreur
        logger.error(f"Erreur get_kpi_by_code pour {code}: {e}")
        raise e  # Remonter l'erreur pour que routes.py puisse la catcher et renvoyer 500
        
    finally:
        # 6. TOUJOURS fermer la connexion !
        conn.close()
```

### Règles d'or :
- **Anti-Injection :** Ne faites jamais de `f"SELECT * FROM table WHERE id = {mon_id}"`. Utilisez toujours `%s` et passez `(mon_id,)` à `execute()`.
- **Fermeture (`finally`) :** Une connexion ouverte qui n'est pas fermée fera tomber le serveur après quelques requêtes.
