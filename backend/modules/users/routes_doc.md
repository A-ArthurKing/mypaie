# ⚙️ Documentation : API Utilisateurs (`routes.py`)

## 📍 Rôle du fichier
Le fichier `routes.py` du module `users` gère l'ensemble du **CRUD (Create, Read, Update, Delete)** des administrateurs et collaborateurs de l'application (table `app_users`). 

Il permet de lister les accès, de créer de nouveaux comptes, de modifier les droits (rôles) ou de désactiver/supprimer des utilisateurs.

---

## 🧠 Principes & Logique de conception

### 1. Simplicité et connexion directe
Contrairement aux autres modules de la plateforme (comme `parametres` ou `regles_primes`) qui séparent strictement les routes HTTP (`routes.py`) des accès aux données (`services/provider.py`), ce module **exécute les requêtes SQL MySQL directement dans les routes**.
C'est un motif d'architecture plus simple (dit "Active Record" basique), adapté ici car la gestion des utilisateurs est une fonctionnalité très basique qui n'est pas amenée à intégrer une logique métier complexe (comme le moteur de calcul de primes).

### 2. Sécurité des Mots de Passe
Pour des raisons de sécurité, **aucun mot de passe n'est stocké en clair** dans la base de données.
Le fichier utilise la bibliothèque `werkzeug.security` et sa fonction `generate_password_hash()`. 
Quand un utilisateur est créé ou quand on modifie son mot de passe, l'application génère un hash cryptographique (ex: `pbkdf2:sha256:...`) qui est ensuite inséré dans le champ `password_hash` de la table MySQL.

### 3. Protection Anti-Doublon
Lors de la création d'un utilisateur (`POST /api/users`), le code fait toujours une requête `SELECT` préalable pour vérifier si l'email existe déjà dans la base. Si c'est le cas, il rejette la création avec une erreur HTTP 400.

---

## 📂 Les Endpoints Existants

1. **Liste des utilisateurs** (`GET /api/users`)
   - *Rôle :* Récupère tous les utilisateurs classés du plus récent au plus ancien.
   - *Exclusion :* Notez que le `SELECT` omet volontairement le champ `password_hash` pour ne pas faire fuiter d'informations sensibles au frontend.

2. **Création d'un utilisateur** (`POST /api/users`)
   - *Rôle :* Vérifie les champs requis, vérifie l'unicité de l'email, génère le hash du mot de passe et crée le profil.
   - *Défaut :* Si aucun rôle n'est spécifié, l'utilisateur naîtra avec le rôle "Collaborateur".

3. **Mise à jour d'un utilisateur** (`PUT /api/users/<id>`)
   - *Rôle :* Modifie les infos (`nom`, `prenom`, `role`, `actif`).
   - *Comportement intelligent :* La requête SQL s'adapte en fonction du payload. Si un `password` est fourni, elle met à jour le hash. Si le champ `password` est vide ou absent (cas courant où l'admin modifie juste le nom sans changer le mot de passe), elle modifie les infos sans toucher au mot de passe existant.

4. **Suppression** (`DELETE /api/users/<id>`)
   - *Rôle :* Supprime définitivement l'utilisateur de la base.

---

## 🛠️ Comment ajouter une nouvelle route ?

Si demain vous souhaitez ajouter un endpoint pour "Activer/Désactiver" rapidement un utilisateur sans envoyer tout le formulaire (ex: un bouton "Toggle" dans une grille) :

### Exemple de route (Patch) :
```python
@users_bp.route('/api/users/<int:user_id>/toggle-status', methods=['PATCH'])
def toggle_user_status(user_id):
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            # On inverse le statut (1 devient 0, 0 devient 1)
            cur.execute("UPDATE app_users SET actif = 1 - actif WHERE id = %s", (user_id,))
            conn.commit()
            
        return jsonify({"success": True}), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()
```

### Piste d'évolution (Refactoring)
Pour harmoniser ce fichier à 100% avec l'architecture "Domain-First" du reste du projet, l'étape suivante consisterait à :
1. Créer un dossier `modules/users/services/`
2. Y placer un fichier `user_provider.py` contenant toutes les fonctions `conn.execute()`.
3. Vider ce `routes.py` pour qu'il n'ait plus qu'à importer et appeler le `user_provider`.
