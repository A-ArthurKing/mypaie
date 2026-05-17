# ⚙️ Documentation : API Performance (`routes.py`)

## 📍 Rôle du fichier
Le fichier `routes.py` centralise **tous les points d'entrée HTTP (endpoints)** liés aux données de **performance** des agents sur la plateforme MyPaie.

Il utilise un **Blueprint** Flask (`performance_bp`). Selon l'architecture "Domain-First", ce fichier est responsable de :
1. Valider les paramètres passés dans la requête (URL, query strings, corps JSON).
2. Transmettre la demande aux services métiers ou de base de données (situés dans le dossier `services/`).
3. Renvoyer une réponse propre (code HTTP 200/201/202 ou 400/500) structurée en JSON.

---

## 🧠 Principes & Logique de conception

La structure de toutes les routes de ce module est standardisée :

1. **Validation en amont :** Les paramètres (`limit`, `offset`, format CSV des matricules) sont lus et convertis. S'ils sont invalides, une erreur `400 Bad Request` est renvoyée immédiatement.
2. **Délégation :** Les requêtes complexes (qui vont chercher dans BigQuery ou interrogent des API externes) sont gérées par `modules.performance.services.dw_api_performance_provider`.
3. **Sécurité & Threading :** Le déclenchement de l'ETL (qui est lourd) s'effectue dans un **thread en arrière-plan** via `threading.Thread()`, ce qui permet à l'API de répondre immédiatement (`202 Accepted`) sans faire patienter le client.
4. **Log et Try/Except :** Chaque appel métier est encapsulé pour attraper les erreurs. Si le backend échoue, il écrit l'erreur dans la console (`logger.error`) et masque l'erreur brutale au client en renvoyant un JSON propre avec un code `500`.

---

## 📂 Les Endpoints Existants

Actuellement, ce module contient 3 routes principales :

1. **Déclenchement ETL** (`POST /api/performance/etl/trigger`)
   - *Rôle :* Lance manuellement le script d'ETL (Extraction, Transformation, Chargement) de la performance en asynchrone (arrière-plan).
2. **Données Consolidées** (`GET /api/performance/pvcp`)
   - *Rôle :* Retourne les indicateurs de performance. 
   - *Options :* Accepte la pagination (`limit`, `offset`), le filtrage par dates (`date_debut`, `date_fin`), par agent, et la granularité (`total`, par jour, etc.).
3. **Totaux (DMT)** (`GET /api/performance/totaux`)
   - *Rôle :* Calcul spécifique et agrégé pour récupérer la Durée Moyenne de Traitement (DMT) filtrée par matricules (passés en liste via CSV). 

---

## 🛠️ Comment ajouter une nouvelle route ?

Voici le standard à suivre pour ajouter un nouvel endpoint, par exemple pour "Récupérer la performance individuelle d'un agent spécifique sur l'année" :

### Étape 1 : Créer la logique dans le service
N'écrivez pas la logique de calcul ni les requêtes SQL/BigQuery dans `routes.py`.
Ouvrez `modules/performance/services/dw_api_performance_provider.py` (ou `provider.py`) et ajoutez la fonction :
```python
def get_perf_agent_annuelle(matricule: str, annee: int):
    # Logique de requête BigQuery / calculs ici...
    return {"matricule": matricule, "annee": annee, "score": 98.5}
```

### Étape 2 : Importer la fonction dans `routes.py`
Dans `routes.py`, importez cette nouvelle fonction tout en haut :
```python
from modules.performance.services.dw_api_performance_provider import (
    get_performance_pvcp, get_perf_totaux_par_matricule, get_perf_agent_annuelle  # <== Ajouté ici
)
```

### Étape 3 : Créer l'endpoint Flask
Ajoutez la fonction Python décorée par `@performance_bp.route` avec un bloc `try/except` :

```python
@performance_bp.route("/api/performance/agent/<matricule>/annuel", methods=["GET"])
def endpoint_perf_agent_annuelle(matricule):
    # 1. Récupération et validation des paramètres
    annee = request.args.get("annee")
    if not annee or not annee.isdigit():
        return jsonify({"error": "Le paramètre 'annee' (entier) est requis."}), 400

    try:
        # 2. Appel du service
        result = get_perf_agent_annuelle(matricule, int(annee))
        
        # 3. Réponse propre (généralement formatée dans une clé "data")
        return jsonify({"data": result}), 200
        
    except Exception as err:
        # 4. Gestion d'erreur propre
        logger.error(f"Erreur endpoint perf_annuelle pour {matricule} : {err}")
        return jsonify({"error": "Erreur lors du calcul de la performance annuelle."}), 500
```
