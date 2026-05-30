# Logique de l'Assistant IA — Configuration de Grilles de Prime

## Contexte

L'assistant IA est intégré dans la page de détail d'une règle de prime.
Son rôle unique est d'aider le responsable RH à **configurer une grille d'objectifs (KPIs)** pour cette règle, en le guidant étape par étape, sans jamais lui faire voir de JSON brut.

---

## Le Problème à Résoudre

Quand un utilisateur décrit sa grille, il utilise **ses propres mots** :
> *"Je veux un indicateur DMT, un CVR Naturelle, un AVG NBR et un Tx MEA"*

Ces noms ne correspondent pas forcément aux codes techniques stockés en base de données.
L'IA doit donc :
1. Faire la correspondance entre les noms métier et les KPIs réels
2. La **valider avec l'utilisateur** avant de construire quoi que ce soit
3. Vérifier que des données existent avant de créer une règle inutilisable

---

## Le Workflow en 3 Phases

### Phase 1 — Résolution et Validation des KPIs

**Déclencheur** : L'utilisateur mentionne au moins un nom d'indicateur dans son message.

**Ce qui se passe :**
- L'IA appelle un outil de résolution (`resolve_kpi_names_tool`) qui tente de faire correspondre chaque nom mentionné avec un KPI présent en base de données.
- Pour chaque KPI, une **carte interactive** est affichée dans le chat :

```
┌──────────────────────────────────────────┐
│  "DMT"  →  Durée Moyenne Traitement      │
│  DUREE_MOY_TRAITEMENT       [PERF]       │
├─────────────────────┬────────────────────┤
│  ✓  Valider         │  ✗  Autre KPI      │
└─────────────────────┴────────────────────┘
```

**Trois états possibles pour chaque carte :**

| État | Condition | Comportement |
|---|---|---|
| Suggestion | L'IA a trouvé une correspondance probable | Affiche la suggestion + boutons ✓ / ✗ |
| Picker | L'utilisateur clique ✗ | Affiche la liste complète des KPIs disponibles à choisir |
| Confirmé | L'utilisateur a validé | Carte verte, non-cliquable |

**Règle absolue :** L'IA ne peut PAS passer à la Phase 2 tant que toutes les cartes ne sont pas confirmées (vertes).

---

### Phase 2 — Récapitulatif Texte

**Déclencheur** : Tous les KPIs ont été confirmés par l'utilisateur.

**Ce qui se passe :**
- L'IA présente un **résumé lisible** de la configuration envisagée (texte uniquement, pas de JSON) :
  - KPIs retenus avec leurs correspondances validées
  - Objectifs par statut (tableau simple)
  - Paliers de paiement proposés
  - Règles métier si mentionnées
- L'IA pose la question : *"Cette configuration vous convient-elle ?"*

**Règle absolue :** L'IA ne génère PAS encore de proposition JSON. Elle attend une confirmation explicite.

---

### Phase 3 — Validation des Données + Proposition

**Déclencheur** : L'utilisateur confirme le récapitulatif.

**Ce qui se passe :**

**Étape A — Vérification des données réelles (3 derniers mois)**
- L'IA interroge les données BigQuery pour vérifier que les KPIs sélectionnés ont des valeurs réelles.
- Si un KPI n'a **aucune donnée** sur les 3 derniers mois → l'IA **avertit clairement** :
  > *"⚠️ Le KPI 'DMT' n'a aucune donnée sur les 3 derniers mois. Créer une règle dessus produirait des calculs impossibles. Souhaitez-vous continuer quand même ?"*
- Si **tous** les KPIs sont vides → l'IA refuse la création.

**Étape B — Génération de la proposition**
- L'IA construit le JSON de la grille en mémoire (invisible pour l'utilisateur).
- Elle appelle l'outil de proposition qui génère une **carte de validation** dans le chat :

```
┌─────────────────────────────────────────┐
│  📝 Proposition de Grille               │
│  "Configuration IA - V1"               │
│  [Valider et Créer]  [Simuler]         │
└─────────────────────────────────────────┘
```

- Une simulation sur **3 agents réels** est affichée (données issues de BigQuery).

**Étape C — Application**
- L'utilisateur clique "Valider et Créer" **ou** dit explicitement "Crée la / Applique".
- Seulement à ce moment, la grille est enregistrée en base de données.
- L'interface se rafraîchit automatiquement.

---

## Diagramme de Flux

```
Utilisateur décrit sa grille
          │
          ▼
┌─────────────────────────────────────┐
│  PHASE 1 : Résolution KPIs          │
│                                     │
│  resolve_kpi_names_tool             │
│       ↓                             │
│  Cartes ✓/✗ par KPI                 │
│       ↓                             │
│  Attente clics utilisateur          │
│       ↓                             │
│  Toutes cartes vertes ?  ──Non──►   │
│       │ Oui                STOP     │
└───────┼─────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│  PHASE 2 : Récapitulatif Texte      │
│                                     │
│  Résumé lisible (pas de JSON)       │
│       ↓                             │
│  "Confirmez-vous ?"                 │
│       ↓                             │
│  Confirmation ?  ──Non──►  Ajuster  │
│       │ Oui                         │
└───────┼─────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│  PHASE 3 : Données + Proposition    │
│                                     │
│  get_real_performance_tool (3 mois) │
│       ↓                             │
│  KPIs sans données ?                │
│       ├─ Oui → Avertissement        │
│       │        ↓ Confirmation ?     │
│       └─ Non → Continuer            │
│                                     │
│  prepare_grille_proposal_tool       │
│       ↓                             │
│  Carte Proposition + Simulation     │
│       ↓                             │
│  "Valider et Créer" cliqué          │
│       ↓                             │
│  save_grille_config_tool            │
│  → Grille en base ✅                │
└─────────────────────────────────────┘
```

---

## Règles Importantes

### Ce que l'IA NE FAIT PAS

- Elle ne fait **jamais** les correspondances KPI par elle-même (même si elle pense les connaître).
- Elle n'affiche **jamais** de JSON brut dans le chat.
- Elle ne crée **jamais** une grille sans validation explicite de l'utilisateur.
- Elle ne saute **jamais** une phase, même si les informations suffisent.

### Gestion du multi-tours

Si l'utilisateur modifie la grille après une première proposition :
- L'IA récupère le JSON de la proposition précédente.
- Elle **fusionne** les nouvelles instructions dans ce JSON.
- Elle ne repart PAS de zéro (Phase 1 n'est pas rejouée pour une modification).

### Gestion de l'historique des conversations

- Chaque conversation est sauvegardée en base.
- Une conversation est **verrouillée** après 40 messages (limite de contexte).
- L'utilisateur peut éditer un message passé : l'historique est tronqué à ce point et la conversation repart de là.
- L'IA dispose d'une **mémoire persistante par règle** (notes entre conversations).

---

## Détection de l'État de Phase (Côté Backend)

Le backend détermine automatiquement la phase courante à chaque message, en analysant l'historique :

| Signal détecté dans l'historique | État injecté |
|---|---|
| Aucun KPI confirmé, pas de proposition | `🔴 PHASE 1 NON DÉMARRÉE` — `prepare_grille_proposal_tool` interdit |
| Messages "Pour X, j'utilise le KPI Y" présents | `✅ PHASE 1 COMPLÉTÉE` — passer au récapitulatif |
| Bloc `json_grille_proposal` présent | `🔴 MULTI-TOURS EN COURS` — fusionner et proposer |

Cet état est injecté dans le contexte caché envoyé à l'IA à chaque message. L'IA ne peut donc pas l'ignorer ou le deviner — elle lit son état courant comme un fait.
