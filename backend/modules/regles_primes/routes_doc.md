# ⚙️ Documentation : API Règles de Primes (`routes.py`)

## 📍 Rôle du fichier
Le fichier `routes.py` centralise **tous les points d'entrée HTTP (endpoints)** liés au moteur de calcul et à la gestion des **Règles de Primes**.

Il utilise un **Blueprint** Flask (`regles_primes_bp`). Ce module est particulièrement complexe car il gère à la fois le CRUD classique des règles, le versioning des grilles d'objectifs, et le déclenchement du puissant moteur de calcul des primes (Calculation Engine).

---

## 🧠 Principes & Logique de conception

1. **Architecture Domain-First :** Toutes les routes font le pont entre les requêtes HTTP (le frontend) et les services situés dans le dossier `services/` (`dw_api_regles_provider`, `calculation_engine`).
2. **Temps Réel omniprésent :** Ce module modifie l'argent et les objectifs des collaborateurs. Il est impératif que toute modification soit immédiatement reflétée pour tous les utilisateurs. C'est pourquoi on utilise intensivement `emit_update("nom_event", {"data"})` de Socket.IO après chaque opération d'écriture (POST, PUT, PATCH, DELETE).
3. **Séparation entre Configuration et Moteur :** Les routes qui gèrent la configuration (`/configs`, `/grille`) sont séparées de la route qui exécute les maths financières (`/calcul`).

---

## 📂 Les 3 Grands Blocs d'Endpoints

### 1. Gestion du Moteur de Calcul (`/api/regles/<id>/calcul`)
- *Rôle :* Endpoint le plus critique. Il appelle `run_payout_calculation` dans `calculation_engine.py` pour unitairement calculer les montants gagnés par une liste d'agents sur une période.
- *Entrées :* `date_debut`, `date_fin`, `matricules` (au format CSV dans l'URL).

### 2. Versioning des Configurations (`/api/regles/<id>/configs/...`)
*Les règles de primes évoluent dans le temps. Ce bloc gère l'historique et les versions des matrices de calcul.*
- **`GET /configs`** : Liste l'historique des grilles d'une règle.
- **`POST /configs`** : Sauvegarde une nouvelle version de grille (un snapshot JSON).
- **`POST /configs/<config_id>/activate`** : "Rollback" ou Activation. Rend une ancienne version de grille active.
- **`PATCH /grilles/order`** : Gère l'ordre d'affichage des grilles (s'il y a plusieurs paliers).

### 3. CRUD Classique des Règles (`/api/regles`)
*Gestion de l'entité globale "Règle de Prime" (Son nom, le projet rattaché, l'enveloppe budgétaire, etc.).*
- **`POST /api/regles`** : Crée la règle coquille.
- **`GET /api/regles`** (et avec `<id>`) : Récupère toutes les règles ou une règle spécifique.
- **`PUT /api/regles/<id>`** : Met à jour les infos globales.
- **`PATCH /api/regles/<id>/grille`** : Met à jour la grille de la règle courante (utilisé par l'éditeur visuel React Flow ou la grille tabulaire).

---

## 🛠️ Comment ajouter une nouvelle route de prime ?

Exemple : Si l'équipe veut ajouter une fonctionnalité pour **Dupliquer une règle de prime existante avec toute sa configuration**.

### Étape 1 : Créer la logique dans le service
Ouvrez `modules/regles_primes/services/dw_api_regles_provider.py` et créez la logique SQL :
```python
def duplicate_regle_complete(regle_id: int):
    # Logique pour copier la ligne MySQL et ses JSON
    return {"message": "Règle dupliquée", "new_id": 42}
```

### Étape 2 : Créer l'endpoint Flask
Ajoutez la fonction dans `routes.py`, tout en respectant l'émission Socket.IO !

```python
@regles_primes_bp.route("/api/regles/<int:regle_id>/duplicate", methods=["POST"])
def endpoint_duplicate_regle(regle_id):
    try:
        from modules.regles_primes.services.dw_api_regles_provider import duplicate_regle_complete
        
        # 1. Appel du métier
        res = duplicate_regle_complete(regle_id)
        
        # 2. Informer le Frontend pour qu'il rafraîchisse la liste
        emit_update("regle_created")
        
        # 3. Réponse propre
        return jsonify(res), 201
        
    except Exception as e:
        logger.error("Erreur duplication règle %s : %s", regle_id, e)
        return jsonify({"error": str(e)}), 500
```
