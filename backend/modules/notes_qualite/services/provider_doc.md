# ⚙️ Documentation : Façade Notes Qualité (`provider.py`)

## 📍 Rôle du fichier
Le fichier `provider.py` du dossier `modules/notes_qualite/services/` est un **fichier de "Façade" (ou alias de ré-exportation)**.

Comme les autres fichiers `provider.py` du backend (dans Performance, Règles Primes, etc.), il ne contient **absolument aucune logique de code**. Son rôle unique est d'importer les fonctions qui calculent les notes qualité (depuis `dw_api_qualite_provider.py`) et de les reproposer sous un chemin d'import plus simple et standardisé (`modules.notes_qualite.services.provider`).

---

## 🧠 Principes & Logique de conception

### 1. Masquer la complexité d'infrastructure (Abstraction)
Actuellement, les notes qualité proviennent de l'entrepôt de données ("Data Warehouse", d'où le préfixe `dw_api_`). En créant cette façade, on prépare le terrain pour le futur : si un jour MyPaie arrête d'utiliser BigQuery pour récupérer ses données qualité, et utilise une API REST d'un logiciel tiers, il suffira de :
1. Créer un `api_tierce_qualite_provider.py`.
2. Changer l'import dans cette façade.
Et **aucun autre fichier de l'application** n'aura besoin d'être modifié.

### 2. Bypass Linter (`# noqa: F401`)
Le commentaire `# noqa: F401` informe les analyseurs de code Python (linters) que l'import non utilisé de ces fonctions est totalement volontaire.

---

## 📂 Fonctions Ré-exposées

Ce fichier permet d'accéder rapidement aux 4 fonctions cardinales de la lecture des notes qualité :

1. **`get_qualite_agents`** (Données détaillées, pour les tableaux du frontend).
2. **`get_qualite_stats_projets`** (Agrégations macro, par projets).
3. **`get_qualite_stats_global`** (Statistiques sur les typologies d'erreurs).
4. **`get_qualite_totaux_par_matricule`** (L'agrégation pure par employé, vitale pour que le "Résolveur Unifié" calcule les primes mensuelles).

---

## 🛠️ Comment utiliser ou gérer ce fichier ?

### Cas n°1 : Vous créez une nouvelle requête de Qualité
Si vous codez un `get_top_5_worst_agents()` dans le vrai provider (`dw_api_qualite_provider.py`), il faudra le rajouter ici pour qu'il soit accessible par la façade :

```python
from modules.notes_qualite.services.dw_api_qualite_provider import (  # noqa: F401
    get_qualite_agents,
    get_qualite_stats_projets,
    get_qualite_stats_global,
    get_qualite_totaux_par_matricule,
    get_top_5_worst_agents, # <== Ajouté ici
)
```

### Cas n°2 : Usage dans un nouveau Blueprint ou Worker
Au lieu d'importer directement depuis l'implémentation BigQuery, utilisez cette façade pour un code plus propre et "découplé" :

```python
# Import propre et découplé de l'infrastructure sous-jacente :
from modules.notes_qualite.services.provider import get_qualite_agents
```
