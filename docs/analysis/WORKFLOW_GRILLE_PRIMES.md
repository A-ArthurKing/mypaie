# Workflow complet myPaie — De la création d'un KPI à l'affichage sur le tableau de bord

## Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  1. PARAMÉTRAGE        2. ETL BigQuery      3. RÈGLE DE PRIME                │
│  (Admin)               (ETL Workers)        (Manager)                        │
│                                                                               │
│  config_kpis ───────────────────────────►  matrice_primes                    │
│  (MySQL)         données EAV BQ            grille_objectifs (JSON)            │
│                                                    │                          │
│  4. ASSISTANT IA                            5. TABLEAU DE BORD                │
│  génère la grille ──────────────────────►  calcul prime agent                │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Étape 1 — Créer / configurer un KPI (Paramètres → Indicateurs KPIs)

### Qui : Administrateur
### Où : `/parametres` → onglet "Indicateurs KPIs"

Un KPI est la **définition** d'un indicateur de performance. Sans KPI configuré, l'IA refuse de créer une grille.

### 1.1 Types de KPIs

| Type | Description | Exemple |
|------|-------------|---------|
| **NATIVE** | Valeur brute issue directement de BigQuery via un `kpi_code` | `BOOKING_NBR`, `REVENUE_AMT_EUR` |
| **VIRTUAL** | Calculé à partir d'autres KPIs via une formule `[CODE]` | `DMT = [TEMPS_APPEL] / [NB_APPELS]` |

### 1.2 Créer un KPI NATIVE (onglet "Normalisation BigQuery")

1. Sélectionner le code technique source BigQuery (ex: `booking_nbr`)
2. Renseigner le **libellé métier** (ex: "Nombre de Ventes") — l'IA suggère automatiquement
3. Renseigner les **Codes BigQuery acceptés** : tous les alias du `kpi_code` dans BigQuery, séparés par virgule  
   → ex: `booking_nbr, nb_ventes, BOOKING_NBR`
4. Choisir l'**agrégation** : `SUM` (total sur la période) ou `AVG` (moyenne)
5. Sauvegarder → MySQL `config_kpis` est mis à jour

> **Pourquoi les "Codes BigQuery" ?**  
> BigQuery stocke les données en format EAV (Entity-Attribute-Value) : une ligne par `(matricule, mois, kpi_code, valeur)`. Le même indicateur peut avoir des noms différents selon les projets (`booking_nbr` dans un projet, `nb_ventes` dans un autre). Ces codes permettent au pivot SQL de capturer toutes les variantes.

### 1.3 Créer un KPI VIRTUAL (onglet "Création Virtuelle")

1. Définir un code unique (ex: `TAUX_CONVERSION_GLOBAL`)
2. En mode **Assisté** : cocher les KPIs sources, choisir SUM ou AVG, définir un score max optionnel
3. En mode **Avancé** : écrire la formule librement avec les balises `[CODE]`  
   → ex: `([NB_VENTES] / [NB_APPELS]) * 100`
4. Sauvegarder → MySQL `config_kpis` avec `type=VIRTUAL` et la formule

> Les KPIs VIRTUAL sont évalués dynamiquement par `evaluate_formula()` dans le backend — aucun code SQL à modifier.

---

## Étape 2 — L'ETL ingère les données dans BigQuery

### Qui : Workers Python (planifiés ou déclenchés manuellement)
### Scripts : `backend/workers/universal_performance_etl.py`, `universal_quality_etl.py`

Les ETL aspirent les données brutes des sources (Siebel, CRM, etc.) et les chargent dans BigQuery au format EAV :

```
Table Silver : paie_performance
┌────────────┬─────────────┬───────────────┬───────────┬───────────┐
│ matricule  │ mois        │ kpi_code      │ valeur_sum│ valeur_avg│
├────────────┼─────────────┼───────────────┼───────────┼───────────┤
│ EMP001     │ 2026-04     │ booking_nbr   │ 42        │ -         │
│ EMP001     │ 2026-04     │ revenue_amt   │ 18500     │ -         │
│ EMP001     │ 2026-04     │ tx_mea        │ -         │ 0.12      │
└────────────┴─────────────┴───────────────┴───────────┴───────────┘

Table Gold : paie_performance_mensuelle (agrégée par mois)
```

> Les `kpi_code` dans BigQuery correspondent exactement aux valeurs saisies dans "Codes BigQuery acceptés" du KPI.

---

## Étape 3 — Créer une règle de prime (Règles de Primes)

### Qui : Manager
### Où : `/regles-primes` → "Nouvelle règle"

Une **règle de prime** (`matrice_primes`) définit :
- Le **périmètre** : quelle structure (projet/opération/file) est concernée
- Les **statuts agents** éligibles (CDI, CDD, STAGE…)
- La **grille d'objectifs** (JSON) : les KPIs, leurs poids, leurs paliers, et les montants de prime

La grille est stockée comme JSON dans `matrice_primes_configs.content` (versionnée) et dans `matrice_primes.grille_objectifs` (version active en dénormalisé).

---

## Étape 4 — L'assistant IA crée la grille (Panneau IA)

### Qui : Manager (via le chat IA intégré dans la règle)
### Où : `/regles-primes/{id}` → panneau IA latéral

### 4.1 Flux de conversation

```
Manager: "Crée une grille avec le CA en paliers et le CSAT en bonus"
   │
   ▼
AI Engine (Gemini Flash)
   │
   ├─ list_available_kpis_tool() ──► MySQL config_kpis
   │     ↳ retourne les libellés + tech_keys de tous les KPIs actifs
   │
   ├─ get_real_performance_tool(regle_id, mois) ──► BigQuery
   │     ↳ données réelles de l'équipe pour calibrer les objectifs
   │
   └─ prepare_grille_proposal_tool(regle_id, nom, json)
         ↳ génère le bloc ```json_grille_proposal``` dans le chat
```

### 4.2 Garantie : l'IA n'invente pas de KPIs

Le system prompt (règle 5) **interdit** à l'IA de générer un `metric_key` qui n'existe pas dans `config_kpis`. Elle utilise exclusivement les codes retournés par `list_available_kpis_tool()`, qui lit la base MySQL en temps réel. Si un KPI demandé n'existe pas, elle demande à l'admin de le créer d'abord.

### 4.3 Structure du JSON de grille proposé

```json
{
  "indicateurs": [
    {
      "id": "kpi_001",
      "nom": "Chiffre d'Affaires",
      "metric_key": "REVENUE_AMT_EUR",
      "poids": 60,
      "mode_prime": "paliers",
      "paliers": [
        { "min": 0,     "max": 60000, "points": 0  },
        { "min": 60000, "max": 80000, "points": 30 },
        { "min": 80000, "max": null,  "points": 60 }
      ]
    },
    {
      "id": "kpi_002",
      "nom": "Satisfaction Client",
      "metric_key": "NOTE_QUALITE",
      "poids": 40,
      "mode_prime": "paliers",
      "paliers": [...]
    }
  ],
  "statuts": ["CDI", "CDD"],
  "paliers": [
    { "min": 0,  "max": 50, "montant": 0   },
    { "min": 50, "max": 80, "montant": 518 },
    { "min": 80, "max": 100,"montant": 750 }
  ]
}
```

> **`metric_key`** = clé de jointure entre la grille et les données réelles. C'est le `code_kpi` de `config_kpis`.

### 4.4 Bouton "Simuler"

Avant de valider, le manager peut cliquer **Simuler** sous la proposition IA. Le frontend :
1. Appelle `/api/regles/{id}/agents` → liste des agents de la règle
2. Appelle `/api/regles/{id}/calcul?date_debut=...&date_fin=...` → données réelles
3. Calcule via `KpiCalculatorHelper.js` (fonctions pures) les points et primes
4. Affiche un tableau récapitulatif par agent avec la prime estimée

### 4.5 Validation et sauvegarde

Le manager clique **"Valider la configuration"** → l'IA appelle `save_grille_config_tool()` :
- Insère dans `matrice_primes_configs` (nouvelle version, `est_active=1`)
- Met à jour `matrice_primes.grille_objectifs` (dénormalisation)
- Émet un événement Socket.IO `grille_updated` → l'interface se rafraîchit en temps réel

---

## Étape 5 — Le tableau de bord calcule les primes

### Qui : Manager / RH
### Où : `/regles-primes/{id}` → onglet "Tableau de Bord"

### 5.1 Pipeline de données côté backend

```
Frontend demande /api/regles/{id}/calcul
          │
          ▼
kpi_unified_resolver.py
   │
   ├─ get_perf_totaux_par_matricule() ──► BigQuery paie_performance_mensuelle
   │   │
   │   ├─ Colonnes fixes (backward compat) :
   │   │    SUM(IF(kpi_code IN ('booking_nbr','nb_ventes',...), valeur_sum, 0))
   │   │
   │   └─ Colonnes dynamiques (depuis config_kpis.bq_kpi_codes) :
   │        Pour chaque KPI NATIVE avec bq_kpi_codes :
   │        SUM/AVG(IF(kpi_code IN (<bq_codes>), valeur_sum/avg, 0)) AS dyn_{code_kpi}
   │
   ├─ get_qualite_totaux_par_matricule() ──► BigQuery paie_qualite
   │    ↳ NOTE_QUALITE = moyenne des critères évalués
   │
   ├─ get_heures_totaux() ──► BigQuery paie_heures
   │    ↳ HEURE_HP, HEURE_HT, HEURE_HF, HEURE_TOTAL
   │
   └─ evaluate_formula() pour chaque KPI VIRTUAL dans kpi_registry
        ↳ ex: TAUX_CONVERSION = [NB_VENTES] / [NB_APPELS] * 100
```

**Résultat** : `unifiedMap = { "EMP001": { "REVENUE_AMT_EUR": 18500, "NOTE_QUALITE": 87, "HEURE_TOTAL": 168, ... } }`

### 5.2 Pipeline de calcul côté frontend

```
TableauDeBordOnglet.jsx reçoit unifiedMap
          │
          ▼
Pour chaque agent × indicateur de la grille :

getRealValue(metric_key, matricule, unifiedMap)
   └─ Lookup direct : kpis[metric_key] — trouve TOUT code présent dans unifiedMap
   └─ Fallbacks switch (compatibilité anciens alias)
          │
          ▼
calculateKpiResults(indicateurs, agentKpis)
   ↳ Évalue les paliers, attribue les points
          │
          ▼
calculateAssiduite(agent, regle)
   ↳ Malus si sanctions / absences
          │
          ▼
calculateMontantFinal(totalPoints, paliers, assiduite)
   ↳ Cherche dans paliers[] le montant correspondant aux points totaux
          │
          ▼
Affichage : tableau agents × KPIs, points, prime finale en MAD
```

---

## Schéma de bout en bout

```
 ADMIN                   ETL                  IA                   CALCUL
   │                      │                    │                      │
   │ 1. Crée KPI          │                    │                      │
   │ bq_codes=["bkng"]    │                    │                      │
   │ aggr=SUM             │                    │                      │
   │                      │                    │                      │
   │            2. ETL ingère                  │                      │
   │            kpi_code="bkng"                │                      │
   │            valeur_sum=42                  │                      │
   │                      │                    │                      │
   │                             3. Manager demande grille            │
   │                             IA → list_available_kpis()           │
   │                             ← BOOKING_NBR (libellé: Nb Ventes)   │
   │                             IA génère metric_key="BOOKING_NBR"   │
   │                             Manager valide                       │
   │                                                                   │
   │                                           4. SQL BQ dynamique    │
   │                                           SUM(IF(kpi_code IN     │
   │                                           ('bkng'),valeur_sum))  │
   │                                           AS dyn_booking_nbr     │
   │                                                                   │
   │                                           5. getRealValue(       │
   │                                           "BOOKING_NBR",mat,map) │
   │                                           → kpis["BOOKING_NBR"]  │
   │                                           = 42 ✓                 │
```

---

## Points clés à retenir

| Point | Détail |
|-------|--------|
| **L'IA ne peut pas inventer** | `list_available_kpis_tool()` lit `config_kpis` en temps réel → seuls les KPIs actifs sont proposables |
| **Le lien grille↔données** | `metric_key` dans la grille JSON = `code_kpi` dans `config_kpis` = clé dans `unifiedMap` |
| **Le pivot SQL est dynamique** | `_load_native_bq_kpi_definitions()` lit MySQL à chaque appel → un nouveau KPI est actif sans redéploiement |
| **Les KPIs VIRTUAL sont gratuits** | Formulés en `[CODE]` → `evaluate_formula()` les calcule depuis les natifs déjà présents |
| **Versions de grille** | Chaque modification crée une nouvelle version dans `matrice_primes_configs`, l'ancienne est conservée et restaurable |
| **Temps réel** | Socket.IO émet `grille_updated` à chaque sauvegarde → tous les clients connectés voient le changement instantanément |

---

## Glossaire

| Terme | Définition |
|-------|------------|
| `metric_key` | Identifiant de l'indicateur dans la grille JSON. Correspond à `code_kpi` dans `config_kpis`. |
| `kpi_code` | Nom brut de l'indicateur tel qu'il existe dans BigQuery (`paie_performance_mensuelle.kpi_code`). |
| `bq_kpi_codes` | Liste des `kpi_code` BigQuery acceptés pour un KPI NATIVE (plusieurs noms = même indicateur). |
| `unifiedMap` | Dictionnaire `{ matricule: { code_kpi: valeur } }` construit par `kpi_unified_resolver`. |
| `formula_ctx` | Contexte de valeurs passé à `evaluate_formula()` pour calculer les KPIs VIRTUAL. |
| EAV | Entity-Attribute-Value — format de stockage BigQuery : une ligne par (agent, mois, indicateur). |
| Grille | Ensemble des indicateurs + paliers + montants défini pour une règle de prime. |
| Paliers | Tranches de points ou valeurs associées à des montants de prime (en MAD). |
