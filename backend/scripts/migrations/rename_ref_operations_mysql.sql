-- ============================================================
-- Migration : Rename ref_operations → ref_sous_activite
-- À exécuter sur la base mypaie_config (Docker MySQL)
-- Via phpMyAdmin avec l'utilisateur root (Root2026!)
-- ============================================================

USE mypaie_config;

-- 1. Supprimer les contraintes FK existantes
ALTER TABLE ref_structure_map DROP FOREIGN KEY fk_strmap_operation;
ALTER TABLE ref_employes DROP FOREIGN KEY fk_emp_operation;

-- 2. Renommer la table
RENAME TABLE ref_operations TO ref_sous_activite;

-- 3. Recréer les contraintes FK avec le nouveau nom de table
ALTER TABLE ref_structure_map
    ADD CONSTRAINT fk_strmap_operation
    FOREIGN KEY (id_operation) REFERENCES ref_sous_activite(id) ON DELETE SET NULL;

ALTER TABLE ref_employes
    ADD CONSTRAINT fk_emp_operation
    FOREIGN KEY (id_operation) REFERENCES ref_sous_activite(id) ON DELETE SET NULL;

-- Vérification
SELECT 'Migration terminée : ref_operations renommée en ref_sous_activite' AS statut;
