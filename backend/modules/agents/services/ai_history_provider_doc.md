# ⚙️ Documentation : Service Historique IA (`ai_history_provider.py`)

## 📍 Rôle du fichier
Le fichier `ai_history_provider.py` gère la **persistance et l'historique du Chatbot IA** (Gemini).

Contrairement à ChatGPT où l'historique est stocké sur les serveurs d'OpenAI, ici MyPaie sauvegarde localement dans sa base de données MySQL toutes les conversations, les messages et le statut (verrouillé/ouvert) de chaque fil de discussion. Cela permet à l'utilisateur de fermer son navigateur et de reprendre sa conversation avec l'IA le lendemain.

---

## 🧠 Principes & Logique de conception

### 1. La limite de mémoire ("Locking")
Pour s'assurer que le modèle Gemini garde toute sa "tête" et ne perde pas le contexte (ce qu'on appelle la *Context Window*), le backend impose une limite stricte (40 messages). 
Ce provider contient donc la fonction `lock_conversation()`. Quand une conversation est verrouillée, l'utilisateur ne peut plus envoyer de message, ce qui le force à démarrer un nouveau fil de discussion tout neuf.

### 2. Le "Time Travel" (Truncate)
Quand un utilisateur modifie une de ses anciennes questions dans le chat, il ne faut pas envoyer l'ancienne version + la nouvelle. L'application utilise `truncate_conversation()` pour effacer "le futur" de la conversation à partir de ce point, la déverrouiller si elle l'était, et permettre à l'IA de repartir sur de nouvelles bases.

### 3. Génération dynamique de titre
Dans `add_message()`, le code vérifie s'il s'agit du tout premier message de l'utilisateur dans cette conversation. Si c'est le cas, il prend automatiquement les 37 premiers caractères de son message et s'en sert pour générer le `titre` de la conversation affiché dans le panneau latéral.

---

## 📂 Fonctions Exposées

1. **`create_conversation(regle_id, titre)`** : Crée un nouveau fil de discussion (lié à une règle de prime spécifique).
2. **`get_conversations(regle_id)`** : Liste tous les fils d'une règle (pour le panneau latéral).
3. **`get_messages(conversation_id)`** : Récupère l'historique exact (pour remplir la fenêtre de chat au chargement).
4. **`add_message(conversation_id, sender, text)`** : Insère un message (`sender = 'user' | 'bot'`).
5. **`lock_conversation(conversation_id)`** : Bloque définitivement le fil.
6. **`truncate_conversation(conversation_id, from_message_id)`** : Efface une partie de l'historique et débloque le fil.
