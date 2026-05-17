# ⚙️ Documentation : Façade Performance (`provider.py`)

## 📍 Rôle du fichier
Le fichier `provider.py` est un **fichier de "Façade" (ou alias de ré-exportation)** spécifique au module Performance.

Tout comme dans le module Paramètres, il ne contient **aucune logique métier propre**. Son seul but est d'importer les fonctions complexes depuis `dw_api_performance_provider.py` et de les exposer sous un nom de module plus simple (`modules.performance.services.provider`).

---

## 🧠 Principes & Logique de conception

### 1. Simplification des imports (Pattern Façade)
Plutôt que d'obliger les autres fichiers de l'application à importer depuis un nom long et lié à la technologie sous-jacente (`dw_api_performance_provider`), ils pourraient théoriquement importer depuis le simple `provider.py`.
Si un jour les données de performance ne viennent plus de `dw_api` (BigQuery) mais d'une base SQL Server locale, seul cet alias devra être mis à jour pour pointer vers le nouveau fichier (ex: `sql_performance_provider.py`).

### 2. Bypass des erreurs de Linter (`# noqa: F401`)
L'instruction `# noqa: F401` en bout de ligne désactive l'avertissement de Python qui dirait : *"Attention, vous importez des fonctions sans les utiliser dans ce fichier"*. C'est le comportement volontaire d'un fichier de ré-exportation.

---

## 📂 Fonctions Ré-exposées

Ce fichier ré-expose les fonctions de lecture métier de la performance :

1. **`get_performance_pvcp`**
   - *Rôle originel :* Interroge BigQuery pour récupérer les données de performance consolidées (avec gestion des limites, offsets et filtres de dates/agents).
2. **`get_perf_totaux_par_matricule`**
   - *Rôle originel :* Calcule la DMT (Durée Moyenne de Traitement) groupée par matricule agent sur une période donnée.

---

## 🛠️ Comment gérer ce fichier ?

### Cas n°1 : Ajout d'une nouvelle fonction de Performance
Si vous développez une nouvelle fonction `get_perf_agent_annuelle(...)` dans `dw_api_performance_provider.py`, vous devez l'ajouter à la liste d'import de cette façade :

```python
from modules.performance.services.dw_api_performance_provider import (  # noqa: F401
    get_performance_pvcp,
    get_perf_totaux_par_matricule,
    get_perf_agent_annuelle, # <== Ajouté ici
)
```

### Cas n°2 : Nettoyage / Refactoring
Actuellement, si on regarde `routes.py` dans le module performance, on remarque qu'il importe directement depuis `dw_api_performance_provider`. Cela signifie que cette façade n'est potentiellement plus utilisée. Vous pouvez soit :
- Mettre à jour `routes.py` pour qu'il utilise la façade (`from modules.performance.services.provider import ...`).
- Supprimer ce fichier `provider.py` s'il est jugé inutile pour simplifier l'arborescence.
