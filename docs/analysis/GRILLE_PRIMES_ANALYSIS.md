# 📊 Analyse Technico-Métier : Digitalisation des Grilles de Primes

> **Document de référence complet** — À lire en début de toute nouvelle conversation pour rétablir le contexte intégral du projet `mypaie`.

---

## 🖥️ 0. Infrastructure Technique (Stack & Docker)

### Stack
- **Backend :** Python / Flask, port interne Docker `5001`, mappé host `5002`. Entry point : `backend/run.py`.
- **Frontend :** React 18 + Vite, port `5569`. Proxy Vite : `/api` → `http://backend:5001` (DNS Docker interne, **pas localhost**).
- **Base de données :** MySQL 8, Docker `mypaie_mysql`, host port `3308`, DB `mypaie_config`, user `mypaie`, password `Mypaie2026!`.
- **Réseau Docker :** `mypaie_network`. Compose à la racine `docker-compose.yml`.

### Fichiers d'environnement
| Fichier | Usage | FLASK_PORT |
|---|---|---|
| `backend/.env` | Développement local uniquement | `5003` |
| `backend/.env.docker` | Utilisé par le conteneur Docker | `5001` |

### Commandes Docker utiles
```bash
docker ps | findstr mypaie           # Vérifier les conteneurs actifs
docker restart mypaie_backend        # Redémarrer le backend (ex: crash Python)
docker restart mypaie_frontend       # Recharger Vite (ex: modif vite.config.js)
docker logs mypaie_backend --tail 50 # Voir les erreurs Flask
```

### Volume mounts (hot reload)
- `./backend:/app` → modifications Python immédiatement prises en compte MAIS crash = restart requis
- `./frontend:/app` → hot reload Vite automatique

---

## 📁 1. Structure du Projet (Fichiers clés)

```
mypaie/
├── docker-compose.yml
├── backend/
│   ├── run.py                           ← Entry point Flask
│   ├── .env                             ← Local dev (FLASK_PORT=5003)
│   ├── .env.docker                      ← Docker (FLASK_PORT=5001)
│   ├── config/
│   │   ├── db_mysql_connector.py        ← Pool PyMySQL → mypaie_config
│   │   └── dw_api_bigquery_connector.py ← BigQuery
│   ├── routes/
│   │   ├── agents/agents_routes.py           ← /api/agents/...
│   │   ├── regles_primes/regles_primes_routes.py ← /api/regles/...
│   │   ├── heures_agents/heures_agents_routes.py
│   │   ├── notes_qualite/notes_qualite_routes.py
│   │   ├── performance/performance_routes.py
│   │   └── parametres/parametres_routes.py
│   └── services/
│       ├── agents/
│       │   ├── agents_data_provider.py  ← CRUD agents MySQL local
│       │   └── sirh_agents_provider.py  ← SIRH SQL Server (legacy)
│       ├── regles_primes/dw_api_regles_provider.py
│       ├── heures_agents/dw_api_heures_provider.py
│       ├── notes_qualite/dw_api_qualite_provider.py
│       └── performance/dw_api_performance_provider.py
└── frontend/
    ├── vite.config.js                   ← proxy target: http://backend:5001
    └── src/
        ├── Layout/AppLayout/AppLayout.jsx
        └── Pages/
            ├── GestionAgents/           ← (anciennement Agents/)
            │   ├── GestionAgents.jsx    ← (anciennement Agents.jsx)
            │   ├── GestionAgents.css
            │   ├── sections/
            │   │   ├── AgentsHeader/AgentsHeader.jsx
            │   │   ├── AgentsToolbar/AgentsToolbar.jsx  ← 5 filtres cascade
            │   │   └── AgentsTable/AgentsTable.jsx
            │   └── components/
            │       ├── AddAgentModal/AddAgentModal.jsx
            │       └── EditAgentModal/EditAgentModal.jsx
            └── ReglesPrimes/
                └── Sections/
                    └── ReglesGridSection/
                        ├── ReglesGridSection.jsx ← Cartes règles
                        └── ReglesGridSection.css
```

---

## ✅ 2. État d'Implémentation (Toutes Phases)

| Phase | Objet | Statut |
|---|---|---|
| 1 | Matrice Postes & Cibles (montants + objectifs par niveau) | ✅ Implémentée |
| 2 | Éditeur de Paliers de Scoring (seuils 70/85/100%) | ✅ Implémentée |
| 3 | Configuration Temps & Prorata (jours ouvrés, base horaire) | ✅ Implémentée |
| 4 | Assiduité & Discipline (règles de malus progressifs) | ✅ Implémentée |
| 5 | Killing Rules (annulation immédiate sur événement qualitatif) | ✅ Implémentée |
| 6 | Agents — affichage, Statut/Sanction, Montant Cible | ✅ Implémentée |
| 7 | Onglet Objectifs — saisie des résultats réels par agent par KPI | ❌ À implémenter |
| 8 | Moteur de calcul — calcul automatique Prime Finale (pipeline complète) | ❌ À implémenter |
| 9 | Primes Additionnelles — MISSION, Langue, Bonus 3/4, Super Bonus Ventes | ❌ À implémenter |
| 10 | Agent du mois — logique de départage ex-æquo | ❌ À implémenter |

### Tâches UI/UX réalisées (session actuelle)
- ✅ Correction `IndentationError` dans `agents_data_provider.py` (docstring concaténée ligne 116)
- ✅ Correction proxy Vite 502 : `http://backend:5001` (DNS Docker, pas localhost)
- ✅ 5 filtres cascade dans `AgentsToolbar` : Projet → Opération → File → Activité → Niveau
- ✅ Renommage `Fichier` → `File` (table AgentsTable, modales Add/Edit)
- ✅ Renommage dossier `Pages/Agents/` → `Pages/GestionAgents/`
- ✅ Renommage fichiers `Agents.jsx/.css` → `GestionAgents.jsx/.css`
- ✅ Refonte style cartes `ReglesPrimes` (hover lift + fond chaud, boutons d'action animés)
- ✅ Suppression barre accent orange en haut des cartes (demande utilisateur)
- ✅ Suppression shadow et border colorée au hover (demande utilisateur)

---

## 🧠 3. Dualité de l'Architecture (Variables vs Objectifs)

### A. Onglet VARIABLES (La "Loi")
Paramètres immuables pour une campagne donnée : Pondération KPIs, Règles de Présence, Killing Rules.  
**Impact :** Modifie le moteur de calcul pour **tous** les agents.

### B. Onglet OBJECTIFS (La "Donnée")
Valeurs cibles et résultats opérationnels par agent. Colonnes Excel source :
- **Productivité :** DMT | CVR Naturelle | AVG NBR — Objectif / Taux d'atteinte / Nb points
- **Qualité :** QUALITE | Tx MEA
- **Satisfaction :** Réclamation client sur Agent (killing rule individuelle)
- **Assiduité :** Heures produites | Abs injust | Retards | Abs just | Congé payé + CSS | Jours non ouvrés | Jours travaillés | **Malus (%)**
- **Résultats :** Prime hors Super Bonus | MISSION | Prime Langue | Prime Langue Finale | BONUS 3 | BONUS 4 | SUPER BONUS VENTES | **Montant Final** | Nb points Final | Agent du mois

---

## 🛠️ 4. Logique de Calcul (Reverse-Engineering Excel)

### Calcul Performance KPI
$$\text{% d'Atteinte} = \frac{\text{Résultat Réel}}{\text{Objectif Cible}} \quad \text{(inverse pour DMT)}$$

| Palier | Plage | Multiplicateur | Verrouillé |
|---|---|---|---|
| Insuffisant | 0% → 70% | ×0 | Oui (système) |
| Partiel | 70% → 85% | ×0.50 | Non |
| Correct | 85% → 100% | ×0.75 | Non |
| Atteint | > 100% | ×1.0 | Oui (système) |

### Calcul Prorata de Présence
$$\text{Prime Proratée} = \text{Prime Théorique} \times \frac{\text{Jours travaillés}}{\text{Jours ouvrés du mois}}$$

### Assiduité & Discipline (Malus progressifs)
```
Règle 1 : 1 abs injust OU 4 retards              → Malus 50%  (× 0.5)
Règle 2 : 2 abs injust OU 8 retards OU sanction  → Malus 100% (× 0)
```

### Killing Rule
```
Réclamation client Agent → Prime = 0 (immédiat, indépendant du reste)
```

### Règle Départage Agent du Mois (ex-æquo)
1. Statut le plus Haut (Sénior > Confirmé > Débutant)
2. Progression en nombre de points vs mois précédent
3. Nombre moyen de points du dernier trimestre

### Pipeline complète
```
Score KPI       = Poids KPI × Multiplicateur(palier % atteinte)
Score Total     = Σ Score KPI
Prime Hors SB   = Score Total / 100 × Montant Brut(Statut, Poste)
Jours travaillés = Jours ouvrés - Abs just - Congé - CSS - Jours non ouvrés
Prime Proratée  = Prime Hors SB × (Jours travaillés / Jours ouvrés)
Malus %         = f(abs_injust, retards, sanction)
Prime Finale    = 0 si Killing Rule, sinon Prime Proratée × (1 - Malus%)
Montant Final   = Prime Finale + MISSION + Langue Finale + BONUS 3 + BONUS 4 + Super Bonus Ventes
```

---

## 🗂️ 5. Architecture des Sections Variables (Pipeline de Calcul)

Les sections sont stockées dans le champ JSON `grille_objectifs` de `matrice_primes`.

```
┌──────────────────────────────────────────────────────────────────────┐
│  PIPELINE COMPLÈTE (ordre d'application)                             │
│                                                                      │
│  [1] Postes & Cibles                                                 │
│       → montant brut + objectifs cibles par niveau                  │
│  [2] Pondération des indicateurs                                     │
│       → poids (nb points) de chaque KPI                             │
│       → DMT (45pts) + CVR Naturelle + AVG NBR (10) + QUALITE (20)   │
│         + Tx MEA (15pts)                                             │
│  [3] Paliers de Performance                                          │
│       → Score KPI = Points × Multiplicateur(palier)                  │
│       → Prime Hors SB = f(Score Total, Postes)                       │
│  [4] Configuration Temps & Prorata                                   │
│       → Prime Proratée = Prime Hors SB × (jours_trav / jours_ouv)   │
│  [5] Assiduité & Discipline                                          │
│       → Malus 50% ou 100% selon abs_injust / retards / sanction     │
│  [6] Killing Rules                                                   │
│       → Réclamation client → Prime = 0                              │
│  [7] Primes Additionnelles ← À IMPLÉMENTER                          │
│       → MISSION + Langue Finale + BONUS 3/4 + Super Bonus Ventes    │
│  [8] Agent du Mois ← À IMPLÉMENTER                                  │
│       → Départage ex-æquo sur statut / progression / moyenne trim.  │
└──────────────────────────────────────────────────────────────────────┘
```

### Structure JSON `grille_objectifs`

```json
{
  "postes": [
    {
      "id": "poste_...", "code": "CP SE",
      "niveaux": {
        "debutant": { "montant": 300, "objectifs": { "kpi_id": 100 } },
        "confirme": { "montant": 400, "objectifs": { "kpi_id": 110 } },
        "senior":   { "montant": 500, "objectifs": { "kpi_id": 120 } }
      }
    }
  ],
  "indicateurs": [
    { "id": "dmt",     "label": "DMT",           "poids": 45 },
    { "id": "cvr",     "label": "CVR Naturelle",  "poids": 10 },
    { "id": "avg_nbr", "label": "AVG NBR",         "poids": 10 },
    { "id": "qualite", "label": "QUALITE",          "poids": 20 },
    { "id": "tx_mea",  "label": "Tx MEA",           "poids": 15 }
  ],
  "paliers_scoring": [
    { "label": "Insuffisant", "seuil_max": 70,   "multiplicateur": 0,    "verrouille": true },
    { "label": "Partiel",     "seuil_max": 85,   "multiplicateur": 0.5  },
    { "label": "Correct",     "seuil_max": 100,  "multiplicateur": 0.75 },
    { "label": "Atteint",     "seuil_max": null, "multiplicateur": 1.0,  "verrouille": true }
  ],
  "config_temps": {
    "jours_ouvres": 22, "base_horaire": 191,
    "mode_prorata": "jours", "seuil_minimum_jours": 15
  },
  "regles_assiduite": [
    { "condition": "abs_injust >= 1 OR retards >= 4",                        "malus_pct": 50,  "label": "Moitié de la prime est perdue" },
    { "condition": "abs_injust >= 2 OR retards >= 8 OR sanction == true",    "malus_pct": 100, "label": "Totalité de la prime est perdue" }
  ],
  "declencheurs": [
    { "id": "kr_reclamation", "label": "Réclamation client sur le mois", "consequence": "Toute la prime est perdue" }
  ],
  "primes_additionnelles": [
    { "id": "mission",      "label": "Mission",           "type": "fixe",     "montant": 0 },
    { "id": "langue",       "label": "Prime Langue",       "type": "fixe",     "montant": 0 },
    { "id": "bonus3",       "label": "Bonus 3",            "type": "variable", "montant": 0 },
    { "id": "bonus4",       "label": "Bonus 4",            "type": "variable", "montant": 0 },
    { "id": "super_ventes", "label": "Super Bonus Ventes", "type": "variable", "montant": 0 }
  ],
  "config_agent_mois": {
    "actif": true,
    "criteres_departage": ["statut_desc", "progression_points", "moyenne_trimestre"]
  }
}
```

### Pattern Frontend pour sauvegarder une section
```js
// Chaque section merge sa clé sans écraser les autres :
const newGrille = { ...regle.grille_objectifs, paliers_scoring: paliers };
onSave(newGrille);  // → PATCH /api/regles/:id/grille
```

---

## 🏗️ 6. Architecture Agents & Référentiels (MySQL local)

Les agents viennent exclusivement de tables MySQL locales normalisées (plus de SIRH SQL Server).

### Tables de Référence

| Table | Rôle | Contenu actuel |
|---|---|---|
| `ref_projets` | Grands comptes | PVCP (id=1) |
| `ref_operations` | BU / opérations | PVCP-APEN, PVCP-APSO, CP GERMANO, CP Belgique, CP NEERLANDO APSO |
| `ref_files` | Types de flux | PV (id=1), CP (id=2) |
| `ref_activites` | Activités spécifiques | SE, SA, BO, PARK, APSO, SA-SE |
| `ref_statuts` | Niveaux d'ancienneté | Débutant, Confirmé, Sénior |
| `ref_employes` | 32 agents avec lien `id_structure` | Identité + rattachement structurel |
| `ref_structure_map` | **"Le Cerveau"** — combinaisons valides Projet/Opération/File/Activité | 23 lignes |

### Tables de Gestion

| Table | Rôle |
|---|---|
| `matrice_primes_agents_gestion` | Sanction disciplinaire + Statut (id_statut) par agent par règle |

### Données hybrides Onglet Agents

| Donnée | Source | Mutabilité |
|---|---|---|
| Matricule, Nom, Prénom | `ref_employes` | Fixe |
| Opération, File, Activité | `ref_structure_map` → `ref_*` | Fixe |
| Sanction Disciplinaire | `matrice_primes_agents_gestion` | Par règle |
| Statut (Débutant/Confirmé/Sénior) | `matrice_primes_agents_gestion` | Par règle |
| Montant Cible | **Calculé** : `SI Sanction="Oui" → 0 SINON f(Statut, Postes)` | Dynamique |

---

## 🖼️ 7. Composants Frontend — État Actuel

### GestionAgents (`Pages/GestionAgents/GestionAgents.jsx`)
- 5 états de filtre : `projetFilter`, `operationFilter`, `fileFilter`, `activiteFilter`, `statutFilter`
- Logique cascade : `uniqueFiles` dérivé de agents filtrés par projet+operation ; `uniqueActivites` filtré par projet+operation+file
- Imports : `AgentsHeader`, `AgentsToolbar`, `AgentsTable`, `AddAgentModal`, `EditAgentModal`, `ConfirmationModal`

### AgentsToolbar (`sections/AgentsToolbar/AgentsToolbar.jsx`)
- 2 lignes : search bar (ligne 1) + 5 dropdowns cascade (ligne 2)
- Icônes : `fa-folder-open` (projet), `fa-gears` (operation), `fa-file-lines` (file), `fa-tag` (activite), `fa-layer-group` (niveau)
- Active state : bordure orange + bouton × inline ; bouton reset global `hasActiveFilters`

### AgentsTable / AddAgentModal / EditAgentModal
- Colonne et label "File" (renommé depuis "Fichier")

### ReglesPrimes — ReglesGridSection
**Structure JSX `RegleCard` :**
```
<div.regle-card>
  → <div.regle-card__actions>   (éditer + supprimer, apparaissent au hover)
  → <div.regle-card__title-row> [h3.nom + span.badge actif/inactif]
  → <div.regle-card__structure-tags> [tags projet / operation / file / activite]
  → <p.regle-card__description?>
  → <div.regle-card__footer> [span.periodicite + span.code]
```

**CSS hover actuel :**
- `transform: translateY(-6px) scale(1.015)` avec `cubic-bezier(0.34, 1.56, 0.64, 1)` (rebond léger)
- Fond `linear-gradient(160deg, #ffffff → #fff8f4)` au hover
- **Pas de shadow** au hover (supprimé)
- **Pas de border colorée** (supprimée)
- **Pas de barre accent** en haut (supprimée)
- Boutons d'action : slide depuis le haut (`translateY(-6px → 0)`) + `scale(1.15) rotate(±5deg)` au hover

---

## 🗃️ 8. Schéma de Base de Données

```
mypaie_config
├── ref_projets          (id, nom, code)
├── ref_operations       (id, id_projet FK, libelle)
├── ref_files            (id, libelle)
├── ref_activites        (id, libelle)
├── ref_statuts          (id, libelle)
├── ref_employes         (id, matricule, nom, prenom, id_structure FK)
├── ref_structure_map    (id, id_projet, id_operation, id_file?, id_activite?)
├── matrice_primes       (id, code, libelle, id_structure FK, periodicite,
│                         description, grille_objectifs JSON, actif, created_at)
├── matrice_primes_agents_gestion (id, matrice_id FK, agent_matricule,
│                                  id_statut FK, sanction)
└── matrice_primes_agents_resultats  ← À CRÉER (voir SQL section 2)
```

### Table à créer : `matrice_primes_agents_resultats`
```sql
CREATE TABLE matrice_primes_agents_resultats (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  matrice_id       INT NOT NULL,
  agent_matricule  VARCHAR(20) NOT NULL,
  periode          VARCHAR(7) NOT NULL,        -- ex: '2026-05'
  dmt_reel         FLOAT,
  cvr_reel         FLOAT,
  avg_nbr_reel     FLOAT,
  qualite_reel     FLOAT,
  tx_mea_reel      FLOAT,
  reclamation      TINYINT(1) DEFAULT 0,       -- Killing Rule
  heures_produites FLOAT,
  abs_injust       INT DEFAULT 0,
  retards          INT DEFAULT 0,
  abs_just         INT DEFAULT 0,
  conge_css        INT DEFAULT 0,
  jours_non_ouvres INT DEFAULT 0,
  score_total      FLOAT,
  prime_hors_sb    FLOAT,
  malus_pct        FLOAT,
  prime_finale     FLOAT,
  prime_mission    FLOAT DEFAULT 0,
  prime_langue     FLOAT DEFAULT 0,
  bonus3           FLOAT DEFAULT 0,
  bonus4           FLOAT DEFAULT 0,
  super_bonus_ventes FLOAT DEFAULT 0,
  montant_final    FLOAT,
  nb_points_final  FLOAT,
  agent_du_mois    TINYINT(1) DEFAULT 0,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_agent_periode (matrice_id, agent_matricule, periode)
);
```

---

## 🔌 9. API Backend — Endpoints

### Règles Primes (`/api/regles/...`)

| Méthode | URL | Rôle |
|---|---|---|
| `GET` | `/api/regles` | Liste toutes les règles (JOINs labels structure) |
| `POST` | `/api/regles` | Crée une nouvelle règle |
| `GET` | `/api/regles/:id` | Détail + `grille_objectifs` |
| `PUT` | `/api/regles/:id` | Mise à jour infos règle |
| `DELETE` | `/api/regles/:id` | Suppression |
| `PATCH` | `/api/regles/:id/grille` | **Sauvegarde moteur de calcul complet** |
| `GET` | `/api/regles/:id/agents` | Liste agents filtrés par structure |
| `POST` | `/api/regles/:id/agents/:mat/data` | Sauvegarde Statut + Sanction |
| `GET` | `/api/parametres/references` | projets / opérations / files / activités / statuts / structure |

### Agents (`/api/agents/...`)

| Méthode | URL | Rôle |
|---|---|---|
| `GET` | `/api/agents/gestion` | Liste agents avec structure |
| `POST` | `/api/agents/<matricule>/statut` | Maj statut |
| `POST` | `/api/agents` | Création agent |
| `PUT` | `/api/agents/<matricule>` | Mise à jour |
| `DELETE` | `/api/agents/<matricule>` | Suppression |

---

## 🔄 10. Sources Données Automatiques (BigQuery → Primes)

| Module | Service | Données disponibles | Clé |
|---|---|---|---|
| Heures agents | `dw_api_heures_provider.py` | `heure_total`, `TYPE_CONGE`, `date`, `projet` | `matricule` |
| Notes qualité | `dw_api_qualite_provider.py` | `Note_Sous_Item`, `Sous_Item`, `Item_Global` | `Agent` |
| Performance | `dw_api_performance_provider.py` | `nb_appels`, `taux_conversion_calc`, `tx_mea`, `temps_appel` | `matricule` |

### Mapping BigQuery → Colonnes Primes
```
heure_total            → Heures produites
TYPE_CONGE             → congés/absences justifiées
taux_conversion_calc   → CVR Naturelle
temps_appel / nb_appels → DMT calculé
tx_mea                 → Tx MEA
AVG(Note_Sous_Item)    → QUALITE
nb_appels              → AVG NBR
```

### Données restant en saisie manuelle
- `abs_injust` — absences injustifiées (non tracées BigQuery)
- `retards` — nombre de retards
- `conge_css` — congés payés + CSS en jours (à mapper depuis `TYPE_CONGE`)
- `reclamation` — killing rule individuelle
- Primes add-ons : MISSION, Langue, Bonus 3/4, Super Bonus Ventes

---

## 🚀 11. Chantiers Restants (Prochaines Sessions)

### Chantier 1 — Onglet Objectifs
Tableau par agent par règle pour saisir les résultats KPI réels, données d'assiduité et add-ons.

Plan d'intégration BigQuery recommandé :
1. Afficher les heures → `GET /api/heures?matricule={mat}&date_debut={p}&date_fin={p}`
2. Afficher KPIs perf → `GET /api/performance?matricule={mat}&date_debut={p}&date_fin={p}`
3. Afficher notes qualité → `GET /api/qualite?agent={mat}&date_debut={p}&date_fin={p}`
4. Saisie manuelle : `abs_injust`, `retards`, `reclamation`, add-ons
5. Déclencher le moteur → persist dans `matrice_primes_agents_resultats`

### Chantier 2 — Moteur de Calcul Complet (Backend)
Service Python implémentant la pipeline complète :
`Score KPI → Prime Hors SB → Prorata → Malus assiduité → Killing Rule → + Add-ons → Montant Final`

### Chantier 3 — Primes Additionnelles + Agent du Mois
Section Variables pour configurer MISSION / Langue / Bonus 3-4 / Super Bonus Ventes + logique de départage ex-æquo.

---

## 🐛 12. Problèmes Résolus (Historique)

| Problème | Cause | Solution |
|---|---|---|
| 502 Bad Gateway | Flask arrêté — `IndentationError` dans `agents_data_provider.py` ligne 116 | Correction de la docstring concaténée |
| Port bloqué (5001, 5002) | Windows/Docker occupe ces ports | `.env` local → `FLASK_PORT=5003` ; Docker garde `5001` |
| Proxy Vite cassé | `vite.config.js` pointait sur `localhost:5001` au lieu du DNS Docker | Corriger vers `http://backend:5001` |
| Parse error JSX ligne 87 | Balises `</div>` orphelines de l'ancien `RegleCard` restées après remplacement | Suppression des lignes orphelines |
| Doublons CSS `ReglesGridSection.css` | Ancien et nouveau CSS coexistaient (460 lignes) | Troncature à la ligne 282 via PowerShell |
