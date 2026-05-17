# ⚙️ Documentation : API Agents & Assistant IA (`routes.py`)

## 📍 Rôle du fichier
Le fichier `routes.py` du module `agents` gère l'interaction entre l'application et les collaborateurs (agents). 

Ce module est particulièrement riche car il s'occupe de deux aspects très distincts :
1. **L'Assistant IA (Gemini) :** Gestion du chat en temps réel (Streaming), de l'historique des conversations, et de la mémoire de l'IA.
2. **Le SIRH (Système d'Information RH) :** Gestion CRUD (Création, Lecture, Modification, Suppression) des agents, de leur appartenance à l'arbre de la structure (Projet/Opération), et de leurs statuts (Confirmé, Sanction, Prime Langue).

---

## 🧠 Principes & Logique de conception

### 1. Le Streaming pour l'Assistant IA (Server-Sent Events)
Contrairement aux autres endpoints de l'application qui répondent d'un coup avec un gros fichier JSON (`return jsonify(...)`), l'endpoint `/api/agents/chat` utilise un générateur `yield` et renvoie une réponse de type `mimetype='text/event-stream'`.
Cela permet au frontend (React) de faire **"taper" l'intelligence artificielle en temps réel**, mot par mot, exactement comme sur ChatGPT. 

### 2. Le Filet de Sécurité Mémoire de l'IA
Pour éviter que l'IA ne déraille ("hallucine") ou ne coûte trop cher en jetons d'API (Tokens), il y a un garde-fou strict : `MAX_MESSAGES_PER_CONV = 40`.
Si la conversation dépasse 40 messages, le backend verrouille automatiquement le chat (`lock_conversation`) et prévient l'utilisateur de démarrer un nouveau fil de discussion.

### 3. La Double-Couche de Filtrage des Agents
Quand on affiche la grille des agents pour une Règle de Prime précise (`GET /api/regles/<id>/agents`), le code fait une jointure SQL complexe :
- Il récupère l'ID Structure de la règle de prime.
- Il filtre les agents pour ne remonter **que ceux qui travaillent** sur ce projet / cette opération spécifique.
- Il effectue des `LEFT JOIN` avec les données manuelles (`matrice_primes_agents_gestion`) pour savoir si le gestionnaire de paie a coché "Sanction" pour cet agent ce mois-ci, ce qui viendra annuler sa prime.

---

## 📂 Les 3 Grands Blocs d'Endpoints

### 1. L'Assistant IA
- **`POST /api/agents/chat`** : L'endpoint de streaming texte. Accepte le message de l'utilisateur, l'envoie à Gemini, et renvoie la réponse.
- **`GET /api/regles/<id>/conversations`** : Historique des fils de discussions.
- **`GET /api/conversations/<id>/messages`** : Contenu d'une discussion.
- **`DELETE /api/conversations/<id>/messages/<id>/truncate`** : Permet de "revenir dans le temps" en supprimant la fin d'une conversation (utile si l'utilisateur modifie une ancienne question).

### 2. Gestion de la Paie / Grille des Agents
- **`GET /api/regles/<id>/agents`** : Récupère les agents éligibles à une règle de prime, enrichis de leurs statuts de paie.
- **`POST /api/regles/<id>/agents/<matricule>/data`** : Sauvegarde un override manuel (ex: le RH clique sur "Sanction" dans la grille pour supprimer la prime).

### 3. SIRH Global (CRUD)
- **`GET /api/agents/gestion`** : Liste brute de tous les agents de l'entreprise.
- **`POST /api/agents`** : Ajoute un nouvel employé.
- **`PUT /api/agents/<matricule>`** : Met à jour un employé (changement de projet, de nom...).
- **`POST /api/agents/<matricule>/statut`** : Raccourci pour changer rapidement le statut global (ex: Validé, Période d'essai).
- **`DELETE /api/agents/<matricule>`** : Supprime l'employé.

---

## 🛠️ Comment ajouter une action IA ?

Si demain vous voulez ajouter un bouton "Générer un résumé" qui demande à l'IA de synthétiser la conversation sans passer par le chat texte :

1. Dans `modules/agents/services/gemini_agent_provider.py`, créez la fonction métier :
```python
def generate_conversation_summary(conversation_id):
    # Logique d'appel API Gemini pour résumer
    return "Résumé : L'utilisateur a demandé comment..."
```

2. Exposez-la dans `routes.py` :
```python
@agents_bp.route("/api/conversations/<int:conv_id>/summary", methods=["GET"])
def endpoint_conversation_summary(conv_id):
    try:
        from modules.agents.services.gemini_agent_provider import generate_conversation_summary
        summary = generate_conversation_summary(conv_id)
        return jsonify({"data": summary}), 200
    except Exception as e:
        logger.error("Erreur résumé conversation %s : %s", conv_id, e)
        return jsonify({"error": str(e)}), 500
```
