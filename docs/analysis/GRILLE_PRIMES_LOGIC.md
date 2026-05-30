# Logique du Système de Formules (Grilles de Primes)

Ce document détaille l'architecture "Zero-Code", la logique de calcul et le système de génération de formules dynamiques pour les primes d'objectifs.

## 1. Architecture "Zero-Code" (KPIs Dynamiques)

Le système ne repose sur aucun nom de KPI figé dans le code. Les KPIs sont découverts dynamiquement depuis BigQuery.

*   **Suffixes Automatiques** : Pour chaque KPI de performance détecté, le système génère deux variantes :
    *   `{KPI}_sum` : Somme totale sur le mois (ex: CA total, nombre d'appels).
    *   `{KPI}_avg` : Moyenne quotidienne (ex: Note qualité moyenne, DMT moyenne).
*   **Unités & Conversion** : L'IA et le moteur de calcul utilisent les métadonnées pour appliquer les bonnes directions (`higher_better` ou `lower_better`).

---

## 2. Pipeline de Calcul (Ordre d'Exécution)

Le moteur de calcul (`calculation_engine.py`) applique les règles dans un ordre strict pour garantir l'équité et la précision :

| Étape | Action | Logique |
| :--- | :--- | :--- |
| **1** | **Identification** | Récupère le statut de l'agent (Débutant, Confirmé, etc.) pour charger la bonne prime brute et les bonnes cibles. |
| **2** | **Score KPIs** | Calcule l'atteinte de chaque KPI $\rightarrow$ trouve le palier $\rightarrow$ pondère par le poids. |
| **3** | **Prime de base** | `prime_base = prime_brute × (score_global / 100)`. |
| **4** | **Malus Assiduité** | Applique les réductions (ex: -50% pour 1 absence injustifiée). La règle la plus restrictive l'emporte. |
| **5** | **Prorata Présence** | Multiplie par le taux de présence réelle : `prime × (jours_travaillés / jours_ouvrés)`. |
| **6** | **Seuil Minimum** | Si `jours_travaillés < seuil`, la prime est forcée à **0**. |
| **7** | **Bonus Fixes** | Ajoute les primes additionnelles (ex: Prime transport, Challenge ponctuel). |

---

## 3. Détail des Règles de Présence

### A. Prorata "Jours Travaillés"
*   **Référence** : `jours_ouvres` défini dans la grille (par défaut 22).
*   **Réel** : `jours_travailles` extrait de la table d'assiduité (déduction faite des congés et absences).
*   **Formule** : $\text{Taux} = \min\left(\frac{\text{jours\_travaillés}}{\text{jours\_ouvrés\_réf}}, 1.0\right)$.

### B. Malus Assiduité
Configurables à l'étape 6, ils ciblent les compteurs d'assiduité :
*   `abs_injustifie`
*   `retard`
*   `abs_justifie`
*   `cp_css`

---

## 4. Système de Synthèse (Étape 7)

Le système transforme la configuration JSON en deux représentations pour l'utilisateur :

### A. Vue Algorithmique (Pseudo-code)
Traduction littérale de la logique en instructions `SI ... ALORS`. Elle permet aux administrateurs de vérifier l'exactitude technique de la formule avant de l'enregistrer.

### B. Vue Langage Naturel (Prose)
Explication textuelle structurée pour les RH et les managers. Elle humanise les règles complexes (ex: "Le système identifie automatiquement votre niveau...", "Vos absences déduisent votre prime au prorata...").

---

## 5. Persistance et Historique

*   **`formule_lisible`** : Chaque version de grille stocke sa propre "photo" textuelle de la formule dans la base de données.
*   **Versionnage** : Le calcul d'une prime pour un mois passé utilisera toujours la formule de la version de grille qui était active à cette date, garantissant l'intégrité des calculs rétroactifs.

---

## 6. Scripts Clés

*   **Moteur** : `backend/modules/regles_primes/services/calculation_engine.py`
*   **Interface** : `frontend/src/Pages/ReglesPrimes/SubPages/RegleDetail/Onglets/ConfigurationOnglet/Components/GrilleEditorModal/GrilleEditorModal.jsx`
*   **Générateur de Synthèse** : `Steps/Step7Recapitulatif/Step7Recapitulatif.jsx`
