# État des Lieux : Pivot vers l'Architecture Dynamique (Zéro Code)

---

## 1. Contexte du Projet

**mypaie** est un système de gestion des primes et performances pour centres d'appel (CRM). Il permet de :
- Créer des **règles de prime** (via une IA conversationnelle ou manuellement) qui définissent les KPIs à atteindre et le calcul de la prime associée.
- Afficher un **tableau de bord** qui montre, pour chaque agent, ses valeurs réelles (RÉEL) face aux objectifs fixés.
- Connecter les données de performance depuis **Google BigQuery** (table Gold `paie_performance_mensuelle`) et les données de qualité depuis une autre source.

**Stack technique** :
- Backend : Flask (Python), port 5001 en Docker
- Base de config : MySQL (`mypaie_config`)
- Source de données : BigQuery, dataset `gcp_my_paie`, table `paie_performance_mensuelle`
- Frontend : React (Vite), tableau de bord dans `TableauDeBordOnglet.jsx`
- IA : Gemini 2.5 Flash, function calling, via `google-genai`

---

## 2. La Contrainte qui a Tout Déclenché

Le tableau de bord affichait **"DONNÉES INCOMPLÈTES (PRIME 0)"** et des tirets "—" pour tous les agents du projet **PVCP-APEN**.

**Cause racine** : Le backend (`dw_api_performance_provider.py`) contient une requête SQL avec des colonnes **hardcodées** (noms BQ écrits en dur) :
```sql
SUM(IF(LOWER(kpi_code) IN ('in_call_min_nbr', 'temps_appel'), ...)) AS sum_temps_appel
AVG(IF(LOWER(kpi_code) IN ('tx_mea'), ...)) AS tx_mea_avg
```
Le projet PVCP utilise des noms BQ différents (`Duration_call`, `Hold_Rate`, `Conversion_Agent`). Ces noms n'étant pas dans les filtres, les données étaient simplement ignorées.

**Premier correctif appliqué (session du 29/05/2026)** : Ajout des codes PVCP en dur + aliases dans le dictionnaire Python + conversions d'unités (x60, x100) en dur dans le code.

**Problème de ce correctif** : C'est encore du "cas par cas". Si un troisième projet arrive avec d'autres noms BQ, on retombe dans le même problème. La table `config_kpis` (MySQL) est VIDE, ce qui signifie qu'il n'y a aucun système de mapping opérationnel.

---

## 3. La Décision : Pourquoi Refactoriser en "Dynamique"

La philosophie retenue est **"Zéro Code Métier dans le Backend"** :

> *Le backend ne doit pas savoir ce qu'est une DMT, un CVR ou un Taux MEA. Il doit simplement récupérer tout ce que BigQuery contient et le transmettre.*

**La logique fonctionnelle** validée par l'utilisateur :
1. Lors de la **création d'une règle de prime**, l'IA présente à l'utilisateur la liste exacte des KPIs disponibles dans BigQuery (noms bruts). Elle fait le lien entre le terme métier ("DMT") et le KPI technique (`Duration_call_avg`).
2. L'utilisateur **valide** ce lien. La règle enregistre la **formule** (ex: `Duration_call_avg * 60`) et non un alias caché.
3. Au moment du **calcul**, le moteur récupère `Duration_call_avg` tel quel depuis le dictionnaire, applique la formule, et affiche le résultat.
4. Le **dashboard** affiche le résultat de la formule calculée. Il n'a plus besoin de chercher une clé spécifique.

**Conséquence** : Le code ne contient plus jamais de liste de noms BQ. Tout est dans la configuration de la règle.

---

## 4. État du Code au Moment de cette Décision (30/05/2026)

| Fichier | État |
| :--- | :--- |
| `dw_api_performance_provider.py` | ⚠️ Partiellement corrigé : codes PVCP ajoutés en dur. **À réécrire complètement (Étape 1).** |
| `calculation_engine.py` | ✅ Correctif appliqué : helper `_get_kpi_value()` insensible à la casse. |
| `kpi_unified_resolver.py` | ⚠️ À vérifier : ne doit pas filtrer les clés dynamiques. |
| `tools.py` → `list_available_kpis_tool()` | ⚠️ Doit exposer les clés `{kpi_code}_avg` / `{kpi_code}_sum` du nouveau provider. |
| `prompts.py` | ⚠️ Brief IA à mettre à jour pour le nouveau comportement de mapping. |
| `TableauDeBordOnglet.jsx` | ⚠️ À adapter pour afficher le résultat de formule calculé par le moteur. |

---

## 5. Problèmes Identifiés et Solutions Décidées

Ce document résume les problèmes identifiés et les solutions universelles décidées pour supprimer le "hardcoding" et rendre le système 100% évolutif.

| Problématique | Solution Décidée | Impact / Bénéfice |
| :--- | :--- | :--- |
| **Colonnes SQL en dur** : Le backend ne cherche que des noms précis (`temps_appel`, etc.). | **Extraction Totale (Wide-Fetch)** : Le SQL récupère TOUTES les lignes de la table Gold pour les matricules concernés sans filtrer par nom. | Tout nouveau KPI dans BigQuery apparaît instantanément dans l'application sans toucher au code. |
| **Guerre des Noms & Unités** : Décalage entre BigQuery (`Duration_call`), l'IA (`DMT`) et le Dashboard. | **Configuration par la Règle (Formules)** : Le mapping et les conversions (ex: x60) se font dans la formule de la règle de prime, pas dans le code. | Transparence totale : l'utilisateur voit et valide la logique ("DMT = Duration_call * 60"). |
| **Aveuglement sur l'Agrégation** : Incertitude entre Somme (Ventes) et Moyenne (DMT) pour les nouveaux KPIs. | **Double Export Automatique** : Le provider envoie systématiquement `KPI_sum` et `KPI_avg` pour chaque indicateur trouvé. | Plus de choix arbitraire dans le code. L'IA ou l'utilisateur choisit la version dont il a besoin dans la règle. |
| **Sensibilité à la Casse** : Erreurs si `dmt` est écrit `DMT` ou `Dmt`. | **Recherche Insensible (Robust Lookup)** : Le moteur de calcul utilise un helper qui cherche la clé en ignorant la casse. | Robustesse technique : élimine les données vides ("—") dues à de simples fautes de frappe. |
| **Maintenance & Scalability** : Chaque nouveau projet nécessite une modification du code backend. | **Backend "Passe-Plat" Brute** : Le backend devient un simple serveur de données brutes. L'intelligence est déportée dans la configuration. | Maintenance proche de zéro. Le système supporte n'importe quel projet CRM/Métier sans redéploiement. |

## Points d'attention pour l'implémentation :
1. **Performance** : S'assurer que l'extraction de "tous" les KPIs ne ralentit pas le dashboard (normalement non, car on reste sur un volume par matricule très faible).
2. **Interface IA** : L'IA doit être briefée pour proposer systématiquement la liaison entre le terme verbalisé (ex: "DMT") et le KPI technique (ex: `Duration_call_avg`).
3. **Dashboard** : Le dashboard doit être capable d'afficher le résultat de la formule finale calculée par le moteur.

---

## Plan d'Implémentation

| Étape | Fichier(s) Concerné(s) | Action | Priorité |
| :---: | :--- | :--- | :---: |
| **1** | `backend/modules/performance/services/dw_api_performance_provider.py` | **Réécriture complète** : Remplacer la requête SQL à colonnes fixes par un `SELECT matricule, kpi_code, valeur_sum, valeur_avg`. Construire le dictionnaire agent en Python avec un double export `{kpi_code}_sum` et `{kpi_code}_avg` pour chaque ligne. Supprimer TOUTES les variables `fixed_columns`, `_fixed_bq_codes`, les alias PVCP ajoutés récemment, et `_load_native_bq_kpi_definitions`. | **1 - Critique** |
| **2** | `backend/modules/regles_primes/services/calculation_engine.py` | **Déjà fait (filet de sécurité)** : La fonction `_get_kpi_value()` avec la recherche insensible à la casse est en place. Vérifier qu'elle couvre bien les nouvelles clés au format `kpi_code_avg`. | **2 - Vérification** |
| **3** | `backend/modules/regles_primes/services/kpi_unified_resolver.py` | **Transmission Brute** : S'assurer que le resolver transmet tel quel le dictionnaire du provider sans filtrer ou renommer les clés dynamiques. | **3 - Contrôle** |
| **4** | `backend/modules/agents/services/ai_engine/tools.py` → `list_available_kpis_tool()` | **Affichage Dynamique** : La liste des KPIs disponibles présentée à l'IA doit exposer les clés `{kpi_code}_avg` et `{kpi_code}_sum` telles qu'elles sortiront du nouveau provider, pour que l'IA propose les bons `metric_key` dans les règles. | **4 - Fonctionnel** |
| **5** | `backend/modules/agents/services/ai_engine/prompts.py` | **Brief IA** : Ajouter une règle indiquant à l'IA qu'elle doit systématiquement : (a) proposer le KPI brut BigQuery correspondant, (b) proposer la formule de conversion si besoin (ex: `Duration_call_avg * 60`), (c) valider avec l'utilisateur avant d'enregistrer. | **5 - Fonctionnel** |
| **6** | `frontend/src/.../TableauDeBordOnglet.jsx` | **Affichage du résultat de formule** : Le dashboard doit afficher la valeur calculée par le moteur (valeur finale après application de la formule), et non plus chercher une clé figée dans le dictionnaire KPI. | **6 - Frontend** |

### Ordre d'exécution recommandé :
```
Étape 1 (Provider) → Étape 2 (Vérif Moteur) → Étape 3 (Resolver) → Test Backend Complet
→ Étape 4 (tools.py) → Étape 5 (prompts.py) → Test IA
→ Étape 6 (Frontend) → Test End-to-End
```

### Critères de "Done" (Validation finale) :
- [x] Un nouveau projet avec des KPIs inconnus remonte **automatiquement** sur le dashboard sans modification du code.
- [x] La règle de prime créée par l'IA contient une **formule lisible** (ex: `Duration_call_avg * 60`) et non un alias caché.
- [x] Aucune liste de noms BQ n'existe dans le code Python ou SQL du provider.
- [x] Les tests sur agents PVCP (9701, 12524) et agents d'un autre projet fonctionnent simultanément.

---
*Ce fichier est temporaire et sert de base de validation avant le début des travaux.*
