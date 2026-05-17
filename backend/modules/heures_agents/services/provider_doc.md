# ⚙️ Documentation : Façade Heures Agents (`provider.py`)

## 📍 Rôle du fichier
Le fichier `provider.py` du dossier `modules/heures_agents/services/` est un **fichier de "Façade" (ou alias de ré-exportation)**.

Comme c'est le standard dans cette application (voir les façades de `performance`, `notes_qualite`, etc.), ce fichier ne contient **absolument aucune logique de code**. Il se contente d'importer les fonctions depuis l'implémentation concrète (`dw_api_heures_provider.py`) et de les ré-exposer sous un espace de nommage simplifié : `modules.heures_agents.services.provider`.

---

## 🧠 Principes & Logique de conception

### 1. Masquer la source de données (Abstraction)
Ce pattern est particulièrement utile ici. Historiquement, les heures agents provenaient de BigQuery (d'où le nom `dw_api_`). Or, pour des raisons de performance, l'implémentation sous-jacente a été modifiée pour interroger directement une base de données MySQL locale (`gestionpaie`). 
Grâce à ce système de façade, le reste de l'application (les routes HTTP, le moteur de calcul de primes) n'a jamais eu besoin de se soucier de ce changement d'infrastructure.

### 2. Bypass Linter (`# noqa: F401`)
Le commentaire `# noqa: F401` indique aux analyseurs de code (comme Flake8) d'ignorer le fait que ces fonctions sont importées mais non utilisées dans ce script précis. C'est le comportement attendu d'un fichier "index" ou "façade".

---

## 📂 Fonctions Ré-exposées

Ce fichier permet d'accéder aux 4 fonctions du service Heures :

1. **`get_heures_agents`** (Retourne la grille détaillée des horaires des agents jour par jour).
2. **`get_equipes_distinctes`** (Retourne la liste des équipes pour les listes déroulantes de filtrage).
3. **`get_projets_distincts`** (Retourne la liste des projets pour le filtrage).
4. **`get_totaux_par_matricule`** (L'agrégation pure en millisecondes par employé, vitale pour que le "Résolveur Unifié" calcule les primes mensuelles).

---

## 🛠️ Comment utiliser ou gérer ce fichier ?

### Cas n°1 : Vous créez une nouvelle requête
Si vous codez un `get_heures_stats_projets()` dans le vrai provider (`dw_api_heures_provider.py`), il faudra le rajouter ici pour qu'il soit accessible via la façade :

```python
from modules.heures_agents.services.dw_api_heures_provider import (  # noqa: F401
    get_heures_agents,
    get_equipes_distinctes,
    get_projets_distincts,
    get_totaux_par_matricule,
    get_heures_stats_projets, # <== Ajouté ici
)
```

### Cas n°2 : Usage dans un nouveau Blueprint ou Worker
Au lieu d'importer directement depuis l'implémentation `dw_api_...`, utilisez cette façade pour un code plus propre et "découplé" :

```python
# Import propre et découplé de la technologie de base de données :
from modules.heures_agents.services.provider import get_heures_agents
```
