# ⚙️ Documentation : Service Heures Agents (`dw_api_heures_provider.py`)

## 📍 Rôle du fichier
Le fichier `dw_api_heures_provider.py` est le service métier qui interroge et formate les données de temps de travail des agents.

**Point architectural majeur :** Malgré son nom historique (`dw_api_`), ce fichier n'utilise plus BigQuery (le Data Warehouse). Pour des raisons de performances, il tape désormais **directement dans la base de données de production MySQL** (la base `gestionpaie`, table `heures_corrigees`).

---

## 🧠 Principes & Logique de conception

### 1. Filtrage strict par défaut
Toutes les requêtes SQL de ce fichier intègrent automatiquement deux filtres vitaux :
1. `deleted_at IS NULL` : C'est le principe du "Soft Delete". On ne supprime jamais vraiment une ligne en base (pour garder un historique en cas de litige de paie), on remplit juste la date de suppression. Le code l'ignore donc silencieusement.
2. Le filtre "Projets Hardcodé" : `(LOWER(projet) LIKE '%pvcp%' OR ...)` pour se limiter aux projets pris en charge par l'application MyPaie.

### 2. Typage MySQL vs Python vs JSON
Les heures de travail posent toujours un problème en informatique. 
Dans MySQL, les heures sont stockées en format `TIME` ou `VARCHAR` (ex: `"07:30:00"`). 
Cependant, pour que le frontend (JavaScript) ou le moteur de calcul Python puisse faire des additions ou des multiplications (ex: `Heure * Taux Horaire`), il faut des nombres entiers.
C'est pourquoi ce fichier contient deux Helpers fondamentaux :
- **La conversion SQL :** Utilisation de `SEC_TO_TIME(SUM(TIME_TO_SEC(heure_hp)))` pour additionner les heures correctement côté base de données avant de les ramener au script.
- **La conversion Python (`_time_str_to_ms`) :** Convertit systématiquement tous les "HH:MM:SS" (ex: "01:00:00") en millisecondes entières (ex: `3600000`) avant d'envoyer le JSON.

### 3. La mise en cache (Dropdowns)
Les fonctions qui listent les "Équipes" ou les "Projets" distincts pour remplir les menus déroulants du frontend font une requête SQL `SELECT DISTINCT`. Comme ces listes ne changent pas toutes les 2 minutes, le résultat est gardé en cache pendant 30 minutes (`_CACHE_TTL_DROPDOWNS = 1800`) pour ne pas surcharger la base.

---

## 📂 Fonctions Exposées

1. **`get_heures_agents(...) -> dict`**
   - *Rôle :* Récupère la grille détaillée des horaires des agents jour par jour, avec les colonnes spécifiques (Heure Production, Heure Travaillée, Heure Formation, etc.). Utilisé par le tableau frontend.

2. **`get_equipes_distinctes() -> list`** & **`get_projets_distincts() -> list`**
   - *Rôle :* Retourne des listes simples `["Équipe A", "Équipe B"]` pour les filtres. 

3. **`get_totaux_par_matricule(date_debut, date_fin, matricules) -> dict`**
   - *Rôle :* Agrége le temps de travail sur la période pour une liste d'agents donnés.
   - *Sortie :* `{ "12345": { "hp": 12500000, "ht": 14000000, "total": 14000000 } }` (Valeurs en millisecondes).

---

## 🛠️ Comment ajouter un nouveau type d'heure ?

Imaginons que la RH ajoute un nouveau concept : Les **Heures de Délégation** (Syndicat), dans une colonne `heure_hd`.

1. **Mettre à jour les colonnes exposées :**
```python
COLONNES_EXPOSEES = [
    # ...
    "heure_hc",
    "heure_hf",
    "heure_hd", # <== Ajouté ici
    "heure_total",
]
```

2. **Mettre à jour l'agrégation SQL dans `get_totaux_par_matricule` :**
```sql
        f"  SEC_TO_TIME(SUM(TIME_TO_SEC(heure_hc))) AS total_hc, "
        f"  SEC_TO_TIME(SUM(TIME_TO_SEC(heure_hd))) AS total_hd, " # <== Ajouté ici
```

3. **Mettre à jour le retour Python de la même fonction :**
```python
            result[mat] = {
                "hp":    _time_str_to_ms(row["total_hp"]),
                "ht":    _time_str_to_ms(row["total_ht"]),
                "hf":    _time_str_to_ms(row["total_hf"]),
                "hc":    _time_str_to_ms(row["total_hc"]),
                "hd":    _time_str_to_ms(row["total_hd"]), # <== Ajouté ici
                "total": _time_str_to_ms(row["total_heure"]),
            }
```

4. **L'indiquer au convertisseur automatique :**
```python
_COLONNES_TIME = frozenset({
    "heure_ht", "heure_hp", "heure_hc", "heure_hf", "heure_hd", # <== Ajouté ici
    "heure_total", "heure_ecart",
})
```
Le reste du code (et le Frontend) recevra automatiquement ces nouvelles heures formatées en millisecondes !
