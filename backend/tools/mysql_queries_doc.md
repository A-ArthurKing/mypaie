# ⚙️ Documentation : Requêtes MySQL Mutualisées (`mysql_queries.py`)

## 📍 Rôle du fichier
Le fichier `mysql_queries.py` (situé dans le dossier `tools/`) agit comme une **Bibliothèque centrale** pour toutes les requêtes SQL complexes destinées à la base de données MySQL applicative (ex: `gestionpaie`, `ref_employes`, `matrice_primes`).

Son rôle est d'extraire les requêtes SQL (qui peuvent devenir très longues avec de nombreux `JOIN`) hors des fichiers métiers (Providers), afin de rendre le code Python plus propre, plus lisible et plus facilement maintenable.

---

## 🧠 Principes & Logique de conception

### 1. Séparation des responsabilités (Clean Code)
Dans une architecture solide, un fichier de Service (ex: `agents_data_provider.py`) ne devrait contenir que la "plomberie" : ouvrir la connexion, gérer les exceptions, fermer la connexion. 
Le texte pur de la requête SQL, lui, réside ici. Cela permet à un Data Analyst ou à un développeur de modifier rapidement une jointure ou d'ajouter une colonne sans risquer de casser la logique Python.

### 2. Le principe DRY (Don't Repeat Yourself)
Si une requête SQL est utilisée par plusieurs fichiers (par exemple, la jointure qui lie un Employé à son Projet et son Opération), on l'écrit **une seule fois** dans ce fichier. Si la structure de la base change demain, il n'y aura qu'un seul endroit à mettre à jour.

### 3. Les Variables Non-Évaluées
Il est primordial que ces fonctions retournent le texte de la requête SQL **brut** (avec les placeholders `%s`), et ne tentent pas d'y injecter les valeurs via Python (comme les f-strings avec variables utilisateur). C'est le Provider qui passera les valeurs au module `pymysql` lors du `.execute(sql, (valeur1, valeur2))` pour garantir la protection absolue contre les Injections SQL.

---

## 📂 Organisation du fichier

Ce fichier étant destiné à grandir, il est recommandé de le structurer en blocs thématiques :
- `-- AGENTS & SIRH --` (Jointures structurelles `ref_employes`)
- `-- REGLES & PRIMES --` (`matrice_primes`, configurations)
- `-- HEURES --` (`heures_corrigees`)
- `-- REQUÊTES UTILES --` (Mises à jour ou suppression en masse)

---

## 🛠️ Comment utiliser cet outil ?

### Étape 1 : Créer la requête dans `mysql_queries.py`

Ajoutez votre requête en créant une fonction qui retourne la chaîne de caractères (String) multi-lignes :

```python
def query_agent_complet():
    """Retourne la requête pour lire le profil complet d'un agent avec sa hiérarchie."""
    return """
        SELECT 
            e.matricule, e.nom, e.prenom,
            p.nom as projet,
            o.libelle as operation,
            s.libelle as statut,
            e.prime_langue
        FROM ref_employes e
        LEFT JOIN ref_structure_map m ON e.id_structure = m.id
        LEFT JOIN ref_projets p ON m.id_projet = p.id
        LEFT JOIN ref_operations o ON m.id_operation = o.id
        LEFT JOIN matrice_statuts s ON e.id_statut = s.id
        WHERE e.matricule = %s
    """
```

### Étape 2 : L'utiliser dans le Provider métier

Allez dans le fichier de votre module (ex: `modules/agents/services/agents_data_provider.py`), importez la requête et utilisez-la pour interroger MySQL :

```python
from tools.mysql_queries import query_agent_complet

def get_agent_profile(matricule: str):
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            # 1. On récupère le texte SQL depuis l'outil
            sql = query_agent_complet()
            
            # 2. On l'exécute de façon sécurisée avec %s
            cur.execute(sql, (matricule,))
            
            return cur.fetchone()
    finally:
        conn.close()
```
