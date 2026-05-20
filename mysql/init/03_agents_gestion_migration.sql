-- ============================================================
-- Fichier : 03_agents_gestion_migration.sql
-- Rôle    : Ajout des colonnes manquantes dans ref_employes
--           et création de la table matrice_primes_agents_gestion.
-- ============================================================
USE mypaie_config;

-- 1. Ajouter id_statut à ref_employes (si absent)
ALTER TABLE ref_employes
    ADD COLUMN IF NOT EXISTS id_statut    INT UNSIGNED NULL
        COMMENT 'Statut agent (FK matrice_statuts)',
    ADD COLUMN IF NOT EXISTS prime_langue TINYINT(1) NOT NULL DEFAULT 0
        COMMENT '1 = prime de langue activée';

-- 2. FK optionnelle id_statut → matrice_statuts
ALTER TABLE ref_employes
    ADD CONSTRAINT IF NOT EXISTS fk_emp_statut
        FOREIGN KEY (id_statut) REFERENCES matrice_statuts(id) ON DELETE SET NULL;

-- 3. Table de gestion des agents par règle de prime
CREATE TABLE IF NOT EXISTS matrice_primes_agents_gestion (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    matrice_id      INT UNSIGNED NOT NULL
                        COMMENT 'Règle de prime concernée',
    agent_matricule VARCHAR(20)  NOT NULL
                        COMMENT 'Matricule agent',
    id_statut       INT UNSIGNED NULL
                        COMMENT 'Surcharge du statut agent pour cette règle',
    sanction        ENUM('Oui', 'Non') NOT NULL DEFAULT 'Non'
                        COMMENT 'Agent sous sanction disciplinaire ce mois-ci',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_matrice_agent (matrice_id, agent_matricule),
    CONSTRAINT fk_ag_matrice  FOREIGN KEY (matrice_id)  REFERENCES matrice_primes(id) ON DELETE CASCADE,
    CONSTRAINT fk_ag_statut   FOREIGN KEY (id_statut)   REFERENCES matrice_statuts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Données de gestion manuelle par agent et par règle de prime';
