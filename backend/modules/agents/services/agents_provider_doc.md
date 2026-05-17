# ⚙️ Documentation : Façade Agents Locaux (`agents_provider.py`)

## 📍 Rôle du fichier
Le fichier `agents_provider.py` est un **fichier de "Façade" (ou alias de ré-exportation)** situé dans le module `agents`.

Comme les autres façades de l'application, ce fichier ne contient **aucune logique**. Il importe simplement les fonctions de gestion des agents locaux depuis l'implémentation sous-jacente (`agents_data_provider.py`) et les ré-expose proprement.

---

## 🧠 Principes & Logique de conception

### 1. Pourquoi cette façade ?
Le module "Agents" est particulier car il gère deux "bases" différentes d'agents :
1. **La base "SIRH Officiel"** (qui vient d'un SQL Server externe, géré par `sirh_agents_provider.py`).
2. **La base "Locale MyPaie"** (qui vient de la base MySQL locale, gérée par `agents_data_provider.py`).

L'intérêt d'utiliser ce fichier de façade (`agents_provider.py`) est sémantique : quand un développeur importe depuis `agents_provider`, il sait immédiatement qu'il agit sur les **données locales modifiables** de l'application MyPaie (les employés ajoutés via l'UI, leurs statuts, leurs sanctions sur les primes), par opposition aux données du système RH d'entreprise (lecture seule).

### 2. Bypass Linter (`# noqa: F401`)
Le commentaire `# noqa: F401` désactive l'avertissement du linter Python qui signalerait des imports inutilisés, ce qui est le comportement normal d'une façade.

---

## 📂 Fonctions Ré-exposées

Ce fichier permet d'accéder au CRUD complet des agents dans la base de données de gestion locale :

1. **`get_all_agents_gestion`** : Récupère tous les employés locaux (avec leur structure complète via jointures).
2. **`add_agent` / `update_agent` / `delete_agent`** : Méthodes CRUD standard pour la table `ref_employes`.
3. **`update_agent_global_statut`** : Mise à jour ciblée (Fast-Patch) du contrat/statut global.
4. **`get_agents_manual_data` / `save_agent_manual_data`** : Les fonctions d'exceptions (ex: pour forcer une sanction ou changer un statut pour un mois donné sur une règle de prime spécifique).

---

## 🛠️ Comment utiliser ou gérer ce fichier ?

### Cas n°1 : Ajout d'une nouvelle fonction
Si vous ajoutez une fonction `bulk_import_agents(...)` dans le fichier `agents_data_provider.py`, ajoutez-la ici pour qu'elle devienne publiquement accessible :

```python
from modules.agents.services.agents_data_provider import (  # noqa: F401
    get_agents_manual_data,
    save_agent_manual_data,
    get_all_agents_gestion,
    update_agent_global_statut,
    add_agent,
    update_agent,
    delete_agent,
    bulk_import_agents, # <== Ajouté ici
)
```

### Cas n°2 : Utilisation dans l'application
Dans les contrôleurs ou les workers, préférez l'import de la façade :

```python
# Import depuis la façade :
from modules.agents.services.agents_provider import get_all_agents_gestion
```
