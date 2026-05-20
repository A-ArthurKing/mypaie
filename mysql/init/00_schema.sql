-- ============================================================
-- Fichier : 00_schema.sql
-- Rôle    : Initialisation de la base mypaie_config.
--           Crée toutes les tables du moteur de calcul des primes,
--           les tables de référence structurelles et les données de seed.
-- Module  : mypaie / mysql / init
-- ============================================================
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

USE mypaie_config;

-- ============================================================
-- TABLE : matrice_statuts
-- Rôle  : Types de contrats / statuts des agents
-- ============================================================
CREATE TABLE IF NOT EXISTS matrice_statuts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE COMMENT 'Code court (CDI, CDD, STAGE...)',
    libelle VARCHAR(100) NOT NULL,
    description TEXT,
    actif TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLES DE RéFéRENCE STRUCTURELLES
-- Ordre : projets ? operations ? files ? activites ? structure_map
-- ============================================================

CREATE TABLE IF NOT EXISTS ref_projets (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(200) NOT NULL,
    code VARCHAR(50) NULL UNIQUE,
    actif TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ref_operations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    libelle VARCHAR(200) NOT NULL UNIQUE,
    actif TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ref_sous_projet (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    libelle VARCHAR(100) NOT NULL UNIQUE,
    actif TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ref_activites (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    libelle VARCHAR(100) NOT NULL UNIQUE,
    actif TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE : ref_structure_map
-- Rôle  : Combinaison unique projet/opération/file/activité
--         Sert de "clé structurelle" pour agents et régles
-- ============================================================
CREATE TABLE IF NOT EXISTS ref_structure_map (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_projet    INT UNSIGNED NOT NULL,
    id_operation INT UNSIGNED NULL,
    id_sous_projet      INT UNSIGNED NULL,
    id_activite  INT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_structure (id_projet, id_operation, id_sous_projet, id_activite),
    CONSTRAINT fk_strmap_projet    FOREIGN KEY (id_projet)    REFERENCES ref_projets(id)    ON DELETE CASCADE,
    CONSTRAINT fk_strmap_operation FOREIGN KEY (id_operation) REFERENCES ref_operations(id) ON DELETE SET NULL,
    CONSTRAINT fk_strmap_file      FOREIGN KEY (id_sous_projet)      REFERENCES ref_sous_projet(id)      ON DELETE SET NULL,
    CONSTRAINT fk_strmap_activite  FOREIGN KEY (id_activite)  REFERENCES ref_activites(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE : ref_employes
-- Rôle  : Référentiel local des agents (enrichissement SIRH)
-- ============================================================
CREATE TABLE IF NOT EXISTS ref_employes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    matricule    VARCHAR(20) NOT NULL UNIQUE,
    nom          VARCHAR(100) NOT NULL,
    prenom       VARCHAR(100) NOT NULL,
    id_operation INT UNSIGNED NULL,
    id_sous_projet      INT UNSIGNED NULL,
    id_activite  INT UNSIGNED NULL,
    id_structure INT UNSIGNED NULL,
    actif        TINYINT(1) NOT NULL DEFAULT 1,
    statut       VARCHAR(50) DEFAULT 'Débutant',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_emp_operation FOREIGN KEY (id_operation) REFERENCES ref_operations(id)    ON DELETE SET NULL,
    CONSTRAINT fk_emp_file      FOREIGN KEY (id_sous_projet)      REFERENCES ref_sous_projet(id)         ON DELETE SET NULL,
    CONSTRAINT fk_emp_activite  FOREIGN KEY (id_activite)  REFERENCES ref_activites(id)     ON DELETE SET NULL,
    CONSTRAINT fk_emp_structure FOREIGN KEY (id_structure) REFERENCES ref_structure_map(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE : ref_projets_mapping
-- Rôle  : Correspondance nom brut BigQuery ? ref_projets
--         Utilisé par le provider performance pour résoudre les noms
-- ============================================================
CREATE TABLE IF NOT EXISTS ref_projets_mapping (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    source_name VARCHAR(200) NOT NULL COMMENT 'Nom brut dans la source (BigQuery)',
    id_projet   INT UNSIGNED NOT NULL,
    id_sous_projet     INT UNSIGNED NULL,
    id_activite INT UNSIGNED NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_project_source (source_name),
    CONSTRAINT fk_pmap_projet   FOREIGN KEY (id_projet)   REFERENCES ref_projets(id)   ON DELETE CASCADE,
    CONSTRAINT fk_pmap_file     FOREIGN KEY (id_sous_projet)     REFERENCES ref_sous_projet(id)     ON DELETE SET NULL,
    CONSTRAINT fk_pmap_activite FOREIGN KEY (id_activite) REFERENCES ref_activites(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE : matrice_primes
-- Rôle  : Matrices de primes (une par structure/période)
-- ============================================================
CREATE TABLE IF NOT EXISTS matrice_primes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code        VARCHAR(30) NOT NULL UNIQUE COMMENT 'Identifiant métier unique',
    libelle     VARCHAR(200) NOT NULL,
    id_structure INT UNSIGNED NULL COMMENT 'Lien vers ref_structure_map (NULL = global)',
    sirh_filtre VARCHAR(100) NULL COMMENT 'Filtre SIRH optionnel (statut, équipe...)',
    periodicite VARCHAR(20) DEFAULT 'mensuelle',
    description TEXT,
    description_kpi TEXT COMMENT 'Description des KPIs de la régle',
    statut_id   INT UNSIGNED COMMENT 'Statut agent ciblé (NULL = tous)',
    periode_debut DATE NOT NULL COMMENT 'Début de validité de la matrice',
    periode_fin DATE COMMENT 'Fin de validité (NULL = illimitée)',
    actif TINYINT(1) NOT NULL DEFAULT 1,
    grille_objectifs JSON NULL COMMENT 'Configuration compléte du moteur de calcul (JSON)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_matrice_statut    FOREIGN KEY (statut_id)    REFERENCES matrice_statuts(id)    ON DELETE SET NULL,
    CONSTRAINT fk_prime_structure   FOREIGN KEY (id_structure) REFERENCES ref_structure_map(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE : matrice_primes_configs
-- Rôle  : Versions de grilles d'objectifs par régle
-- ============================================================
CREATE TABLE IF NOT EXISTS matrice_primes_configs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    matrice_id   INT UNSIGNED NOT NULL,
    libelle      VARCHAR(200) NOT NULL,
    content      JSON NOT NULL,
    est_active   TINYINT(1) NOT NULL DEFAULT 0,
    grille_uuid  VARCHAR(50) NULL,
    grille_nom   VARCHAR(200) NULL,
    grille_ordre INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_config_matrice FOREIGN KEY (matrice_id) REFERENCES matrice_primes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE : matrice_paliers
-- Rôle  : Paliers de primes selon la note globale (0-100)
-- ============================================================
CREATE TABLE IF NOT EXISTS matrice_paliers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    matrice_id   INT UNSIGNED NOT NULL,
    libelle      VARCHAR(100) COMMENT 'Nom du palier (Bronze, Silver, Gold...)',
    note_min     DECIMAL(5,2) NOT NULL COMMENT 'Note minimale (incluse)',
    note_max     DECIMAL(5,2) NOT NULL COMMENT 'Note maximale (incluse)',
    prime_montant DECIMAL(10,2) NOT NULL COMMENT 'Montant de la prime (EUR)',
    prime_type   ENUM('fixe','pourcentage') NOT NULL DEFAULT 'fixe',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_palier_matrice FOREIGN KEY (matrice_id) REFERENCES matrice_primes(id) ON DELETE CASCADE,
    CONSTRAINT chk_palier_bornes CHECK (note_min >= 0 AND note_max <= 100 AND note_min < note_max)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE : ai_conversations et ai_messages
-- Rôle  : Historique des chats avec l'assistant IA
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_conversations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    regle_id INT UNSIGNED NOT NULL,
    titre VARCHAR(255) DEFAULT 'Nouvelle conversation',
    is_locked TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_conv_regle FOREIGN KEY (regle_id) REFERENCES matrice_primes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT UNSIGNED NOT NULL,
    sender ENUM('user', 'bot') NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_msg_conv FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- DONNéES DE RéFéRENCE : Statuts agents
-- ============================================================
INSERT INTO matrice_statuts (code, libelle)
VALUES
    ('CDI',   'CDI é Contrat é Durée Indéterminée'),
    ('CDD',   'CDD é Contrat é Durée Déterminée'),
    ('STAGE', 'Stage'),
    ('INTER', 'Intérimaire'),
    ('PRESTA','Prestataire Externe')
ON DUPLICATE KEY UPDATE libelle = VALUES(libelle);


CREATE TABLE IF NOT EXISTS ref_etl_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    projet              VARCHAR(100)  NOT NULL,
    type_projet         VARCHAR(100),
    source_table        VARCHAR(255)  NOT NULL,
    mapping_json        JSON          NOT NULL DEFAULT ('{}'),
    snapshot_date_expr  VARCHAR(200)  NULL COMMENT 'Expression BQ pour la date snapshot',
    agent_field         VARCHAR(100)  NULL COMMENT 'Colonne nom agent',
    op_field            VARCHAR(100)  NULL COMMENT 'Colonne OPERATION ou JSON path $.xxx (NULL si absent)',
    file_field          VARCHAR(100)  NULL COMMENT 'Colonne FILE/sous_projet (NULL si absent)',
    activite_field      VARCHAR(100)  NULL COMMENT 'Colonne ACTIVITE (NULL si absent)',
    week_field          VARCHAR(100)  NULL COMMENT 'JSON path semaine dans METRICS',
    year_code_field     VARCHAR(100)  NULL COMMENT 'JSON path annee dans METRICS',
    week_source         ENUM('metrics_json','date_column') NOT NULL DEFAULT 'metrics_json'
                        COMMENT 'Source de calcul de la semaine ISO',
    date_ref_field      VARCHAR(100)  NULL COMMENT 'Colonne BQ date si week_source=date_column',
    matricule_expr      VARCHAR(200)  NULL COMMENT 'Expression SQL pour normaliser MATRICULE',
    is_active           BOOLEAN       DEFAULT TRUE,
    created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY (projet)
);

-- ============================================================
-- TABLE : app_users
-- Rôle  : Utilisateurs de la plateforme (RBAC)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    role ENUM('Collaborateur', 'Manager', 'Gestionnaire Paie', 'Super Administrateur') NOT NULL DEFAULT 'Collaborateur',
    actif TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE : config_kpis
-- Rôle  : Référentiel des indicateurs (Dictionnaire)
--         Supporte les KPIs Natifs (BigQuery) et Virtuels (Formules)
-- ============================================================
CREATE TABLE IF NOT EXISTS config_kpis (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code_kpi VARCHAR(50) NOT NULL UNIQUE,
    libelle VARCHAR(100) NOT NULL,
    description TEXT DEFAULT NULL,
    univers ENUM('PERF', 'QUALITE', 'HEURES') NOT NULL,
    type ENUM('NATIVE', 'VIRTUAL') DEFAULT 'NATIVE',
    formule TEXT DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
