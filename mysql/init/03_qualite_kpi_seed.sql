-- ============================================================
-- Fichier : 03_qualite_kpi_seed.sql
-- Rôle    : Ajout du KPI note_qualite_globale dans config_kpis.
--           Ce KPI est calculé par le BigQuery Silver (paie_qualite)
--           comme la moyenne de tous les kpi_value non-nuls par agent/mois.
-- ============================================================
USE mypaie_config;

INSERT IGNORE INTO config_kpis (code_kpi, libelle, description, univers, type, formule, is_active)
VALUES (
    'note_qualite_globale',
    'Note Qualité Globale',
    'Moyenne de tous les critères qualité évalués pour l''agent sur le mois. Source : BigQuery paie_qualite, AVG(kpi_value). Disponible dans le resolver sous la clé NOTE_QUALITE.',
    'QUALITE',
    'VIRTUAL',
    '[NOTE_QUALITE]',
    1
);
