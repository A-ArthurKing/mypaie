# ⚙️ Documentation : API Notes Qualité (`routes.py`)

## 📍 Rôle du fichier
Le fichier `routes.py` du module `notes_qualite` expose **tous les endpoints REST (HTTP)** nécessaires pour consulter les évaluations qualité des agents.

Ce fichier ne gère aucune logique de requête base de données (BigQuery ou MySQL). Son rôle est d'agir comme un aiguilleur "Domain-First" :
1. Réceptionner les requêtes HTTP du frontend (tableaux de bord qualité, moteur de calcul des primes).
2. Valider et convertir les paramètres (dates, pagination, JSON maps).
3. Transférer la demande au service de données (`dw_api_qualite_provider`).
4. Gérer les erreurs et répondre en JSON.

---

## 🧠 Principes & Logique de conception

### 1. Robustesse des arguments (Query Strings)
Le fichier utilise extensivement `request.args.get()`. Des `try/except` convertissent les valeurs critiques (comme `limit` et `offset`) en entiers, et renvoient proprement un code `400 Bad Request` si le développeur frontend envoie des lettres au lieu de chiffres.

### 2. Le "Fallback" par Nom d'Agent
Il y a une mécanique très intéressante dans `/api/qualite/totaux`. 
Souvent, dans les systèmes d'évaluation qualité tiers, le matricule RH officiel de l'agent est manquant (NULL dans BigQuery).
L'API permet au frontend d'envoyer un objet JSON `agents_map` : `{"DUPONT JEAN": "12345"}`. Si l'API reçoit ça, elle pourra reconstituer la note qualité de "12345" même si le matricule n'existe pas en base, simplement en se basant sur la correspondance du nom.

---

## 📂 Les 4 Endpoints Exposés

### 1. La Grille des Agents (`GET /api/qualite`)
- *Rôle :* Récupère la liste détaillée des évaluations individuelles (avec pagination).
- *Usage UI :* Affiche le tableau principal de la page "Notes Qualité".
- *Filtres acceptés :* dates, recherche nom d'agent, filtrage par projet.

### 2. Le Totaux pour la Paie (`GET /api/qualite/totaux`)
- *Rôle :* C'est l'endpoint utilisé par le Résolveur Unifié (le Moteur de Calcul des Primes).
- *Comportement :* Prend une liste de matricules en CSV (`1234,5678`) et renvoie pour chacun **la moyenne de sa note qualité** sur la période donnée.
- *Format :* `{ "data": { "1234": 85.5, "5678": 90.0 } }`

### 3. Les Statistiques par Projet (`GET /api/qualite/projets`)
- *Rôle :* Renvoie les scores de qualité agrégés par campagne/projet.
- *Usage UI :* Permet d'afficher des graphiques ou des KPIs de niveau "Manager/Projet" (ex: "Le projet PVCP est à 88% de qualité moyenne").

### 4. Les Statistiques Globales (`GET /api/qualite/stats/global`)
- *Rôle :* Récupère la répartition globale des scores par *Typologie* ou *Sous-typologie* d'erreur (si la grille de qualité est découpée par rubriques "Sourire", "Résolution", "Conformité", etc.).

---

## 🛠️ Comment ajouter une nouvelle route Qualité ?

Imaginons que les superviseurs souhaitent voir les 5 agents ayant eu les moins bonnes notes ce mois-ci.

1. Développez la fonction `get_top_5_worst_agents(debut, fin)` dans le fichier `dw_api_qualite_provider.py`.
2. Importez cette fonction en haut de `routes.py`.
3. Ajoutez cet endpoint :

```python
@notes_qualite_bp.route("/api/qualite/flops", methods=["GET"])
def endpoint_qualite_flops():
    # 1. Lire les arguments
    date_debut = request.args.get("date_debut")
    date_fin   = request.args.get("date_fin")

    try:
        # 2. Appeler le service
        from modules.notes_qualite.services.dw_api_qualite_provider import get_top_5_worst_agents
        flops = get_top_5_worst_agents(date_debut, date_fin)
        
        # 3. Retourner le JSON
        return jsonify({"data": flops}), 200
        
    except Exception as err:
        # 4. Logger l'erreur et sécuriser le retour
        logger.error("Erreur endpoint /api/qualite/flops : %s", err)
        return jsonify({"error": "Impossible de charger le classement des agents."}), 500
```
