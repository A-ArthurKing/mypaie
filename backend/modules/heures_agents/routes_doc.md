# ⚙️ Documentation : API Heures Agents (`routes.py`)

## 📍 Rôle du fichier
Le fichier `routes.py` du module `heures_agents` expose **les endpoints REST (HTTP)** nécessaires pour la consultation du temps de travail des employés (via la pointeuse ou le SIRH).

Il fonctionne comme les autres "Blueprint" Flask de l'architecture Domain-First : il agit en "aiguilleur". Il réceptionne la demande (GET), vérifie que le frontend n'a pas envoyé de bêtises (comme du texte à la place d'un chiffre pour la pagination), et délègue l'exécution à `dw_api_heures_provider.py`.

---

## 🧠 Principes & Logique de conception

### 1. Robustesse sur la pagination
L'endpoint principal `/api/heures` impose une limite ferme : `min(int(limit), 1000)`. Même si un développeur frontend ou un utilisateur malveillant essaie de demander 1 million de lignes d'un coup (ce qui ferait exploser la mémoire du backend ou les coûts de requêtage de BigQuery), l'API bride automatiquement la requête à 1000 lignes maximum.

### 2. Endpoints "Dictionnaire" (Listes déroulantes)
Ce module propose deux petits endpoints `/api/heures/equipes` et `/api/heures/projets`.
Plutôt que de figer ("hardcoder") les noms des équipes dans le frontend, l'application est dynamique : le frontend appelle ces routes pour savoir quelles équipes existent *réellement* dans la base de données, puis il remplit ses listes déroulantes de filtres.

---

## 📂 Les 4 Endpoints Exposés

### 1. La Grille des Heures (`GET /api/heures`)
- *Rôle :* Récupère le détail journalier des heures de chaque agent (avec pagination).
- *Filtres acceptés :* dates, matricule, équipe, projet.

### 2. Liste des Équipes (`GET /api/heures/equipes`)
- *Rôle :* Retourne un tableau simple des noms d'équipes uniques. Utilisé pour les filtres de recherche.

### 3. Liste des Projets (`GET /api/heures/projets`)
- *Rôle :* Retourne un tableau simple des noms de projets uniques. Utilisé pour les filtres de recherche.

### 4. Le Résolveur pour la Paie (`GET /api/heures/totaux`)
- *Rôle :* Point d'accès **critique** utilisé par le "Cerveau Unifié" (Moteur de Primes).
- *Comportement :* Prend une liste de matricules CSV (`?matricules=10773,11056`) et une période.
- *Format :* Il renvoie un objet très structuré contenant tous les types d'heures (HP = Heures de Production, HT = Heures Travaillées, HF = Heures de Formation, HC = Heures de Coaching).
  ```json
  {
    "data": {
      "10773": {
        "hp": 1250000, 
        "ht": 1400000,
        "total": 1400000
      }
    }
  }
  ```
  *(Note : Ces valeurs brutes remontées de BigQuery sont souvent en millisecondes. C'est le Resolveur Unifié de Primes qui se chargera plus tard de les diviser par 3.600.000 pour en faire des heures décimales).*

---

## 🛠️ Comment ajouter une nouvelle route Heures ?

Si vous devez créer un "Total global des heures par Projet" pour afficher un graphique camembert :

1. Développez la fonction `get_heures_stats_projets(debut, fin)` dans le service `dw_api_heures_provider.py`.
2. Importez cette fonction ici.
3. Ajoutez l'endpoint :

```python
@heures_agents_bp.route("/api/heures/stats/projets", methods=["GET"])
def endpoint_heures_stats_projets():
    date_debut = request.args.get("date_debut")
    date_fin   = request.args.get("date_fin")

    try:
        from modules.heures_agents.services.dw_api_heures_provider import get_heures_stats_projets
        stats = get_heures_stats_projets(date_debut, date_fin)
        return jsonify({"data": stats}), 200
        
    except Exception as err:
        logger.error("Erreur endpoint /api/heures/stats/projets : %s", err)
        return jsonify({"error": "Impossible de charger les statistiques par projet."}), 500
```
