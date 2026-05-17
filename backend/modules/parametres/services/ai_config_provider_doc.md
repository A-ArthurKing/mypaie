# ⚙️ Documentation : Service IA & Configuration (`ai_config_provider.py`)

## 📍 Rôle du fichier
Le fichier `ai_config_provider.py` est un **Service métier (Provider)** spécialisé dans l'enrichissement des données via l'Intelligence Artificielle.
Il est principalement utilisé par le domaine **Paramètres** pour traduire automatiquement des noms de colonnes brutes de bases de données (ex: `in_hold_min_nbr`) en libellés compréhensibles par les humains (ex: "Temps de mise en attente (Hold)").

Il s'appuie sur deux mécanismes :
1. **Un modèle IA (Gemini 1.5 Flash)** pour la compréhension sémantique.
2. **Un système de "Fallback" (règles dures)** pour garantir une réponse même si l'IA est indisponible ou hors contexte.

---

## 🧠 Principes & Logique de conception

### 1. Robustesse absolue (Le Fallback)
L'IA peut échouer (quota dépassé, clé API manquante, erreur réseau, hallucination JSON). Ce fichier est conçu pour **ne jamais crasher**.
- Le dictionnaire `_KNOWN_PATTERNS` contient les règles métier absolues des centres d'appels.
- La fonction `_fallback_label()` parcourt ce dictionnaire. Si l'IA échoue, l'application utilise automatiquement ces règles dures.
- L'ordre de `_KNOWN_PATTERNS` est crucial : les mots-clés les plus longs ou spécifiques (ex: `in_hold_min`) doivent toujours être placés **avant** les mots-clés génériques (ex: `_min`).

### 2. Prompt Engineering strict
Le prompt envoyé à Gemini contient le "Contexte Domaine Obligatoire". 
C'est indispensable car les IA génératives confondent souvent les termes de Call Center (ex: l'IA confond souvent le "Hold Time" avec "l'ACW/Wrap-up"). Le prompt force l'IA à respecter le dictionnaire interne.
La température est réglée très bas (`0.2`) pour forcer une réponse déterministe et peu créative, garantissant un format JSON strict.

### 3. Parsing JSON tolérant aux fautes
Les LLM ont tendance à encadrer le JSON avec du markdown (````json ... ````). 
La fonction `_parse_json_from_text()` nettoie la réponse avec des expressions régulières (RegEx) pour être certaine d'isoler l'objet JSON contenant `libelle` et `description`.

---

## 📂 Fonctions Exposées

1. **`suggest_kpi_label(tech_code: str, univers: str) -> dict`**
   - *Rôle :* C'est la fonction publique principale.
   - *Entrée :* Un code brut (ex: `call_worked_time_nbr`) et son univers (ex: `PERF`).
   - *Sortie :* `{ "libelle": "Temps travaillé agent", "description": "Temps total..." }`

2. **`_fallback_label(tech_code: str) -> dict`** *(privé)*
   - *Rôle :* Le filet de sécurité regex/pattern matching.

3. **`_parse_json_from_text(text: str) -> dict | None`** *(privé)*
   - *Rôle :* Extracteur et nettoyeur de JSON.

---

## 🛠️ Comment ajouter un nouveau Pattern métier ?

Si vous remarquez que l'IA ou le fallback a du mal à traduire correctement un terme récurrent propre à l'entreprise (ex: un sigle obscur comme "QoS"), n'essayez pas de modifier le code de l'IA, **ajoutez-le au dictionnaire de fallback** et au **prompt**.

### Étape 1 : Mettre à jour `_KNOWN_PATTERNS`
Ouvrez le fichier et repérez la liste `_KNOWN_PATTERNS`. Ajoutez votre pattern **en haut de sa catégorie** (pour qu'il soit détecté avant les suffixes génériques).

```python
_KNOWN_PATTERNS = [
    # --- Qualité ---
    ("qos",          "Qualité de Service (QoS)", 
     "Indicateur global de la qualité du service rendu au client."),
    # ... suite du code
]
```

### Étape 2 : Mettre à jour le Prompt Gemini
Allez dans la fonction `suggest_kpi_label()` et trouvez la section `CONTEXTE DOMAINE OBLIGATOIRE`. Ajoutez votre règle pour "éduquer" l'IA :

```python
CONTEXTE DOMAINE OBLIGATOIRE — respecte ces définitions sans exception :
- in_call_min_nbr       → "Durée de conversation (Talk Time)"
- qos                   → "Qualité de Service (QoS)" # <== Ajouté ici
```

Avec ces deux ajouts, l'IA et le filet de sécurité traiteront désormais ce terme technique de manière standardisée et fiable.
