-- ============================================================
-- Fichier : 00_schema.sql
-- Rôle    : Initialisation de la base mypaie_config.
--           Crée les tables du moteur de calcul des primes
--           et insère les données de référence (KPIs, statuts).
-- Module  : mypaie / mysql / init
-- ============================================================
-- Assurer l'encodage UTF-8 strict
SET
    NAMES utf8mb4;

SET
    CHARACTER
SET
    utf8mb4;

-- Utiliser la base crÃ©Ã©e automatiquement par Docker
USE mypaie_config;

-- ============================================================
-- TABLE : matrice_statuts
-- Rôle  : Types de contrats / statuts des agents
-- ============================================================
CREATE TABLE
    IF NOT EXISTS matrice_statuts (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(20) NOT NULL UNIQUE COMMENT 'Code court (CDI, CDD, STAGE...)',
        libelle VARCHAR(100) NOT NULL,
        description TEXT,
        actif TINYINT (1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================
-- TABLE : matrice_kpis
-- Rôle  : Définition des KPIs utilisables dans les matrices
-- ============================================================
CREATE TABLE
    IF NOT EXISTS matrice_kpis (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(30) NOT NULL UNIQUE COMMENT 'Code technique (CSAT, CONV, CA...)',
        libelle VARCHAR(100) NOT NULL,
        unite VARCHAR(20) COMMENT 'Unité de mesure (%, EUR, appels...)',
        univers ENUM ('PERF', 'QUALITE', 'HEURES') NOT NULL DEFAULT 'PERF',
        tech_key VARCHAR(50) NULL COMMENT 'Clé technique dans le DW',
        description TEXT,
        actif TINYINT (1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================
-- TABLE : matrice_primes
-- Rôle  : Matrices de primes (une par projet/opération/période)
-- ============================================================
CREATE TABLE
    IF NOT EXISTS matrice_primes (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(30) NOT NULL UNIQUE COMMENT 'Identifiant métier unique',
        libelle VARCHAR(200) NOT NULL,
        projet VARCHAR(100) NOT NULL COMMENT 'Projet ou client concerné',
        operation VARCHAR(100) COMMENT 'Opération spécifique (NULL = toutes)',
        periodicite VARCHAR(20) DEFAULT 'mensuelle',
        description TEXT,
        description_kpi TEXT COMMENT 'Description des KPIs de la règle',
        statut_id INT UNSIGNED COMMENT 'Statut agent ciblé (NULL = tous)',
        periode_debut DATE NOT NULL COMMENT 'Début de validité de la matrice',
        periode_fin DATE COMMENT 'Fin de validité (NULL = illimitée)',
        actif TINYINT (1) NOT NULL DEFAULT 1,
        -- JSON libre stockant toute la configuration du moteur de calcul :
        -- postes[], paliers_scoring[], config_temps{}, indicateurs[],
        -- regles_assiduite[], declencheurs[]
        grille_objectifs JSON NULL COMMENT 'Configuration complète du moteur de calcul (JSON)',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_matrice_statut FOREIGN KEY (statut_id) REFERENCES matrice_statuts (id) ON DELETE SET NULL
    ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================
-- TABLE : matrice_objectifs
-- Rôle  : Objectifs KPI associés à chaque matrice
-- ============================================================
CREATE TABLE
    IF NOT EXISTS matrice_objectifs (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        matrice_id INT UNSIGNED NOT NULL,
        kpi_id INT UNSIGNED NOT NULL,
        objectif_valeur DECIMAL(10, 2) NOT NULL COMMENT 'Valeur cible du KPI',
        poids DECIMAL(5, 2) NOT NULL DEFAULT 1.00 COMMENT 'Poids dans la note globale (1 = neutre)',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_obj_matrice FOREIGN KEY (matrice_id) REFERENCES matrice_primes (id) ON DELETE CASCADE,
        CONSTRAINT fk_obj_kpi FOREIGN KEY (kpi_id) REFERENCES matrice_kpis (id) ON DELETE RESTRICT,
        UNIQUE KEY uq_matrice_kpi (matrice_id, kpi_id)
    ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================
-- TABLE : matrice_paliers
-- Rôle  : Paliers de primes selon la note globale (0-100)
-- ============================================================
CREATE TABLE
    IF NOT EXISTS matrice_paliers (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        matrice_id INT UNSIGNED NOT NULL,
        libelle VARCHAR(100) COMMENT 'Nom du palier (Bronze, Silver, Gold...)',
        note_min DECIMAL(5, 2) NOT NULL COMMENT 'Note minimale (incluse)',
        note_max DECIMAL(5, 2) NOT NULL COMMENT 'Note maximale (incluse)',
        prime_montant DECIMAL(10, 2) NOT NULL COMMENT 'Montant de la prime (EUR)',
        prime_type ENUM ('fixe', 'pourcentage') NOT NULL DEFAULT 'fixe' COMMENT 'fixe = EUR brut ; pourcentage = % du salaire de base',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_palier_matrice FOREIGN KEY (matrice_id) REFERENCES matrice_primes (id) ON DELETE CASCADE,
        CONSTRAINT chk_palier_bornes CHECK (
            note_min >= 0
            AND note_max <= 100
            AND note_min < note_max
        )
    ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================
-- TABLE : matrice_kpis_mapping
-- Rôle  : Correspondance entre colonnes BigQuery et KPIs Standards
-- ============================================================
CREATE TABLE
    IF NOT EXISTS matrice_kpis_mapping (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        univers ENUM ('PERF', 'QUALITE', 'HEURES') NOT NULL,
        source_table VARCHAR(200) NOT NULL COMMENT 'Table/Vue dans BigQuery',
        source_column VARCHAR(100) NOT NULL COMMENT 'Nom technique de la colonne',
        standard_kpi_code VARCHAR(30) NOT NULL COMMENT 'Code standard (DMT, CONV, etc.)',
        id_projet INT UNSIGNED NULL COMMENT 'ID du projet (NULL = Global / Tous les projets)',
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_source_scoped (source_table, source_column, univers, id_projet)
    ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================
-- DONNÉES DE RÉFÉRENCE : KPIs standards
-- ============================================================
INSERT INTO
    matrice_kpis (
        code,
        libelle,
        unite,
        univers,
        tech_key,
        description
    )
VALUES
    (
        'CSAT',
        'Satisfaction Client',
        '%',
        'QUALITE',
        'csat_moyen',
        'Score moyen de satisfaction client sur la période'
    ),
    (
        'CONV',
        'Taux de Conversion',
        '%',
        'PERF',
        'taux_conversion_calc',
        'Ratio ventes / appels entrants'
    ),
    (
        'CA',
        'Chiffre d''Affaires',
        'EUR',
        'PERF',
        'chiffre_affaire',
        'Total du chiffre d''affaires généré'
    ),
    (
        'APPELS',
        'Nombre d''Appels',
        'appels',
        'PERF',
        'in_call_nbr',
        'Volume total d''appels traités'
    ),
    (
        'DMT',
        'Durée Moyenne de Traitement',
        'min',
        'PERF',
        'dmt',
        'Temps moyen de traitement par appel'
    ),
    (
        'LOGGED',
        'Heures Loguées',
        'h',
        'HEURES',
        'logged_min',
        'Nombre d''heures effectivement loguées'
    ) ON DUPLICATE KEY
UPDATE libelle =
VALUES
    (libelle),
    unite =
VALUES
    (unite),
    univers =
VALUES
    (univers),
    tech_key =
VALUES
    (tech_key);

-- ============================================================
-- DONNÉES DE RÉFÉRENCE : Statuts agents
-- ============================================================
INSERT INTO
    matrice_statuts (code, libelle)
VALUES
    ('CDI', 'CDI — Contrat à Durée Indéterminée'),
    ('CDD', 'CDD — Contrat à Durée Déterminée'),
    ('STAGE', 'Stage'),
    ('INTER', 'Intérimaire'),
    ('PRESTA', 'Prestataire Externe') ON DUPLICATE KEY
UPDATE libelle =
VALUES
    (libelle);