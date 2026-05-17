# ⚙️ Documentation : Façade Règles de Primes (`provider.py`)

## 📍 Rôle du fichier
Le fichier `provider.py` est un **fichier de "Façade" (Alias de ré-exportation)** pour le module des Règles de Primes.

Comme pour les autres modules de l'application, il masque la complexité des imports sous-jacents (`dw_api_regles_provider.py`) et centralise toutes les fonctions d'accès aux données dans un seul point d'entrée court et facile à lire.

---

## 🧠 Principes & Logique de conception

### 1. Centralisation
Le fichier `dw_api_regles_provider` est l'un des plus massifs du projet, puisqu'il gère :
- La lecture et l'écriture des règles.
- L'historique des matrices/grilles d'objectifs (les configs JSON).
- L'activation d'une configuration.
- L'ordonnancement (Ordre d'affichage des grilles).

Plutôt que de forcer `routes.py` (ou n'importe quel autre script ETL futur) à importer manuellement ces 11 fonctions depuis le fichier brut, la façade permet une importation groupée.

### 2. Bypass Linter (`# noqa: F401`)
Le suffixe `# noqa: F401` désactive l'avertissement de Python sur les "imports inutilisés". C'est normal : on n'utilise pas ces fonctions *dans* ce fichier, on les importe uniquement pour que d'autres fichiers puissent les importer d'ici.

---

## 📂 Fonctions Ré-exposées

Les 11 méthodes ré-exportées couvrent tout le spectre du CRUD et de la gestion de versions des primes :

- **Règles :** `get_regles`, `get_regle_by_id`, `create_regle`, `update_regle`, `delete_regle`.
- **Grilles / Matrices :** `update_regle_grille` (Mise à jour rapide de la grille active).
- **Versioning (Configs) :** 
  - `get_regle_configs` (Liste l'historique JSON des grilles sauvegardées).
  - `create_regle_config` (Créer un nouveau Snapshot).
  - `set_active_config` (Activer une ancienne version / Rollback).
  - `update_grilles_order` (Changer l'ordre des grilles si la règle est multi-paliers).
  - `delete_grille` (Supprimer une version).

---

## 🛠️ Comment l'utiliser ?

Même si le fichier `routes.py` actuel importe directement depuis `dw_api_regles_provider.py`, la bonne pratique dans une architecture "Façade" serait de refactoriser `routes.py` pour qu'il importe ces fonctions depuis ce fichier.

Exemple d'import plus propre :
```python
# Au lieu de faire :
# from modules.regles_primes.services.dw_api_regles_provider import create_regle

# On ferait :
from modules.regles_primes.services.provider import create_regle
```
Cela permet de "cacher" complètement le fait que les données sont stockées dans MySQL/BigQuery (`dw_api`) au script qui gère le web (`routes`).
