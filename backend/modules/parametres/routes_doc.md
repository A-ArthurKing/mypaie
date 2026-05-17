# ⚙️ Documentation : API Paramètres (`routes.py`)

## 📍 Rôle du fichier
Le fichier `routes.py` centralise **tous les points d'entrée HTTP (endpoints)** liés à l'administration et au paramétrage de la plateforme MyPaie. 

Il utilise le système de **Blueprint** de Flask (`parametres_bp`) et suit la logique de l'architecture "Domain-First" : **ce fichier ne gère que les requêtes et les réponses Web**, toute la logique métier complexe et les requêtes SQL sont externalisées dans le dossier `services/`.

---

## 🧠 Principes & Logique de conception

Si vous parcourez le fichier, vous remarquerez que **toutes les routes suivent exactement le même "Template"**. Ce standard garantit la stabilité de l'application :

1. **Délégation aux services :** La route récupère les données (`request.args` ou `request.json`) et les passe immédiatement aux fonctions importées depuis `services/` (ex: `add_project`, `get_unique_column_values`).
2. **Gestion centralisée des erreurs :** Chaque route est enveloppée d'un bloc `try/except`. Toute erreur est loggée (`logger.error`) pour le débogage backend, et retourne proprement un JSON `{"error": "message"}` avec un code HTTP 500 au frontend.
3. **Temps réel et Cache :** Dès qu'une modification (POST, PUT, PATCH, DELETE) est effectuée, on utilise `invalidate_references_cache()` pour forcer la mise à jour du backend, et `emit_update("nom_de_levenement")` (Socket.IO) pour que tous les utilisateurs connectés voient le changement en direct sans rafraîchir la page.

---

## 📂 Les 5 Grands Blocs du Fichier

Le fichier est découpé visuellement par des commentaires en majuscules pour faciliter la navigation :

1. **INTROSPECTION BIGQUERY** (`/api/parametres/introspection/...`)
   - *Rôle :* Permet au frontend de fouiller dans BigQuery (lister les tables, les colonnes, extraire des valeurs brutes uniques, découvrir les KPIs).
2. **REGISTRE KPI** (`/api/parametres/kpis-registry/...`)
   - *Rôle :* Gérer le dictionnaire central des KPIs (Virtuels ou Gold). Intègre également la route IA Gemini pour la suggestion auto des libellés.
3. **MAPPING PROJETS** (`/api/parametres/mapping-projets/...`)
   - *Rôle :* Assigner un "Projet Brut" venant de la Data (ex: PVCP-APEN) à un "Projet Standard" connu par l'application MySQL.
4. **RÉFÉRENTIELS & ETL** (`/api/parametres/references`, `/etl-sources`)
   - *Rôle :* Routes de lecture (GET) pour charger les menus déroulants et configurer les pipelines.
5. **STRUCTURE ORGANISATIONNELLE** (`/api/parametres/structure/...`)
   - *Rôle :* Le gros bloc CRUD (Créer, Lire, Mettre à jour, Supprimer) pour gérer la hiérarchie : Projets > Opérations > Sous-projets (Files) > Activités.

---

## 🛠️ Comment ajouter une nouvelle route ?

Imaginons que vous deviez ajouter une fonctionnalité pour **"Dupliquer un projet"**. Voici la marche à suivre pour respecter le standard de ce fichier :

### Étape 1 : Créer la logique dans le service (Base de données)
N'écrivez **jamais** de code SQL directement dans `routes.py`.
Ouvrez `modules/parametres/services/structure_provider.py` et ajoutez votre fonction métier :
```python
def duplicate_project(id_source: int, nouveau_nom: str):
    # Logique SQL ici...
    return {"message": "Projet dupliqué avec succès", "new_id": 99}
```

### Étape 2 : Importer la fonction dans `routes.py`
En haut de `routes.py`, ajoutez votre fonction dans les imports correspondants :
```python
from modules.parametres.services.structure_provider import (
    add_project, update_project, delete_project, duplicate_project  # <== Ajouté ici
)
```

### Étape 3 : Créer l'endpoint Flask
Allez dans la section correspondante (ex: `=== Projets ===`) et ajoutez la route en respectant le pattern (Try/Except + Socket) :

```python
@parametres_bp.route("/api/parametres/structure/projets/<int:id>/duplicate", methods=["POST"])
def endpoint_duplicate_project(id):
    data = request.json or {}
    nouveau_nom = data.get("nouveau_nom")
    
    if not nouveau_nom:
        return jsonify({"error": "Le nouveau nom est requis"}), 400

    try:
        # 1. Appel du service
        res = duplicate_project(id, nouveau_nom)
        
        # 2. Mise à jour du cache et Socket.IO
        _emit_structure_update() 
        
        # 3. Réponse propre
        return jsonify(res), 201
        
    except Exception as e:
        # 4. Gestion des crashs
        logger.error(f"Erreur duplication projet {id}: {e}")
        return jsonify({"error": str(e)}), 500
```

### Règles d'or :
- Toujours retourner `{ "data": ... }` pour les listes ou l'objet créé.
- Toujours retourner `{ "error": "Explication" }` en cas de problème.
- Penser à utiliser `_emit_structure_update()` ou `emit_update(...)` si la base de données est modifiée.
