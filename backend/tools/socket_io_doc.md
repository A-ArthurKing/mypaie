# ⚙️ Documentation : Outil Temps Réel (`socket_io.py`)

## 📍 Rôle du fichier
Le fichier `socket_io.py` (situé dans le dossier `tools/`) est le composant central gérant la communication en **temps réel** entre le backend Flask et le frontend React via le protocole **WebSockets**.

Il contient l'instanciation du serveur Socket.IO ainsi qu'une fonction utilitaire (`emit_update`) massivement utilisée dans l'application pour notifier les clients connectés qu'une donnée a changé.

---

## 🧠 Principes & Logique de conception

### 1. Prévention des imports circulaires
L'objet `socketio` doit être attaché à l'application Flask principale (dans `app.py`), mais il doit aussi être utilisé par toutes les routes (dans le dossier `modules/`).
En isolant l'instanciation de `socketio` dans ce fichier indépendant, l'application évite le fameux problème d'"Import Circulaire" (où `app.py` importe `routes.py` qui importerait `app.py`).

### 2. Mode Asynchrone (Eventlet)
L'instance est configurée avec `async_mode="eventlet"`.
C'est une bibliothèque réseau asynchrone pour Python qui permet à Flask de gérer des centaines de connexions WebSocket ouvertes simultanément sans bloquer le serveur web, offrant d'excellentes performances pour le temps réel.

### 3. Fonction Helper "Fire and Forget"
La fonction `emit_update` simplifie l'envoi de messages. Par défaut, si l'on ne spécifie pas de donnée (`data`), elle envoie un simple JSON `{"updated": True}`. C'est un mécanisme de "Ping" (signal) : le backend prévient le frontend qu'une donnée a changé, et c'est le frontend qui se chargera de refaire une requête HTTP `GET` pour récupérer la donnée fraîche.

---

## 📂 Objets et Fonctions Exposés

1. **`socketio`** (Objet global)
   - *Utilisé dans :* `backend/app.py`
   - *Rôle :* Attaché à l'application web au démarrage via `socketio.init_app(app)`.

2. **`emit_update(event_name: str, data: dict = None)`**
   - *Utilisé dans :* Tous les fichiers `routes.py` (Paramètres, Règles, Agents, etc.)
   - *Rôle :* Envoie un événement "Broadcast" (à tous les utilisateurs actuellement connectés sur MyPaie).

---

## 🛠️ Comment utiliser cet outil ?

### Dans le Backend (pour prévenir d'un changement)
Dès qu'une fonction modifie la base de données (ajout, modification, suppression), importez l'outil et "émettez" un événement :

```python
from tools.socket_io import emit_update

@mon_blueprint.route("/api/mon_entite", methods=["POST"])
def creer_entite():
    # ... Logique de création en base de données ...
    
    # Prévenir tous les clients que l'entité a été créée
    emit_update("mon_entite_mise_a_jour")
    return jsonify({"success": True})
```

### Dans le Frontend (pour réagir au changement)
Côté React (généralement dans un `useEffect`), le client "écoute" cet événement spécifique et lance un rechargement des données (ex: rafraîchissement d'un tableau) sans que l'utilisateur n'ait besoin de faire F5 :

```javascript
useEffect(() => {
    // Écoute de l'événement backend
    socket.on("mon_entite_mise_a_jour", () => {
        console.log("Rafraîchissement automatique des données...");
        fetchData(); // Rappel de l'API GET
    });

    // Nettoyage à la fermeture du composant
    return () => socket.off("mon_entite_mise_a_jour");
}, []);
```
