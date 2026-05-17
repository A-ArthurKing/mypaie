# ⚙️ Documentation : Résolveur Unifié de KPIs (`kpi_unified_resolver.py`)

## 📍 Rôle du fichier
Le fichier `kpi_unified_resolver.py` agit comme le **"Cerveau" d'agrégation** de l'application. 
C'est la pièce maîtresse qui fait le pont entre tous les différents modules (Performance, Qualité, Heures) et le Moteur de Primes. 

Avant de pouvoir calculer la prime d'un agent (ex: s'il a eu plus de 15 ventes ET une note qualité > 80%), le moteur a besoin de réunir toutes ces métriques disparates dans un seul et même dictionnaire. C'est exactement le travail du `kpi_unified_resolver`.

---

## 🧠 Principes & Logique de conception

### 1. Agrégation Multimodulaire
Ce fichier importe les "Providers" de tous les autres modules :
- `get_perf_totaux_par_matricule` (module *Performance*)
- `get_qualite_totaux_par_matricule` (module *Qualité*)
- `get_heures_totaux` (module *Heures Agents*)

Il interroge ces 3 bases de données/tables séparées pour la même période et la même liste d'agents, puis fusionne les résultats.

### 2. Standardisation des variables globales
Pour que le moteur de calcul (et les utilisateurs qui tapent des formules dans le frontend) puisse s'y retrouver, le resolveur garantit l'existence de certaines variables "Standard" dans le contexte (`ctx`).
Par exemple, pour les Heures qui sont stockées en millisecondes dans la base de données, le resolveur les divise immédiatement par `3.600.000` pour fournir un nombre d'heures décimal clair (`HEURE_HP`, `HEURE_TOTAL`), prêt à être multiplié par un taux horaire.

### 3. Calcul Transversal (KPIs Virtuels)
C'est la puissance de ce fichier : comme il réunit la Performance, la Qualité et les Heures dans un seul contexte, il peut résoudre des **KPIs Virtuels Transversaux**.
Par exemple, si un utilisateur crée une formule `(NB_VENTES / HEURE_TOTAL)`, le resolveur sera capable de la calculer correctement car il a sous la main les ventes (venues du module Performance) et les heures (venues du module Heures).

---

## 📂 Fonction Exposée

**`get_unified_agent_data(date_debut, date_fin, matricules, nom_matricule_map) -> Dict`**

- *Entrées :* Période d'évaluation et liste des matricules agents.
- *Traitement :* 
  1. Récupère les données des 3 silos.
  2. Parcourt chaque agent et crée un contexte global (`ctx`).
  3. Formate les heures et la qualité.
  4. Récupère le dictionnaire des KPIs depuis MySQL.
  5. Évalue dynamiquement toutes les formules virtuelles en utilisant ce super-contexte.
- *Sortie :* Un dictionnaire structuré prêt à être avalé par le moteur de primes.
  ```json
  {
    "12345": {
      "NB_VENTES": 42,
      "DMT": 350.2,
      "NOTE_QUALITE": 85.5,
      "HEURE_TOTAL": 140.5,
      "MA_FORMULE_VIRTUELLE": 0.29
    }
  }
  ```

---

## 🛠️ Comment ajouter une nouvelle source de données ?

Imaginons que demain l'entreprise se connecte à un nouvel outil RH pour remonter les "Retards" (Tardiness) et qu'on souhaite que ce soit utilisable pour calculer les primes.

1. **Créer le module et le service :** Créez `modules/rh/services/retard_provider.py` avec une fonction `get_retards_totaux(debut, fin, matricules)`.
2. **L'importer ici :** En haut de ce fichier, ajoutez `from modules.rh.services.retard_provider import get_retards_totaux`.
3. **Mettre à jour l'agrégation :**
```python
    # 1. Récupération
    perf_data   = get_perf_totaux_par_matricule(...)
    heures_map  = get_heures_totaux(...)
    retards_map = get_retards_totaux(date_debut, date_fin, matricules) # <== Ajouté ici

    # [...]
    
    for mat in matricules:
        # [...]
        # Ajout des Retards (Standard: NB_RETARDS)
        ctx["NB_RETARDS"] = retards_map.get(mat_str, 0)
```
Désormais, `NB_RETARDS` existera pour le moteur de calcul de primes et pourra être utilisé dans une formule !
