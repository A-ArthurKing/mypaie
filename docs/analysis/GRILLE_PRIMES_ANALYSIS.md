# 📊 Analyse Technico-Métier : Digitalisation des Grilles de Primes

## 📋 1. Présentation de la Source (Excel)
**Fichier :** `MCC_S01_FEG-GRILLE PRIMES AGENT-PVCP APEN SE_V01.xlsx`  
**Rôle :** Matrice de calcul automatisée pour déterminer les primes mensuelles des agents en fonction de KPIs de performance, d'assiduité et de discipline.

---

## 🧠 2. Dualité de l'Architecture (Variables vs Objectifs)

Le système repose sur une séparation stricte entre la **Structure** (Loi) et la **Donnée** (Application) :

### A. Onglet VARIABLES (La "Loi")
*   **Contenu :** Paramètres immuables pour une campagne donnée.
*   **Éléments :**
    *   **Pondération (Weighting) :** Nombre de points par KPI (ex: DMT = 45 pts, CVR = 10 pts, QUALITE = 20 pts, Tx MEA = 15 pts).
    *   **Règles de Présence :** Seuils d'absences/retards annulant ou réduisant la prime.
    *   **Killing Rules :** Événements critiques (Réclamation client Agent) entraînant un 0 immédiat.
*   **Impact :** Modifie le moteur de calcul pour tous les agents.

### B. Onglet OBJECTIFS (La "Donnée")
*   **Contenu :** Valeurs cibles et résultats opérationnels.
*   **Colonnes constatées dans l'Excel :**
    *   **Productivité :** DMT | CVR Naturelle | AVG NBR — chacun avec : Objectif VS Statut / Taux d'atteinte / Nb de points
    *   **Qualité :** QUALITE | Tx MEA — chacun avec : Objectif VS Statut / Taux d'atteinte / Nb de points
    *   **Satisfaction client :** Réclamation client sur Agent (killing rule individuelle)
    *   **Nb de points avant l'assiduité** (colonne de synthèse intermédiaire)
    *   **Assiduité, Comportement & Prorata :** Heures produites | Abs injust | Retards | Abs just | Congé payé + CSS (en j) | Nb jours non ouvrés du mois | Nb de jours travaillés | **Malus (en %)**
    *   **Montant de la prime hors Super Bonus** (résultat intermédiaire)
    *   **Autres Primes :** MISSION | Prime Langue | Prime Langue Finale | BONUS 3 | BONUS 4 | SUPER BONUS VENTES
    *   **Montant Final de la prime** (résultat final)
    *   **Nombre de points Final**
    *   **L'agent du mois de l'activité** (distinction honorifique)
*   **Impact :** Modifie le résultat final d'un individu spécifique.

---

## 🛠️ 3. Logique de Calcul (Reverse-Engineering des Formules)

### 📈 Calcul de la Performance KPI
$$\text{% d'Atteinte} = \frac{\text{Résultat Réel}}{\text{Objectif Cible}} \text{ (ou l'inverse pour DMT/Chute)}$$
Le score est ensuite converti en points via des **Paliers de Scoring** :
- `< 70%` → 0 points
- `70% à 85%` → 50% des points du KPI
- `85% à 100%` → 75% des points du KPI
- `> 100%` → 100% des points du KPI

### 🕒 Calcul du Prorata de Présence
- **Base :** Jours ouvrés du mois (ex: 22j) moins jours non ouvrés.
- **Formule :** $\text{Prime Proratée} = \text{Prime Théorique} \times \frac{\text{Jours travaillés}}{\text{Jours ouvrés du mois}}$

### 🚫 Règles d'Assiduité (Malus Progressifs)
Extraites directement de l'Excel :
- **Règle 1 :** 1 Absence injustifiée **OU** 4 Retards → **Moitié de la prime est perdue** (coeff × 0.5)
- **Règle 2 :** 2 Absences injustifiées **OU** 8 Retards **OU** Sanction disciplinaire → **Totalité de la prime est perdue** (coeff × 0)

### ☠️ Killing Rule (Annulation immédiate)
Constatée dans l'Excel :
- **Réclamation client Agent** → "Toute la prime est perdue" (coeff × 0 indépendamment des autres calculs)

### 🏆 Règle de Départage en cas d'Ex-Æquo (Agent du mois)
En cas d'égalité de points, l'ordre de priorité est :
1. Le **statut le plus Haut** (Sénior > Confirmé > Débutant)
2. La **progression en nombre de points** par rapport au mois précédent
3. Le **nombre moyen de points** du dernier trimestre

### 💰 Primes Additionnelles (Add-ons)
En plus de la prime de performance, la grille intègre des primes complémentaires :
- **MISSION** : prime de mission spéciale
- **Prime Langue** : prime brute langue
- **Prime Langue Finale** : montant après conditions
- **BONUS 3**, **BONUS 4** : primes de performance supplémentaires
- **SUPER BONUS VENTES** : bonus commercial

---

## 🚀 4. Roadmap & État d'Implémentation

| Phase | Objet | Statut |
|---|---|---|
| 1 | Matrice Postes & Cibles (montants + objectifs par niveau) | ✅ Implémentée |
| 2 | Éditeur de Paliers de Scoring (seuils 70/85/100%) | ✅ Implémentée |
| 3 | Configuration Temps & Prorata (jours ouvrés, base horaire) | ✅ Implémentée |
| 4 | Assiduité & Discipline (règles de malus progressifs) | ✅ Implémentée |
| 5 | Killing Rules (annulation immédiate sur événement qualitatif) | ✅ Implémentée |
| 6 | **Agents** — affichage, Statut/Sanction, Montant Cible | ✅ Implémentée |
| 7 | **Onglet Objectifs** — saisie des résultats réels par agent par KPI | ❌ À implémenter |
| 8 | **Moteur de calcul** — calcul automatique Prime Finale (pipeline complète) | ❌ À implémenter |
| 9 | **Primes Additionnelles** — MISSION, Langue, Bonus 3/4, Super Bonus Ventes | ❌ À implémenter |
| 10 | **Agent du mois** — logique de départage ex-æquo | ❌ À implémenter |

---

## 🔌 5. Architecture Agents & Référentiels (État Actuel)

Les agents ne viennent plus du SIRH SQL Server. Le système utilise exclusivement des tables MySQL locales normalisées.

### A. Tables de Référence (Cerveau)

| Table | Rôle | Contenu actuel |
|---|---|---|
| `ref_projets` | Grands comptes | PVCP (id=1) |
| `ref_operations` | BU / opérations | PVCP-APEN, PVCP-APSO, CP GERMANO, CP Belgique, CP NEERLANDO APSO |
| `ref_files` | Types de flux | PV (id=1), CP (id=2) |
| `ref_activites` | Activités spécifiques | SE, SA, BO, PARK, APSO, SA-SE |
| `ref_statuts` | Niveaux d'ancienneté | Débutant, Confirmé, Sénior |
| `ref_employes` | 32 agents avec lien `id_structure` | Identité + rattachement structurel |
| `ref_structure_map` | **"Le Cerveau"** — combinaisons valides Projet/Opération/File/Activité | 23 lignes |

### B. Tables de Gestion (Par règle)

| Table | Rôle |
|---|---|
| `matrice_primes_agents_gestion` | Sanction disciplinaire + Statut (id_statut) par agent par règle |

### C. Données Hybrides dans l'Onglet Agents

| Donnée | Source | Mutabilité |
|---|---|---|
| Matricule, Nom, Prénom | `ref_employes` | Fixe |
| Opération, File, Activité | `ref_structure_map` → `ref_*` | Fixe |
| Sanction Disciplinaire | `matrice_primes_agents_gestion` | Par règle |
| Statut (Débutant/Confirmé/Sénior) | `matrice_primes_agents_gestion` | Par règle |
| Montant Cible | **Calculé** : `SI Sanction="Oui" → 0 SINON f(Statut, Postes)` | Dynamique |

---

## 🗂️ 6. Architecture des Sections de l'Onglet Variables

L'onglet Variables est organisé en **6 sections** qui forment une **pipeline de calcul séquentielle**.  
Chaque section est une étape du moteur : modifier l'une impacte le résultat des suivantes.  
Elles sont stockées ensemble dans le champ JSON `grille_objectifs` de la table `matrice_primes`.

```
┌──────────────────────────────────────────────────────────────────────┐
│  PIPELINE DE CALCUL COMPLÈTE (ordre d'application — Excel source)   │
│                                                                      │
│  [1] Postes & Cibles                                                 │
│       │ fournit : montant brut + objectifs cibles par niveau         │
│       ▼                                                              │
│  [2] Pondération des indicateurs                                     │
│       │ fournit : poids (nb de points) de chaque KPI                 │
│       │  Productivité : DMT (45pts) + CVR Naturelle + AVG NBR (10)   │
│       │  Qualité      : QUALITE (20pts) + Tx MEA (15pts)             │
│       ▼                                                              │
│  [3] Paliers de Performance                                          │
│       │ fournit : multiplicateur selon le % d'atteinte               │
│       ▼                                                              │
│       📐 Score KPI = Points × Multiplicateur(palier)                 │
│       📐 Nb de points avant assiduité = Σ scores KPIs                │
│       📐 Prime Hors Super Bonus = f(Score Total, Postes)             │
│       ▼                                                              │
│  [4] Configuration Temps & Prorata                                   │
│       │ fournit : nb jours ouvrés, jours non ouvrés, base horaire    │
│       │ consomme : Heures produites + Abs just + Congé + CSS         │
│       ▼                                                              │
│       📐 Jours travaillés = Jours ouvrés - Abs just - Congé - CSS    │
│       📐 Prime Proratée = Prime Hors SB × (jours_trav / jours_ouv)   │
│       ▼                                                              │
│  [5] Assiduité & Discipline (Malus progressifs)                      │
│       │ Règle 1 : 1 abs injust OU 4 retards → Malus 50%              │
│       │ Règle 2 : 2 abs injust OU 8 retards OU sanction → Malus 100% │
│       ▼                                                              │
│       📐 Malus (%) appliqué → Montant de la prime hors Super Bonus   │
│       ▼                                                              │
│  [6] Killing Rules                                                   │
│       │ Réclamation client Agent → Prime = 0 total                   │
│       ▼                                                              │
│       📐 Prime Finale = Prime Proratée × (1 - Malus%) × (0 si KR)   │
│       ▼                                                              │
│  [7] Primes Additionnelles (Add-ons) ← À IMPLÉMENTER               │
│       │ MISSION + Prime Langue Finale + BONUS 3/4 + Super Bonus Vtes │
│       ▼                                                              │
│       💰 Montant Final de la prime = Prime Finale + Add-ons          │
│       🏆 Nombre de points Final                                      │
│       🌟 Agent du mois de l'activité (départage ex-æquo)            │
└──────────────────────────────────────────────────────────────────────┘
```

---

### Section 1 — Postes & Objectifs Cibles ✅
**Clé JSON :** `grille_objectifs.postes[]`

**Objectif :** Définir pour chaque poste d'agent (ex : CP SE, PV SE) le montant brut de prime
et les objectifs chiffrés pour chaque KPI, déclinés par niveau d'ancienneté (Débutant / Confirmé / Sénior).

**Données stockées :**
```json
"postes": [
  {
    "id": "poste_...",
    "code": "CP SE",
    "niveaux": {
      "debutant": { "montant": 300, "objectifs": { "kpi_id": 100 } },
      "confirme": { "montant": 400, "objectifs": { "kpi_id": 110 } },
      "senior":   { "montant": 500, "objectifs": { "kpi_id": 120 } }
    }
  }
]
```

---

### Section 2 — Pondération des Indicateurs ✅
**Clé JSON :** `grille_objectifs.indicateurs[]`

**KPIs observés dans l'Excel :**

| Catégorie | KPI | Points |
|---|---|---|
| Productivité | DMT | 45 |
| Productivité | CVR Naturelle | à définir |
| Productivité | AVG NBR | 10 |
| Qualité | QUALITE | 20 |
| Qualité | Tx MEA | 15 |
| Satisfaction | Réclamation client sur Agent | Killing Rule |

---

### Section 3 — Paliers de Performance ✅
**Clé JSON :** `grille_objectifs.paliers_scoring[]`

| Palier | Plage | Multiplicateur | Verrouillé |
|---|---|---|---|
| Insuffisant | 0% → 70% | ×0 | Oui (système) |
| Partiel | 70% → 85% | ×0.50 | Non |
| Correct | 85% → 100% | ×0.75 | Non |
| Atteint | > 100% | ×1.0 | Oui (système) |

---

### Section 4 — Configuration Temps & Prorata ✅
**Clé JSON :** `grille_objectifs.config_temps{}`

**Champs de saisie agent (onglet Objectifs) :**
- Heures produites
- Abs injustifiées (en jours)
- Retards (nb)
- Abs justifiées (en jours)
- Congé payé + CSS (en jours)
- Nb de jours non ouvrés du mois
- → **Nb de jours travaillés** (calculé)

```json
"config_temps": {
  "jours_ouvres": 22,
  "base_horaire": 191,
  "mode_prorata": "jours",
  "seuil_minimum_jours": 15
}
```

---

### Section 5 — Assiduité & Discipline ✅
**Clé JSON :** `grille_objectifs.regles_assiduite[]`

**Règles constatées dans l'Excel :**
```json
"regles_assiduite": [
  { "condition": "abs_injust >= 1 OR retards >= 4", "malus_pct": 50, "label": "Moitié de la prime est perdue" },
  { "condition": "abs_injust >= 2 OR retards >= 8 OR sanction == true", "malus_pct": 100, "label": "Totalité de la prime est perdue" }
]
```

---

### Section 6 — Killing Rules ✅
**Clé JSON :** `grille_objectifs.declencheurs[]`

**Killing Rule constatée dans l'Excel :**
```json
"declencheurs": [
  { "id": "kr_reclamation", "label": "Réclamation client sur le mois", "consequence": "Toute la prime est perdue" }
]
```

---

### Section 7 — Primes Additionnelles ❌ (À implémenter)
**Clé JSON proposée :** `grille_objectifs.primes_additionnelles[]`

**Add-ons observés dans l'Excel :**

| Champ | Type | Description |
|---|---|---|
| MISSION | Montant fixe | Prime de mission spéciale |
| Prime Langue | Montant brut | Prime langue brute |
| Prime Langue Finale | Montant calculé | Montant après conditions (présence ?) |
| BONUS 3 | Montant variable | Bonus de performance additionnel |
| BONUS 4 | Montant variable | Bonus de performance additionnel |
| SUPER BONUS VENTES | Montant variable | Bonus commercial |

**Structure proposée :**
```json
"primes_additionnelles": [
  { "id": "mission",     "label": "Mission",           "type": "fixe",     "montant": 0 },
  { "id": "langue",      "label": "Prime Langue",       "type": "fixe",     "montant": 0 },
  { "id": "bonus3",      "label": "Bonus 3",            "type": "variable", "montant": 0 },
  { "id": "bonus4",      "label": "Bonus 4",            "type": "variable", "montant": 0 },
  { "id": "super_ventes","label": "Super Bonus Ventes", "type": "variable", "montant": 0 }
]
```

---

### Section 8 — Règle Agent du Mois & Départage ❌ (À implémenter)
**Clé JSON proposée :** `grille_objectifs.config_agent_mois{}`

En cas d'ex-æquo sur le nombre de points, l'ordre de priorité est :
1. Le **statut le plus Haut** (Sénior > Confirmé > Débutant)
2. La **progression en nombre de points** vs le mois précédent
3. Le **nombre moyen de points** du dernier trimestre

```json
"config_agent_mois": {
  "actif": true,
  "criteres_departage": ["statut_desc", "progression_points", "moyenne_trimestre"]
}
```

---

## 🗃️ 7. Schéma de Base de Données (Vision 360°)

### Tables existantes dans `mypaie_config`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BASE : mypaie_config                                                       │
│                                                                             │
│  ref_projets    ref_operations   ref_files    ref_activites   ref_statuts   │
│  ┌──────────┐   ┌────────────┐   ┌────────┐   ┌──────────┐   ┌──────────┐  │
│  │ id PK    │   │ id PK      │   │ id PK  │   │ id PK    │   │ id PK    │  │
│  │ nom      │◄──│ id_projet  │   │ libelle│   │ libelle  │   │ libelle  │  │
│  │ code     │   │ libelle    │   └───┬────┘   └────┬─────┘   └──────────┘  │
│  └──────────┘   └─────┬──────┘       │              │                       │
│                       │              │              │                       │
│                       └──────────────┴──────────────┘                      │
│                                      │                                      │
│                                      ▼                                      │
│  ref_structure_map  ← "Le Cerveau"                                          │
│  ┌──────────────────────────────────────────────┐                          │
│  │ id PK                                        │                          │
│  │ id_projet   FK → ref_projets                 │                          │
│  │ id_operation FK → ref_operations             │                          │
│  │ id_file     FK → ref_files    (nullable)     │                          │
│  │ id_activite FK → ref_activites (nullable)    │                          │
│  └──────────────────────────────┬───────────────┘                          │
│                                 │ FK id_structure                           │
│              ┌──────────────────┼───────────────────┐                      │
│              ▼                  ▼                   ▼                      │
│  ref_employes            matrice_primes       matrice_primes_agents_gestion │
│  ┌─────────────────┐     ┌──────────────┐     ┌──────────────────────────┐ │
│  │ id PK           │     │ id PK        │     │ id PK                    │ │
│  │ matricule       │     │ code UNIQUE  │     │ matrice_id FK            │ │
│  │ nom             │     │ libelle      │     │ agent_matricule          │ │
│  │ prenom          │     │ id_structure │     │ id_statut FK→ref_statuts │ │
│  │ id_structure FK │     │ periodicite  │     │ sanction (Oui/Non)       │ │
│  └─────────────────┘     │ description  │     └──────────────────────────┘ │
│                          │ grille_objectifs JSON (pipeline complète)        │
│                          │ actif        │                                   │
│                          │ created_at   │                                   │
│                          └──────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Stratégie de stockage : SQL structuré vs JSON libre

Le projet utilise **deux approches complémentaires** :

```
Approche 1 : Tables relationnelles
  ref_projets / ref_operations / ref_files / ref_activites
  ref_statuts / ref_employes / ref_structure_map
  matrice_primes_agents_gestion
  → Avantage : requêtable avec SQL, indexable, jointures
  → Usage    : données de référence stables + gestion par règle

Approche 2 : JSON dans matrice_primes.grille_objectifs
  postes[]            → postes + montants + objectifs par niveau
  indicateurs[]       → pondération KPIs
  paliers_scoring[]   → paliers de performance dynamiques
  config_temps{}      → config prorata
  regles_assiduite[]  → règles malus absences
  declencheurs[]      → killing rules
  primes_additionnelles[] ← À IMPLÉMENTER
  config_agent_mois{} ← À IMPLÉMENTER
  → Avantage : flexible, 0 migration pour ajouter un champ
  → Usage    : configuration métier du moteur de calcul
```

---

## 🔌 8. API Backend — Vision 360°

### Architecture des couches

```
Frontend (React JSX)
        │  fetch() / axios
        ▼
┌─────────────────────────────────────────────┐
│  Flask App  (backend/run.py)                │
│                                             │
│  Blueprints enregistrés :                  │
│  - regles_primes_bp  → /api/regles/...      │
│  - agents_bp         → /api/regles/:id/agents│
│  - heures_agents_bp  → /api/heures/...      │
│  - notes_qualite_bp  → /api/qualite/...     │
│  - performance_bp    → /api/perf/...        │
│  - parametres_bp     → /api/parametres/...  │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  Routes Layer  (backend/routes/)            │
│  Validation HTTP → appel Service            │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  Service Layer  (backend/services/)         │
│  Logique métier + requêtes SQL              │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  Config Layer  (backend/config/)            │
│  db_mysql_connector.py  → PyMySQL pool      │
│  dw_api_bigquery_connector.py → BigQuery    │
└─────────────────────────────────────────────┘
```

### Endpoints Règles Primes (`/api/regles/...`)

| Méthode | URL | Rôle | Statut |
|---|---|---|---|
| `GET` | `/api/regles` | Liste toutes les règles (avec labels structure via JOIN) | ✅ |
| `POST` | `/api/regles` | Crée une nouvelle règle | ✅ |
| `GET` | `/api/regles/:id` | Détail d'une règle + `grille_objectifs` | ✅ |
| `PUT` | `/api/regles/:id` | Met à jour les infos de la règle | ✅ |
| `DELETE` | `/api/regles/:id` | Supprime une règle | ✅ |
| `PATCH` | `/api/regles/:id/grille` | Sauvegarde le moteur de calcul complet | ✅ |
| `GET` | `/api/regles/:id/agents` | Liste agents filtrés par structure (MySQL local) | ✅ |
| `POST` | `/api/regles/:id/agents/:mat/data` | Sauvegarde Statut + Sanction d'un agent | ✅ |
| `GET` | `/api/parametres/references` | Retourne projets/opérations/files/activités/statuts/structure | ✅ |

### Endpoint critique : `PATCH /api/regles/:id/grille`

C'est **le seul endpoint** utilisé par toutes les sections Variables.  
Il reçoit l'objet `grille_objectifs` complet et remplace la colonne JSON en base.

```js
// Pattern utilisé dans chaque Section (frontend) :
const newGrille = { ...regle.grille_objectifs, paliers_scoring: paliers };
onSave(newGrille);  // → PATCH /api/regles/:id/grille
```

---

## 🏗️ 9. Ce Qui Manque — Gap Analysis vs Excel Source

### 9.1 Onglet Objectifs (Saisie des résultats par agent)
**État actuel :** L'onglet Agents affiche la liste avec Statut/Sanction/Montant Cible.  
**Ce qui manque :** La saisie des **résultats réels** par KPI par agent pour déclencher le calcul complet.

Colonnes à implémenter dans l'onglet Objectifs :

| Colonne | Source | Type | Notes |
|---|---|---|---|
| DMT (résultat réel) | Saisie manuelle ou import | Float | Minutes/secondes |
| CVR Naturelle | Saisie / import | Float % | |
| AVG NBR | Saisie / import | Float | |
| QUALITE | Saisie / import | Float % | |
| Tx MEA | Saisie / import | Float % | |
| Réclamation client Agent | Checkbox | Booléen | Killing Rule individuelle |
| Heures produites | Saisie | Float | Pour calcul jours travaillés |
| Abs injustifiées | Saisie | Int | Nb jours |
| Retards | Saisie | Int | Nb retards |
| Abs justifiées | Saisie | Int | Nb jours |
| Congé payé + CSS | Saisie | Int | Nb jours |
| Nb jours non ouvrés du mois | Saisie (1 fois) | Int | Commun à tous les agents |

### 9.2 Moteur de Calcul (Backend)
**État actuel :** Le Montant Cible dans l'onglet Agents est une approximation simple (statut → montant brut).  
**Ce qui manque :** Le moteur de calcul complet :

```
Score KPI i = Poids KPI i × Palier(% atteinte i)
Score Total = Σ Score KPI i
Prime Hors SB = Score Total / 100 × Montant Brut(Statut, Poste)
Jours travaillés = Jours ouvrés - Abs just - Congé - CSS - Jours non ouvrés
Prime Proratée = Prime Hors SB × (Jours travaillés / Jours ouvrés)
Malus % = f(Règles assiduité : abs_injust, retards, sanction)
Prime Après Malus = Prime Proratée × (1 - Malus%)
Prime Finale = 0 si Killing Rule active, sinon Prime Après Malus
Montant Final = Prime Finale + MISSION + Langue Finale + BONUS 3 + BONUS 4 + Super Bonus Ventes
```

### 9.3 Section Variables manquante : Primes Additionnelles
Configuration des add-ons dans l'onglet Variables (clé `primes_additionnelles[]`).

### 9.4 Section Variables manquante : Règle Agent du Mois
Configuration des critères de départage (clé `config_agent_mois{}`).

### 9.5 Table de résultats agents
Une nouvelle table est nécessaire pour stocker les résultats réels par agent par règle :

```sql
CREATE TABLE matrice_primes_agents_resultats (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  matrice_id      INT NOT NULL,          -- FK → matrice_primes
  agent_matricule VARCHAR(20) NOT NULL,
  periode         VARCHAR(7) NOT NULL,   -- ex: '2026-05'
  -- Résultats KPIs
  dmt_reel        FLOAT,
  cvr_reel        FLOAT,
  avg_nbr_reel    FLOAT,
  qualite_reel    FLOAT,
  tx_mea_reel     FLOAT,
  reclamation     TINYINT(1) DEFAULT 0,  -- Killing Rule
  -- Assiduité
  heures_produites FLOAT,
  abs_injust      INT DEFAULT 0,
  retards         INT DEFAULT 0,
  abs_just        INT DEFAULT 0,
  conge_css       INT DEFAULT 0,
  jours_non_ouvres INT DEFAULT 0,
  -- Résultats calculés (cachés après calcul)
  score_total     FLOAT,
  prime_hors_sb   FLOAT,
  malus_pct       FLOAT,
  prime_finale    FLOAT,
  -- Add-ons
  prime_mission   FLOAT DEFAULT 0,
  prime_langue    FLOAT DEFAULT 0,
  bonus3          FLOAT DEFAULT 0,
  bonus4          FLOAT DEFAULT 0,
  super_bonus_ventes FLOAT DEFAULT 0,
  montant_final   FLOAT,
  nb_points_final FLOAT,
  agent_du_mois   TINYINT(1) DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_agent_periode (matrice_id, agent_matricule, periode)
);
```

---

## ✅ 10. Bilan : Fait vs À Faire

### Ce qui est implémenté

| Composant | Détail |
|---|---|
| 6 sections Variables | Postes & Cibles, Pondération, Paliers, Prorata, Assiduité, Killing Rules |
| Onglet Agents | Affichage liste, Statut/Sanction par règle, Montant Cible (calcul simplifié) |
| Références normalisées | `ref_projets`, `ref_operations`, `ref_files`, `ref_activites`, `ref_employes`, `ref_structure_map` |
| Cartes règles | Tags Projet / Opération / File / Activité via JOINs automatiques |
| Dropdowns en cascade | Création règle : Projet → Opération → File → Activité filtrés dynamiquement |

### Ce qui manque (3 chantiers)

**Chantier 1 — Onglet Objectifs (saisie & affichage des résultats réels)**  
Tableau par agent par règle pour saisir/voir les résultats KPI réels, les données d'assiduité et les add-ons. C'est la "Data" qui nourrit le moteur de calcul.

**Chantier 2 — Moteur de calcul complet (backend)**  
La formule pipeline complète :  
`Score KPI → Prime Hors SB → Prorata → Malus assiduité → Killing Rule → + Add-ons → Montant Final`  
Actuellement seule l'approximation `f(Statut) = montant brut` est en place.

**Chantier 3 — Primes Additionnelles + Agent du Mois**  
Section Variables pour configurer MISSION / Langue / Bonus 3-4 / Super Bonus Ventes + logique de départage ex-æquo.

---

## 🔄 11. Architecture des Données Automatiques (BigQuery → Primes)

### Principe fondamental
L'objectif à terme n'est **pas** de saisir manuellement les résultats : la majorité des données sont déjà récupérées automatiquement depuis **BigQuery** via les modules existants. Il suffit de faire la **correspondance par matricule** pour alimenter la pipeline de calcul.

### Sources de données automatiques disponibles

| Module | Service | Source | Données disponibles | Clé de jointure |
|---|---|---|---|---|
| **Heures agents** | `dw_api_heures_provider.py` | BigQuery (`BQ_TABLE_HEURES`) | `heure_total`, `heure_ht`, `heure_hp`, `heure_hc`, `heure_hf`, `TYPE_CONGE`, `TYPE_FORMATION`, `date`, `projet` | `matricule` |
| **Notes qualité** | `dw_api_qualite_provider.py` | BigQuery (`BQ_TABLE_QUALITE`) | `Note_Sous_Item`, `Sous_Item`, `Item_Global`, `Agent`, `Date_Evaluation`, `Projet` | `Agent` (= matricule ou nom) |
| **Performance** | `dw_api_performance_provider.py` | BigQuery (`BQ_TABLE_PAIE_PERF` + vues) | `nb_appels`, `nb_ventes`, `temps_appel`, `temps_production`, `taux_conversion_calc`, `tx_mea`, `csat_moyen`, `chiffre_affaire` | `matricule` |

### Mapping Matricule → Données auto

Pour une règle donnée et une période donnée, le système peut automatiquement :

```
Pour chaque agent (matricule) de la règle :

1. Heures → GET /api/heures?matricule={mat}&date_debut={p}&date_fin={p}
   → heure_total = Heures produites
   → TYPE_CONGE  = données congés/absences

2. Qualité → GET /api/qualite?agent={mat}&date_debut={p}&date_fin={p}
   → AVG(Note_Sous_Item) par Item_Global = score QUALITE, Tx MEA

3. Performance → GET /api/performance?agent={mat}&date_debut={p}&date_fin={p}
   → nb_appels = AVG NBR
   → taux_conversion_calc = CVR Naturelle
   → temps_appel / nb_appels = DMT calculé
   → tx_mea = Tx MEA (doublon avec qualité, à arbitrer)
```

### Ce qui reste manuel (non disponible en auto)
- `abs_injust` — absences injustifiées (non tracées dans BigQuery actuellement)
- `retards` — nombre de retards (non tracées dans BigQuery actuellement)
- `abs_just` — absences justifiées hors congés (à vérifier)
- `conge_css` — congés payés + CSS en jours (à mapper depuis `TYPE_CONGE`)
- `reclamation` — réclamation client (killing rule individuelle, saisie manuelle)
- Primes add-ons : MISSION, Langue, Bonus 3/4, Super Bonus Ventes

### Plan d'intégration recommandé

```
Étape 1 : Afficher les heures dans l'onglet Agents
  → Appel GET /api/heures?matricule={mat}&date_debut={periode}&date_fin={periode}
  → Afficher heure_total dans la colonne "Heures Prod."
  → Clé : matricule (déjà présent dans ref_employes)

Étape 2 : Afficher les KPIs de performance
  → Appel GET /api/performance?matricule={mat}&date_debut={p}&date_fin={p}
  → Afficher nb_appels, taux_conversion, tx_mea

Étape 3 : Afficher les notes qualité
  → Appel GET /api/qualite?agent={mat}&date_debut={p}&date_fin={p}
  → Agréger par Item_Global pour obtenir QUALITE et Tx MEA

Étape 4 : Permettre la saisie des données manuelles restantes
  → abs_injust, retards, reclamation, add-ons

Étape 5 : Déclencher le moteur de calcul
  → Backend calcule Prime Finale à partir de toutes les données
  → Persister dans matrice_primes_agents_resultats
```


Le système repose sur une séparation stricte entre la **Structure** (Loi) et la **Donnée** (Application) :

### A. Onglet VARIABLES (La "Loi")
*   **Contenu :** Paramètres immuables pour une campagne donnée.
*   **Éléments :**
    *   **Pondération (Weighting) :** Nombre de points par KPI (ex: DMT = 45 pts).
    *   **Règles de Présence :** Seuils d'absences/retards annulant ou réduisant la prime.
    *   **Killing Rules :** Événements critiques (Réclamation client) entraînant un 0 immédiat.
*   **Impact :** Modifie le moteur de calcul pour tous les agents.

### B. Onglet OBJECTIFS (La "Donnée")
*   **Contenu :** Valeurs cibles et résultats opérationnels.
*   **Éléments :**
    *   **Matrices Postes :** Objectifs chiffrés par Statut (Débutant/Confirmé/Sénior).
    *   **Versions :** Historique des grilles (Janvier V1, Janvier V2 corrigé, etc.).
    *   **Saisie :** Résultats réels des agents.
*   **Impact :** Modifie le résultat final d'un individu spécifique.

---

## 🛠️ 3. Logique de Calcul (Reverse-Engineering des Formules)

### 📈 Calcul de la Performance KPI
$$\text{% d'Atteinte} = \frac{\text{Résultat Réel}}{\text{Objectif Cible}} \text{ (ou l'inverse pour DMT/Chute)}$$
Le score est ensuite converti en points via des **Paliers de Scoring** :
- `< 70%` → 0 points
- `70% à 85%` → 50% des points du KPI
- `85% à 100%` → 75% des points du KPI
- `> 100%` → 100% des points du KPI

### 🕒 Calcul du Prorata de Présence
- **Base :** Jours ouvrés du mois (ex: 22j).
- **Formule :** $\text{Prime Proratée} = \text{Prime Théorique} \times \frac{\text{Jours travaillés}}{\text{Jours ouvrés}}$

### 🚫 Malus Disciplinaires (Killing Rules)
La formule `AO76` applique un coefficient multiplicateur sur le montant final :
- **Coefficient 0 (Prime annulée) :** $\ge 2$ sanctions OU $\ge 8$ retards OU ($1$ sanction ET $\ge 4$ retards).
- **Coefficient 0.5 :** ($1$ sanction ET $< 4$ retards) OU ($4$ à $7$ retards).

---

## 🚀 4. Proposition d'Implémentation (Roadmap)

Pour aligner l'application sur la complexité de l'Excel, nous devons ajouter les sections suivantes dans l'onglet **Variables** :

### Phase 1 : Matrice Postes & Cibles (VITAL)
*   Interface permettant de définir, pour chaque type d'agent (CP, PV, etc.) :
    *   Le montant de la prime brute.
    *   La cible chiffrée pour chaque KPI selon le niveau (Débutant/Confirmé/Sénior).

### Phase 2 : Éditeur de Paliers de Scoring
*   Rendre dynamiques les seuils de conversion (70%, 85%, etc.) et leurs multiplicateurs, car ils peuvent varier selon les projets.

### Phase 3 : Configuration Temporelle
*   Saisie des jours ouvrés du mois et des bases horaires (191h/176h) pour le calcul automatique du prorata.

### Phase 4 : Primes Additionnelles
*   Gestion des "Add-ons" (Prime Langue, Prime Projet, Prime Mission).

---

**Statut :** Phases 1, 2 et 3 implémentées. Phase 4 (Primes additionnelles) à planifier.
**Nouveau :** Intégration SIRH (Agents) opérationnelle.

---

## 🔌 5. Intégration SIRH & Flux de Données Agents

Le système s'interface désormais avec une base **SQL Server externe (SIRH)** pour synchroniser la liste des agents éligibles en temps réel.

### A. Architecture de Connexion
*   **Connecteur :** `backend/config/db_sqlserver_connector.py` (utilise `pymssql` avec import lazy pour éviter les crashs si non installé).
*   **Variables d'env :** `SIRH_SERVER`, `SIRH_USER`, `SIRH_PASSWORD`, `SIRH_DATABASE`.
*   **Service :** `backend/services/agents/sirh_agents_provider.py` (requête SQL complexe avec JOINs sur `sirh_poste`, `sirh_employ`, `sirh_business`, etc.).

### B. Mapping Règle ↔ Données Locales
Pour une dissociation totale des fonctionnalités et une évolutivité maximale, le système utilise désormais des tables de référence normalisées :
*   **Projets (`ref_projets`)** : Centralise les grands comptes (ex: PVCP).
*   **Opérations (`ref_operations`)** : Liste des BU liées à un projet (ex: CP GERMANO lié à PVCP).
*   **Files (`ref_files`)** : Types de flux (PV, CP).
*   **Activités (`ref_activites`)** : Flux spécifiques (SE, SA, BO, etc.).
*   **Employés (`ref_employes`)** : Stocke l'identité pure et les liens (IDs) vers les structures ci-dessus.

**Fonctionnement du filtrage :**
Lors de la création ou modification d'une règle, l'utilisateur choisit :
1.  Le **Projet** (ce qui filtre automatiquement la liste des Opérations).
2.  **L'Opération**, la **File** et/ou **l'Activité**.
Le système récupère alors dynamiquement tous les agents correspondants à cette hiérarchie précise.

### C. Données Hybrides (Identité vs Gestion)
Le tableau des agents combine deux sources locales :

| Donnée | Table Source | Type |
|---|---|---|
| Matricule, Nom, Prénom | `ref_employes` | Identité (Fixe) |
| Opération, File, Activité | `ref_employes` -> `ref_...` | Structure (Fixe) |
| **Sanction Disciplinaire** | `matrice_primes_agents_gestion` | Gestion (Par règle) |
| **Statut (Débutant/...)** | `matrice_primes_agents_gestion` | Gestion (Par règle) |
| **Montant Cible** | **Calculé** | 📐 `SI Sanction="Oui" ? 0 : f(Statut)` |


---

## 🗂️ 6. Architecture des Sections de l'Onglet Variables

L'onglet Variables est organisé en **6 sections** qui forment une **pipeline de calcul séquentielle**.  
Chaque section est une étape du moteur : modifier l'une impacte le résultat des suivantes.  
Elles sont stockées ensemble dans le champ JSON `grille_objectifs` de la table `matrice_primes`.

```
┌──────────────────────────────────────────────────────────────────┐
│  PIPELINE DE CALCUL (ordre d'application)                        │
│                                                                  │
│  [1] Postes & Cibles                                             │
│       │ fournit : montant brut + objectifs cibles par niveau     │
│       ▼                                                          │
│  [2] Pondération des indicateurs                                 │
│       │ fournit : poids (nb de points) de chaque KPI             │
│       ▼                                                          │
│  [3] Paliers de Performance                                      │
│       │ fournit : multiplicateur selon le % d'atteinte           │
│       ▼                                                          │
│       📐 Score KPI = Points × Multiplicateur(palier)             │
│       📐 Score Total = Σ scores KPIs                             │
│       📐 Prime Théorique = f(Score Total, Postes)                │
│       ▼                                                          │
│  [4] Configuration Temps & Prorata                               │
│       │ fournit : mode prorata, base horaire, seuil minimum      │
│       ▼                                                          │
│       📐 Prime Proratée = Prime Théorique × (jours / jours_ouv)  │
│       ▼                                                          │
│  [5] Assiduité & Discipline                                      │
│       │ fournit : seuils d'absences/retards → coeff 0.5 ou 0     │
│       ▼                                                          │
│  [6] Killing Rules                                               │
│       │ fournit : événements critiques → prime annulée (0)       │
│       ▼                                                          │
│       💰 Prime Finale versée                                     │
└──────────────────────────────────────────────────────────────────┘
```

---

### Section 1 — Postes & Objectifs Cibles
**Clé JSON :** `grille_objectifs.postes[]`

**Objectif :** Définir pour chaque poste d'agent (ex : CP SE, PV SE) le montant brut de prime
et les objectifs chiffrés pour chaque KPI, déclinés par niveau d'ancienneté (Débutant / Confirmé / Sénior).

**Rôle dans la pipeline :** Point d'entrée obligatoire. Sans cette section, le moteur n'a
ni montant de référence ni cibles à comparer aux résultats réels.

**Lien avec les autres sections :**
- Fournit les **montants bruts** utilisés par les sections 4, 5 et 6 pour calculer la prime finale.
- Fournit les **objectifs cibles** comparés aux résultats réels pour calculer le % d'atteinte (section 3).
- Dépend des **KPIs** définis dans l'onglet Objectifs (liste des indicateurs mesurés).

**Données stockées :**
```json
"postes": [
  {
    "id": "poste_...",
    "code": "CP SE",
    "niveaux": {
      "debutant": { "montant": 300, "objectifs": { "kpi_id": 100 } },
      "confirme": { "montant": 400, "objectifs": { "kpi_id": 110 } },
      "senior":   { "montant": 500, "objectifs": { "kpi_id": 120 } }
    }
  }
]
```

---

### Section 2 — Pondération des Indicateurs
**Clé JSON :** `grille_objectifs.indicateurs[]`

**Objectif :** Attribuer un nombre de points à chaque KPI. Ce poids définit l'importance relative
de chaque indicateur dans le score global (ex : DMT = 45 pts, CSAT = 30 pts, CONV = 25 pts).

**Rôle dans la pipeline :** Transforme les KPIs en une échelle de points comparable.
Le total des points de tous les KPIs forme le score maximum possible (100 pts en général).

**Lien avec les autres sections :**
- Ces points sont multipliés par le **multiplicateur du palier** (section 3) pour obtenir le score réel du KPI.
- Dépend des KPIs existants dans `grille_objectifs.indicateurs` (définis dans l'onglet Objectifs).

---

### Section 3 — Paliers de Performance
**Clé JSON :** `grille_objectifs.paliers_scoring[]`

**Objectif :** Définir les seuils de conversion du % d'atteinte d'un KPI en nombre de points.
Chaque palier a un label, une couleur, une borne supérieure (seuil_max) et un multiplicateur.

**Rôle dans la pipeline :** Nœud central du calcul de performance.
`Score KPI = Poids KPI × Multiplicateur(palier correspondant au % atteint)`

**Lien avec les autres sections :**
- Consomme les **poids KPI** de la section 2.
- Consomme les **% d'atteinte** calculés à partir des objectifs cibles (section 1) et des résultats réels (onglet Objectifs).
- La somme des scores KPIs donne la **Prime Théorique** qui entre dans la section 4.

**Paliers par défaut (extraits de l'Excel source) :**

| Palier | Plage | Multiplicateur | Verrouillé |
|---|---|---|---|
| Insuffisant | 0% → 70% | ×0 (prime = 0) | Oui (système) |
| Partiel | 70% → 85% | ×0.50 | Non |
| Correct | 85% → 100% | ×0.75 | Non |
| Atteint | > 100% | ×1.0 | Oui (système) |

---

### Section 4 — Configuration Temps & Prorata
**Clé JSON :** `grille_objectifs.config_temps{}`

**Objectif :** Paramétrer le mode de calcul du prorata de présence appliqué sur la prime théorique.
Définit aussi la base horaire contractuelle de référence et un seuil minimum de jours travaillés.

**Rôle dans la pipeline :** Ajustement de la prime en fonction du temps effectivement travaillé.
`Prime Proratée = Prime Théorique × (Jours travaillés / Jours ouvrés du mois)`

**Lien avec les autres sections :**
- Reçoit la **Prime Théorique** issue de la section 3.
- La **Prime Proratée** produite est ensuite transmise aux sections 5 et 6 pour les malus.
- Les **jours travaillés réels** de chaque agent viennent de l'onglet Objectifs (pas de cette section).

**Données stockées :**
```json
"config_temps": {
  "jours_ouvres": 22,
  "base_horaire": 191,
  "mode_prorata": "jours",
  "seuil_minimum_jours": 15
}
```

---

### Section 5 — Assiduité & Discipline
**Clé JSON :** `grille_objectifs.regles_assiduite[]`

**Objectif :** Définir les seuils d'absences injustifiées et de retards déclenchant
une réduction **progressive** de la prime (50% ou 100% de perte).

**Rôle dans la pipeline :** Malus progressif après prorata.
Si l'agent dépasse un seuil, un coefficient (0.5 ou 0) est appliqué à la prime proratée.

**Lien avec les autres sections :**
- Différent des Killing Rules : ici la perte est **proportionnelle à un compteur** (nb absences/retards).
- Les Killing Rules (section 6) appliquent un 0 immédiat sur un **événement qualitatif** (ex : réclamation).
- Les deux sections sont indépendantes mais s'appliquent séquentiellement.

---

### Section 6 — Killing Rules
**Clé JSON :** `grille_objectifs.declencheurs[]`

**Objectif :** Définir les événements critiques qui annulent **immédiatement et totalement** la prime,
indépendamment du score de performance ou des malus d'assiduité.

**Rôle dans la pipeline :** Dernière vérification avant versement. Si un déclencheur est actif,
la prime finale = 0, quelle que soit la valeur calculée par les étapes précédentes.

**Lien avec les autres sections :**
- S'applique après toutes les autres sections.
- Ne dépend d'aucune autre section — c'est un filtre binaire (événement présent → prime = 0).
- Distinct de l'assiduité (section 5) : un killing rule est un fait qualitatif (ex : fraude,
  réclamation grave), pas un compteur d'absences.

---

## 🗃️ 7. Schéma de Base de Données (Vision 360°)

### Tables existantes dans `mypaie_config`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BASE : mypaie_config                                                       │
│                                                                             │
│  matrice_statuts                matrice_kpis                                │
│  ┌──────────────────┐           ┌──────────────────┐                        │
│  │ id PK            │           │ id PK            │                        │
│  │ code UNIQUE      │           │ code UNIQUE      │                        │
│  │ libelle          │           │ libelle          │                        │
│  │ description      │           │ unite            │                        │
│  │ actif            │           │ description      │                        │
│  └────────┬─────────┘           │ actif            │                        │
│           │ FK statut_id        └────────┬─────────┘                        │
│           │                             │ FK kpi_id                         │
│           ▼                             ▼                                   │
│  matrice_primes  ◄────────────  matrice_objectifs                           │
│  ┌──────────────────────┐       ┌──────────────────┐                        │
│  │ id PK                │       │ id PK            │                        │
│  │ code UNIQUE          │       │ matrice_id FK    │──────────┐             │
│  │ libelle              │       │ kpi_id FK        │          │             │
│  │ projet               │       │ objectif_valeur  │          │             │
│  │ operation            │       │ poids            │          │             │
│  │ periodicite          │       └──────────────────┘          │             │
│  │ description          │                                     │             │
│  │ description_kpi      │       matrice_paliers               │             │
│  │ statut_id FK         │       ┌──────────────────┐          │             │
│  │ periode_debut        │       │ id PK            │          │             │
│  │ periode_fin          │◄──────│ matrice_id FK    │          │             │
│  │ actif                │       │ libelle          │          │             │
│  │ grille_objectifs JSON│       │ note_min         │          │             │
│  │ created_at           │       │ note_max         │          │             │
│  │ updated_at           │       │ prime_montant    │          │             │
│  └──────────┬───────────┘       │ prime_type       │          │             │
│             │                   └──────────────────┘          │             │
│             │ FK matrice_id                                    │             │
│             ▼                                                  │             │
│  matrice_primes_configs ◄────────────────────────────────────-┘             │
│  ┌──────────────────────┐                                                   │
│  │ id PK                │                                                   │
│  │ matrice_id FK        │  (versioning des grilles d'objectifs)             │
│  │ libelle              │                                                   │
│  │ content JSON         │  ← snapshot de grille_objectifs à un instant T   │
│  │ est_active BOOL      │                                                   │
│  │ grille_uuid          │  ← identifiant logique de la grille               │
│  │ grille_nom           │                                                   │
│  │ grille_ordre         │                                                   │
│  │ created_at           │                                                   │
│  │ updated_at           │                                                   │
│  └──────────────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Rôle de chaque table

| Table | Rôle | Lien avec l'UI |
|---|---|---|
| `matrice_statuts` | Référentiel des types de contrats (CDI, CDD…) | Filtre au niveau de la règle |
| `matrice_kpis` | Catalogue des indicateurs mesurables (CSAT, DMT…) | Sélection dans l'onglet Objectifs |
| `matrice_primes` | **Table centrale** — une règle = une ligne. Contient tout le moteur de calcul dans `grille_objectifs` | Toute la page Règles Primes écrit/lit ici |
| `matrice_objectifs` | Liaison matrice ↔ KPI avec valeur cible et poids (table relationnelle d'ancienne génération — remplacée fonctionnellement par `grille_objectifs.postes[]`) | Onglet Objectifs |
| `matrice_paliers` | Ancienne table de paliers par note globale (Bronze/Silver/Gold). Remplacée fonctionnellement par `grille_objectifs.paliers_scoring[]` | Non utilisée actuellement par l'UI |
| `matrice_primes_configs` | Versioning — historique des snapshots de grilles d'objectifs pour une règle | Onglet Objectifs → gestion des versions |

### Stratégie de stockage : SQL structuré vs JSON libre

Le projet utilise **deux approches complémentaires** :

```
Approche 1 : Tables relationnelles (ancienne génération)
  matrice_objectifs   → objectifs cibles par KPI (1 ligne = 1 KPI)
  matrice_paliers     → paliers par note globale (1 ligne = 1 palier)
  → Avantage : requêtable avec SQL, indexable
  → Limite   : rigide, pas adaptable sans ALTER TABLE

Approche 2 : JSON dans matrice_primes.grille_objectifs (nouvelle génération)
  postes[]            → postes + montants + objectifs par niveau
  paliers_scoring[]   → paliers de performance dynamiques
  config_temps{}      → config prorata
  indicateurs[]       → pondération KPIs
  regles_assiduite[]  → règles malus absences
  declencheurs[]      → killing rules
  → Avantage : flexible, 0 migration pour ajouter un champ
  → Limite   : pas requêtable directement avec SQL simple
```

---

## 🔌 8. API Backend — Vision 360°

### Architecture des couches

```
Frontend (React JSX)
        │  fetch() / axios
        ▼
┌─────────────────────────────────────────────┐
│  Flask App  (backend/run.py)                │
│                                             │
│  Blueprints enregistrés :                  │
│  - regles_primes_bp  → /api/regles/...      │
│  - heures_agents_bp  → /api/heures/...      │
│  - notes_qualite_bp  → /api/qualite/...     │
│  - performance_bp    → /api/perf/...        │
│  - parametres_bp     → /api/params/...      │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  Routes Layer  (backend/routes/)            │
│  Validation HTTP → appel Service            │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  Service Layer  (backend/services/)         │
│  Logique métier + requêtes SQL              │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  Config Layer  (backend/config/)            │
│  db_mysql_connector.py  → PyMySQL pool      │
│  dw_api_bigquery_connector.py → BigQuery    │
└─────────────────────────────────────────────┘
```

### Endpoints Règles Primes (`/api/regles/...`)

| Méthode | URL | Rôle | Service appelé |
|---|---|---|---|
| `GET` | `/api/regles` | Liste toutes les règles | `get_regles()` |
| `POST` | `/api/regles` | Crée une nouvelle règle | `create_regle()` |
| `GET` | `/api/regles/:id` | Détail d'une règle + `grille_objectifs` | `get_regle_by_id()` |
| `PUT` | `/api/regles/:id` | Met à jour les infos de la règle (libellé, projet…) | `update_regle()` |
| `DELETE` | `/api/regles/:id` | Supprime une règle | `delete_regle()` |
| `PATCH` | `/api/regles/:id/grille` | **Sauvegarde le moteur de calcul complet** (toutes les sections Variables) | `update_regle_grille()` |
| `GET` | `/api/regles/:id/configs` | Liste les versions de grilles | `get_regle_configs()` |
| `POST` | `/api/regles/:id/configs` | Crée un snapshot de version | `create_regle_config()` |
| `POST` | `/api/regles/:id/configs/:cid/activate` | Active une version de grille | `set_active_config()` |
| `PATCH` | `/api/regles/:id/grilles/order` | Réordonne les grilles | `update_grilles_order()` |

### Endpoint critique : `PATCH /api/regles/:id/grille`

C'est **le seul endpoint** utilisé par toutes les sections Variables (Postes, Paliers, Temps, Assiduité, Killing Rules).  
Il reçoit l'objet `grille_objectifs` complet et remplace la colonne JSON en base.

```
Frontend (section Variables)
    │
    │  PATCH /api/regles/42/grille
    │  Body: { "grille_objectifs": { ...toute la config... } }
    │
    ▼
endpoint_update_regle_grille()   ← routes/regles_primes_routes.py
    │  validation : grille_objectifs présent ?
    ▼
update_regle_grille(42, {...})   ← services/dw_api_regles_provider.py
    │  UPDATE matrice_primes SET grille_objectifs = '...' WHERE id = 42
    ▼
Base MySQL : matrice_primes.grille_objectifs = JSON complet
```

**Point d'attention :** Chaque section envoie un merge côté frontend avant d'appeler `onSave(newGrille)`.
Le frontend est responsable de ne pas écraser les clés des autres sections :
```js
// Pattern utilisé dans chaque Section :
const newGrille = { ...regle.grille_objectifs, paliers_scoring: paliers };
onSave(newGrille);  // → PATCH /api/regles/:id/grille
```
