# ⚙️ Documentation : Façade d'Introspection (`introspection_provider.py`)

## 📍 Rôle du fichier
Le fichier `introspection_provider.py` est un **fichier de "Façade" (ou alias de ré-exportation)**. 

Il ne contient aucune logique métier propre. Son unique but est d'importer les fonctions depuis le vrai fournisseur de données (`dw_api_introspection_provider.py`) et de les rendre disponibles sous un chemin d'import plus court ou plus propre pour le reste de l'application.

---

## 🧠 Principes & Logique de conception

### 1. Le Pattern de Façade
Dans des architectures logicielles complexes, on utilise parfois des fichiers "façade" pour simplifier les imports. Au lieu d'importer depuis un nom de fichier très long et technique comme `dw_api_introspection_provider`, les autres modules de l'application peuvent simplement importer depuis `introspection_provider`.
Cela crée une couche d'abstraction : si demain la technologie BigQuery (`dw_api_`) est remplacée par une autre technologie (ex: AWS Snowflake), les autres fichiers n'auront pas besoin de changer leurs imports. Il suffira de modifier ce fichier façade pour qu'il pointe vers le nouveau connecteur.

### 2. L'instruction `# noqa: F401`
En Python, les linters (comme Flake8 ou Pylint) signalent une erreur si vous importez une fonction sans l'utiliser dans le même fichier.
Le commentaire `# noqa: F401` (No Quality Assurance : Flake 401) indique explicitement aux outils de validation de code : *"Ne lève pas d'avertissement ici. Je sais que je n'utilise pas ces fonctions dans ce fichier, je les importe exprès pour que d'autres fichiers puissent venir les chercher ici."*

---

## 📂 Fonctions Ré-exposées

Ce fichier ré-expose exactement les mêmes fonctions que celles documentées dans `dw_api_introspection_provider_doc.md` :

1. **`list_bigquery_tables`**
2. **`list_table_columns`**
3. **`get_unique_column_values`**
4. **`discover_gold_kpis`**

---

## 🛠️ Comment gérer ce fichier ?

### Cas n°1 : Ajout d'une nouvelle fonction d'introspection
Si vous avez ajouté une nouvelle fonction `get_available_months()` dans `dw_api_introspection_provider.py`, vous **devez** l'ajouter à la liste d'importation de ce fichier si vous souhaitez qu'elle soit accessible via l'alias.

```python
from modules.parametres.services.dw_api_introspection_provider import (  # noqa: F401
    list_bigquery_tables,
    list_table_columns,
    get_unique_column_values,
    discover_gold_kpis,
    get_available_months, # <== Ajouté ici
)
```

### Cas n°2 : Nettoyage futur (Refactoring)
Si un jour vous décidez d'uniformiser le code et de vous débarrasser des alias, vous pouvez :
1. Mettre à jour tous les fichiers qui importent `introspection_provider` pour qu'ils pointent directement sur `dw_api_introspection_provider`.
2. Supprimer totalement ce fichier de façade.
