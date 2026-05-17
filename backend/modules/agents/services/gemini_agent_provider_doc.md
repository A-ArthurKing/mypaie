# ⚙️ Documentation : Service IA Gemini (`gemini_agent_provider.py`)

## 📍 Rôle du fichier
Le fichier `gemini_agent_provider.py` est le cerveau conversationnel de l'application. 
C'est ici qu'on configure l'API de Google Gemini (le LLM) pour le transformer en un "Assistant myPaie".

Le fichier définit le **Prompt Système** (les instructions et limites de l'IA) et lui fournit des "Outils" (*Function Calling* ou *Tools*) qui permettent à Gemini d'exécuter du code Python et d'interagir avec la base de données.

---

## 🧠 Principes & Logique de conception

### 1. Le Prompt Système Extrême
Le `SYSTEM_PROMPT` est massif. C'est normal : on demande à une IA générative (par nature imprévisible) de manipuler des données de paie et de générer des JSON de configuration complexes.
Le prompt lui interdit formellement de supprimer des données, lui donne des règles de conversion sémantique ("CA" = `chiffre_affaire`), et lui explique très exactement le format JSON attendu pour une grille de prime.

### 2. L'intégration des Outils (Function Calling)
Les fonctions Python annotées de docstrings très claires (comme `get_active_grille_json_tool()`) sont transmises au modèle dans la variable `tools=[...]`. 
Gemini lit ces docstrings. S'il estime avoir besoin d'informations (par exemple, la grille actuelle), il "pause" sa génération de texte, demande au backend d'exécuter `get_active_grille_json_tool()`, ingère le résultat JSON, puis reprend sa génération.

### 3. Le Streaming Generator (`yield`)
La fonction `process_chat_message_stream` utilise le mot-clé Python `yield`. Au lieu d'attendre que Gemini ait fini ses 250 mots (ce qui prendrait 5 secondes et ferait croire à l'utilisateur que l'app a planté), elle renvoie chaque mot (`chunk.text`) à la volée vers le frontend.

---

## 📂 Outils (Tools) Exposés à l'IA

1. **`get_regle_info_tool(regle_id)`** : Permet à l'IA de lire la fiche descriptive de la règle de prime.
2. **`list_available_kpis_tool()`** : Fournit à l'IA la liste des indicateurs (KPIs) qu'elle a le droit d'utiliser.
3. **`get_active_grille_json_tool(regle_id)`** : Avant de modifier une prime, l'IA utilise ça pour lire la configuration JSON existante.
4. **`prepare_grille_proposal_tool(...)`** : C'est l'outil "d'Action". L'IA s'en sert pour générer une proposition de nouvelle grille au format Markdown, que le frontend transformera en bouton cliquable.
5. **`get_real_performance_tool(regle_id, mois)`** : (Très puissant) Permet à l'IA d'interroger BigQuery pour connaître les vraies statistiques des employés le mois dernier, afin de proposer des objectifs *réalistes*.
6. **`save_context_note_tool()` / `get_context_notes_tool()`** : La mémoire de l'IA (lire/écrire des petites notes pour se souvenir d'un détail d'une conversation à l'autre).

---

## 🛠️ Comment ajouter un nouvel Outil à l'IA ?

Demain, vous voulez que l'IA puisse dire à un manager s'il y a des agents en "Sanction".

1. Créez la fonction Python (les `Types Hints` `-> str` et la docstring sont obligatoires, c'est ce que lit Gemini !) :
```python
def check_sanctions_tool(regle_id: int) -> str:
    """
    Retourne la liste des agents qui sont actuellement sanctionnés pour cette règle.
    Utilise cet outil si l'utilisateur demande si des agents ont des malus disciplinaires.
    """
    # ... Logique SQL ...
    return "2 agents sanctionnés: DUPONT Jean, MARTIN Alice."
```

2. Ajoutez l'outil dans la configuration Gemini dans la fonction `process_chat_message_stream` :
```python
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.2,
                tools=[
                    get_regle_info_tool, 
                    # ... autres outils ...
                    check_sanctions_tool # <== Ajouté ici
                ]
            )
```
Désormais, si l'utilisateur écrit *"Dis-moi si des gens ont des sanctions ?"*, l'IA appellera magiquement votre fonction et lui répondra avec les bons noms.
