# Documentation Architecturale : Moteur de Primes Dynamique et Data-Driven

## Introduction : Objectifs et Philosophie de l'Architecture

### 1. Objectif de la Plateforme
La plateforme a pour objectif d'automatiser le calcul des rémunérations variables (primes et commissions) des collaborateurs. Elle doit permettre aux managers de configurer des grilles d'objectifs sur-mesure basées sur la performance, la qualité et l'assiduité, puis de croiser ces règles avec les données de production pour générer les fiches de paie.

### 2. Contraintes Initiales
Le système précédent souffrait d'un "couplage fort" et de limitations structurelles :
* **Hétérogénéité des sources :** Données en format plat (colonnes) vs format imbriqué (JSON).
* **Dérive des données (*Data Drift*) :** Incohérences de nommage des KPIs entre projets (ex: `booking_nbr` vs `sales_count`, fautes de frappe, problèmes d'encodage).
* **Incompatibilité des échelles :** Des projets évalués sur 100 et d'autres sur 9.
* **Maintenance technique lourde :** L'ajout d'un seul indicateur nécessitait des modifications du schéma de base de données (BigQuery), du code ETL, et du backend applicatif.

### 3. Le Choix Architectural : Le "Metadata-Driven" et l'Approche Hybride
Pour répondre à ces contraintes, l'architecture a été refondue autour de deux principes :
1. **L'abandon du format "Wide" (Colonnes) au profit du format "Long" (Clé-Valeur) :** Le schéma de base de données devient immuable.
2. **Le découplage total Data / Application :** L'ETL est générique et piloté par la métadonnée. L'application (MySQL) gère la sémantique et les calculs, sans intervenir sur l'ingestion brute.

---

## PARTIE I : Traitement et Standardisation de la Donnée (ETL)

L'objectif de cette phase est d'aspirer les données brutes (Couche Bronze) et de les transformer en un format vertical standardisé, sans qu'aucune règle de colonne ne soit codée en dur.

### 1. Le Cerveau de l'ETL : La table de configuration
Le script ETL est universel. Il est piloté par une table de configuration `config_etl_sources` (située dans BigQuery ) qui agit comme un carnet de route.

Cette table indique à l'ETL le chemin de la table source et sa structure :
* `FLAT` : L'ETL utilise un opérateur `UNPIVOT` dynamique pour transformer les colonnes numériques en lignes (Clé-Valeur).
* `JSON` : L'ETL utilise une fonction UDF JavaScript et `UNNEST` pour extraire dynamiquement les clés et valeurs du dictionnaire source.

### 2. Normalisation et Nettoyage à la Volée
Pour pallier la dérive des données et rendre les KPIs exploitables par le moteur de calcul, l'ETL applique un pipeline de nettoyage strict avant l'insertion :

* **Standardisation syntaxique :** Suppression des accents, conversion en majuscules, remplacement des caractères spéciaux par des underscores, et suppression des underscores multiples (SNAKE_CASE strict).
* **Dictionnaire d'Alias (`KPI_ALIASES`) :** Résolution des doublons sémantiques par projet (ex: fusionner `QUALIT_DU_CONSEIL` et `QUALIT_DE_CONSEIL` en une seule clé officielle).
* **Normalisation des Échelles (`SCALE_MAX_PAR_PROJET`) :** Conversion automatique des scores (ex: PVCP_GE noté sur 9) en pourcentage (Base 100) pour garantir une comparabilité absolue dans le moteur de paie.

### 3. Déduplication
En cas de multiples évaluations pour un même agent/jour/critère, le système applique un `MERGE` avec agrégation `AVG()` pour garantir l'unicité de la donnée dans la couche de destination.

---

## PARTIE II : Structuration et Stockage (Architecture Médaillon)

Les données standardisées sont stockées dans Google BigQuery selon une approche "Médaillon", optimisant à la fois le stockage massif et la rapidité de requêtage pour l'application.

### 1. La Couche Silver (Source de Vérité Granulaire)
* **Format :** Table longue (`matricule`, `date`, `projet`, `kpi_code`, `kpi_value`).
* **Rôle :** Historiser l'intégralité des performances et évaluations à la granularité la plus fine (par jour / par appel).
* **Avantage :** Schéma immuable. L'apparition d'un nouveau KPI en production génère simplement de nouvelles lignes.

### 2. La Couche Gold (Les Data Marts Applicatifs)
L'application ne requête jamais la couche Silver directement pour des raisons de performance et de coûts.
* L'ETL génère des tables de synthèse (ex: `paie_performance_mensuelle`).
* Ces tables pré-calculent les sommes et moyennes par agent et par mois.
* **Variable Magique :** Pour les scores de qualité, la couche Gold calcule automatiquement une `MOYENNE_GLOBALE_QUALITE` par agent, en plus de conserver le détail par sous-critère, offrant ainsi une flexibilité maximale pour la création des règles de primes.

---

## PARTIE III : Intégration Plateforme et Logique Métier

Une fois la donnée consolidée dans la couche Gold, l'application (Backend + MySQL) prend le relais pour appliquer la logique métier. MySQL ne stocke plus de mapping technique, mais agit comme un référentiel sémantique.

### 1. Le Dictionnaire Métier (`config_kpis`)
Il permet de séparer le nom technique du nom d'affichage.
* Un administrateur associe le `kpi_code` brut (ex: `IN_CALL_MIN_NBR`) à un libellé métier lisible ("Temps d'attente"). C'est ce libellé qui est affiché aux managers dans l'interface.

### 2. Les KPIs Virtuels (Calculs Dérivés)
Les formules croisées ne sont pas stockées dans l'ETL ni dans BigQuery.
* Si un projet nécessite un indicateur "DMT" (Durée Moyenne de Traitement), un administrateur crée un **KPI Virtuel** dans l'application.
* La formule (ex: `TEMPS_APPEL / NB_APPELS`) est évaluée en mémoire (RAM) par le backend lors du calcul de la paie, en utilisant les briques de base de la couche Gold.

### 3. Le Mapping Organisationnel des Projets
L'interface de mapping ne lie plus des tables et des colonnes. Elle relie un flux de données brut à la hiérarchie RH.
* L'application interroge la couche Gold pour lister les codes projets existants (`SELECT DISTINCT projet`).
* L'interface permet de rattacher ce code à un "Nœud" de la structure (Projet > Business Unit > File > Activité).
* Les managers attachent ensuite leurs grilles de primes à ces nœuds structurels.

---

## PARTIE IV : Intégration de l'Intelligence Artificielle (LLM)

L'architecture Gold et le référentiel sémantique sont conçus pour être "AI-Ready", permettant la génération de grilles de primes via un assistant conversationnel (Text-to-Config).

### 1. Le Rôle de l'Agent IA
L'IA n'a aucun accès en écriture à la base de données. Son rôle strict est de traduire une demande en langage naturel (manager) en une structure de configuration JSON (`grille_objectifs`) compréhensible par le moteur de calcul.

### 2. Injection du Contexte (System Prompt)
Lors d'une requête, le backend injecte dynamiquement le contexte dans le prompt système de l'IA :
* La liste stricte des `code_kpi` autorisés pour le projet sélectionné (obtenue via un `DISTINCT` sur la couche Gold).
* Le schéma JSON exact attendu (Paliers de performance, Malus, Conditions de déclenchement).

### 3. Résolution des Ambiguïtés (Tool Calling)
Si le manager évoque un indicateur absent du référentiel (ex: "Panier moyen ADD-ON"), l'IA utilise un outil applicatif pour le notifier, évitant ainsi les hallucinations de KPIs inexistants. 

### 4. Validation et Calcul
Le JSON généré par l'IA est soumis au backend. Après validation de l'intégrité des clés, il est sauvegardé dans la table `matrice_primes_configs`. Lors de la clôture mensuelle, le moteur de calcul interprète ce JSON et croise les paliers avec les performances réelles de la couche Gold pour générer les variables de paie.