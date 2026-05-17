# ⚙️ Documentation : Moteur de Calcul (`calculation_engine.py`)

## 📍 Rôle du fichier
Le fichier `calculation_engine.py` est le cœur mathématique et financier de l'application. C'est le **Moteur de Primes**.

Son but est de prendre :
1. Une règle de prime et sa grille d'objectifs (JSON avec les paliers, pourcentages, etc.).
2. Une liste de collaborateurs (matricules).
3. Les données réelles de ces collaborateurs sur une période (ventes, heures, qualité).

Et de **croiser** ces informations pour calculer le **Score d'atteinte** et la **Prime Finale** (en monnaie) pour chaque collaborateur.

---

## 🧠 Principes & Logique de conception

### 1. La force du Découplage (Le Cerveau Unifié)
Remarquez que le Moteur de calcul ne sait **absolument pas** d'où viennent les données (BigQuery, MySQL, API Externe). 
Il s'en fiche. Il fait appel à la fonction `get_unified_agent_data` (le Résolveur Unifié qu'on a documenté précédemment) qui lui retourne un dictionnaire très propre contenant toutes les valeurs `{"NB_VENTES": 42, "NOTE_QUALITE": 95, ...}`.

### 2. Agnosticisme des KPIs (Natifs vs Virtuels)
La grille d'objectifs définit des indicateurs cibles via la clé `metric_key`. Le moteur prend cette clé et demande simplement `agent_kpis.get(metric_key)`. Il ne cherche pas à savoir si ce KPI a été extrait de la téléphonie (Natif) ou calculé par une formule complexe dans l'interface (Virtuel).

### 3. Structure du Résultat
Pour chaque agent, le moteur renvoie non seulement la `prime_finale` mais aussi un objet `objectifs_detail`.
Ceci est extrêmement important pour la **transparence de la paie**. Le frontend a besoin de ce détail pour afficher à l'agent *exactement pourquoi* il a touché cette prime (ex: "Tu as eu 10€ parce que tu as fait 42 ventes, et 5€ parce que ta qualité était à 95%").

---

## 📂 Fonctions Exposées

1. **`run_payout_calculation(regle, matricules, date_debut, date_fin) -> Dict`**
   - *Rôle :* Boucle sur tous les matricules, récupère leurs données via le Résolveur Unifié, compare ces données à la grille d'objectifs de la règle, et stocke le score et la prime dans le dictionnaire de résultat final.

---

## 🛠️ Comment développer ce Moteur de Calcul ?

Actuellement, ce fichier contient un squelette *(TODO)* pour la logique de Scoring. Voici comment vous devrez l'implémenter lorsqu'il faudra croiser la donnée avec les paliers d'objectifs (Targets) :

```python
        # Simulation d'implémentation future (Étape 2 de l'évaluation)
        total_points = 0.0
        
        for obj in objectifs:
            metric_key = obj.get("metric_key")
            val_reelle = agent_kpis.get(metric_key)
            cible = obj.get("cible") # ex: 100 ventes
            poids = obj.get("poids") # ex: ça compte pour 50% de la prime
            
            points = 0.0
            if val_reelle is not None and cible is not None:
                # Calcul de l'atteinte (Taux de réalisation)
                taux_atteinte = val_reelle / cible 
                
                # S'il a fait 120 ventes sur un objectif de 100, il a 120% d'atteinte
                # S'il y a un plafond, on le gère ici (ex: max 150%)
                points = min(taux_atteinte * poids, obj.get("poids_max", poids))
            
            total_points += points
            agent_result["objectifs_detail"].append({
                "libelle": obj.get("nom"),
                "valeur": val_reelle,
                "taux_atteinte": taux_atteinte,
                "points_gagnes": points
            })

        # Calcul financier final
        # Ex: S'il a 85 points sur 100, il touche 85% de l'enveloppe max
        enveloppe_max = regle.get("montant_max", 0.0)
        agent_result["score_global"] = total_points
        agent_result["prime_finale"] = (total_points / 100.0) * enveloppe_max
```
