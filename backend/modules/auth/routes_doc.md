# ⚙️ Documentation : API Authentification (`routes.py`)

## 📍 Rôle du fichier
Le fichier `routes.py` du module `auth` est le **gardien des portes de l'application**. 

Il a deux responsabilités uniques :
1. Authentifier un utilisateur via son Email/Mot de passe et lui délivrer un "Passeport" numérique (Token JWT).
2. Vérifier si un "Passeport" est toujours valide et renvoyer les informations de l'utilisateur associé (session persistante).

Comme le module `users`, l'authentification est une fonctionnalité basique qui **ne possède pas de dossier `services/`**. Elle exécute ses requêtes SQL directement pour vérifier les identifiants.

---

## 🧠 Principes & Logique de conception

### 1. Le mécanisme JWT (JSON Web Token)
Le système ne conserve aucune session sur le serveur (Stateless). 
Lorsqu'un utilisateur se connecte avec succès, le backend génère un `Token JWT` signé avec une clé secrète serveur (`JWT_SECRET`). 
Ce Token agit comme un "Passeport" : il contient de manière cryptée et non falsifiable l'identité de l'utilisateur (son ID, son Rôle, son Nom) et sa **date d'expiration** (fixée ici à 1 jour : `datetime.timedelta(days=1)`).

Le frontend stocke ce Token (souvent dans le LocalStorage) et l'envoie ensuite dans l'en-tête `Authorization: Bearer <token>` de **chacune de ses requêtes HTTP** pour prouver son identité.

### 2. Sécurité des mots de passe
Le backend ne stocke et ne compare **jamais** de mot de passe en clair. 
Lors de la tentative de connexion, il utilise la fonction `check_password_hash()` de la librairie `werkzeug.security`. Cette fonction prend le Hash cryptographique complexe (ex: `pbkdf2:sha256...`) stocké dans MySQL et vérifie mathématiquement s'il correspond au mot de passe tapé par l'utilisateur.

### 3. Contrôle du compte Actif
Même si le mot de passe est bon, le système vérifie le flag `actif` dans la base de données. Si un RH ou un Administrateur a cliqué sur "Désactivé" dans la page Utilisateurs, le système bloquera instantanément la connexion en renvoyant une erreur HTTP 403 (Forbidden).

---

## 📂 Les 2 Endpoints Exposés

### 1. Connexion (`POST /api/auth/login`)
- *Rôle :* Endpoint appelé par le formulaire de Login du frontend.
- *Processus :* 
  1. Vérifie que la charge utile contient bien un email et un mot de passe.
  2. Cherche l'utilisateur dans MySQL (`app_users`).
  3. Vérifie le hash du mot de passe.
  4. Vérifie que le compte n'est pas suspendu.
  5. Génère le JWT et le retourne au format `{ "token": "...", "user": {...} }`.

### 2. Session / Garde Fou (`GET /api/auth/me`)
- *Rôle :* Permet au frontend (généralement dans son contexte React ou son "Router") de savoir si l'utilisateur est toujours légitimement connecté lors d'un rafraîchissement de page (`F5`).
- *Processus :* 
  1. Lit l'en-tête HTTP `Authorization`.
  2. Décrypte le Token via la clé secrète `JWT_SECRET`.
  3. Si la date d'expiration (`exp`) est dépassée, ou si le token a été falsifié, la librairie `jwt` lève une exception et le serveur renvoie proprement une erreur HTTP 401 (Unauthorized).
  4. Sinon, il renvoie les données contenues dans le token, permettant au frontend de restaurer la session visuelle.

---

## 🛠️ Comment ajouter une sécurité supplémentaire ?

Si demain l'entreprise exige que les mots de passe expirent ou qu'un "Dernier accès" soit enregistré :

### Exemple : Enregistrer l'heure de dernière connexion

1. Ajoutez une colonne `last_login DATETIME` dans la table MySQL `app_users`.
2. Mettez à jour l'endpoint `login` juste avant de générer le token :

```python
            if not user['actif']:
                return jsonify({"error": "Ce compte est désactivé"}), 403
            
            # --- AJOUT: Enregistrer la date de connexion ---
            cur.execute("UPDATE app_users SET last_login = NOW() WHERE id = %s", (user['id'],))
            conn.commit() # Ne pas oublier le commit !
            # -----------------------------------------------

            # Create token
            payload = {
```
