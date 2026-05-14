-- ============================================================
-- MIGRATION : Iteration 1+2 — matrice_kpis_mapping + champs structurels
-- ============================================================

-- 1. Colonnes matrice_kpis_mapping
ALTER TABLE matrice_kpis_mapping
  ADD COLUMN dest_table   VARCHAR(100) NULL      COMMENT 'Table BQ destination (ex: paie_performance_tv)',
  ADD COLUMN dest_column  VARCHAR(100) NULL      COMMENT 'Colonne BQ destination (NULL si helper)',
  ADD COLUMN data_type    ENUM('FLOAT','INT','BOOL','DURATION_MIN','PERCENT') NOT NULL DEFAULT 'FLOAT',
  ADD COLUMN is_helper    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '1 = colonne intermediaire pour formule, non stockee en BQ';

-- 2. Colonnes ref_etl_config
ALTER TABLE ref_etl_config
  ADD COLUMN snapshot_date_expr  VARCHAR(200) NULL COMMENT 'Expression BQ pour la date snapshot',
  ADD COLUMN agent_field         VARCHAR(100) NULL COMMENT 'Colonne nom agent',
  ADD COLUMN op_field            VARCHAR(100) NULL COMMENT 'Colonne OPERATION (NULL si absent)',
  ADD COLUMN file_field          VARCHAR(100) NULL COMMENT 'Colonne FILE/sous_projet (NULL si absent)',
  ADD COLUMN activite_field      VARCHAR(100) NULL COMMENT 'Colonne ACTIVITE (NULL si absent)',
  ADD COLUMN week_field          VARCHAR(100) NULL COMMENT 'JSON path semaine dans METRICS',
  ADD COLUMN year_code_field     VARCHAR(100) NULL COMMENT 'JSON path annee dans METRICS';

-- 3. Nouveaux KPIs standards
INSERT INTO matrice_kpis (code, libelle, unite, univers, tech_key, description, actif) VALUES
  ('NB_VENTES',  'Nombre de Ventes',      'ventes',   'PERF',   'nb_ventes',       'Total des ventes/bookings realises', 1),
  ('TEMPS_PROD', 'Temps de Production',   'min',      'HEURES', 'temps_production', 'Temps total en production (min)', 1),
  ('TEMPS_APPEL','Temps d''Appel',        'min',      'HEURES', 'temps_appel',      'Temps total en appel (min)', 1),
  ('NB_CSAT',    'Volume CSAT',           'sondages', 'QUALITE','nb_csat',          'Nombre de sondages CSAT recus', 1),
  ('TX_MEA',     'Taux Mise en Attente',  '%',        'PERF',   'tx_mea',           'Temps attente / Temps appel x100', 1),
  ('TAUX_CONV',  'Taux de Conversion',    '%',        'PERF',   'taux_conversion',  'Ventes / Appels', 1)
ON DUPLICATE KEY UPDATE libelle = VALUES(libelle), tech_key = VALUES(tech_key);

-- 4. Peuplement matrice_kpis_mapping pour PVCP (idempotent: delete + insert)
DELETE FROM matrice_kpis_mapping WHERE source_table = 'dataset_pvcp.pvcp_data_outils_client_performance';

INSERT INTO matrice_kpis_mapping
  (univers, source_table, source_column, standard_kpi_code, dest_table, dest_column, data_type, is_helper, is_formula, description)
VALUES
  ('PERF',   'dataset_pvcp.pvcp_data_outils_client_performance', '$.in_call_nbr',               'APPELS',     'paie_performance_tv', 'nb_appels',        'INT',   0, 0, 'Nombre d appels entrants'),
  ('PERF',   'dataset_pvcp.pvcp_data_outils_client_performance', '$.booking_nbr',               'NB_VENTES',  'paie_performance_tv', 'nb_ventes',        'INT',   0, 0, 'Nombre de ventes/bookings'),
  ('PERF',   'dataset_pvcp.pvcp_data_outils_client_performance', '$.revenue_amt_eur',           'CA',          'paie_performance_tv', 'chiffre_affaire',  'FLOAT', 0, 0, 'Chiffre affaires EUR'),
  ('HEURES', 'dataset_pvcp.pvcp_data_outils_client_performance', '$.in_call_min_nbr',           'TEMPS_APPEL', 'paie_performance_tv', 'temps_appel',      'FLOAT', 0, 0, 'Temps en appel (min)'),
  ('HEURES', 'dataset_pvcp.pvcp_data_outils_client_performance', '$.agent_logged_time_min_nbr', 'TEMPS_PROD',  'paie_performance_tv', 'temps_production', 'FLOAT', 0, 0, 'Temps production (min)'),
  ('QUALITE','dataset_pvcp.pvcp_data_outils_client_performance', '$.csat_nbr',                  'NB_CSAT',     'paie_performance_tv', 'nb_csat',          'INT',   0, 0, 'Nombre sondages CSAT'),
  ('QUALITE','dataset_pvcp.pvcp_data_outils_client_performance', '$.total_csat_num',            'CSAT',        NULL,                  'csat_score',       'FLOAT', 1, 0, 'Numerateur CSAT brut (helper)'),
  ('PERF',   'dataset_pvcp.pvcp_data_outils_client_performance', '$.in_hold_min_nbr',           'TX_MEA',      NULL,                  'in_hold_min',      'FLOAT', 1, 0, 'Minutes attente (helper)'),
  ('QUALITE','dataset_pvcp.pvcp_data_outils_client_performance', NULL,                          'CSAT',        'paie_performance_tv', 'csat',             'FLOAT', 0, 1, 'Score CSAT pondere'),
  ('PERF',   'dataset_pvcp.pvcp_data_outils_client_performance', NULL,                          'TX_MEA',      'paie_performance_tv', 'tx_mea',           'FLOAT', 0, 1, 'Taux mise en attente'),
  ('PERF',   'dataset_pvcp.pvcp_data_outils_client_performance', NULL,                          'TAUX_CONV',   'paie_performance_tv', 'taux_conversion',  'FLOAT', 0, 1, 'Taux de conversion');

UPDATE matrice_kpis_mapping
  SET formula = 'SAFE_DIVIDE(SUM(csat_score), NULLIF(SUM(nb_csat), 0))'
  WHERE source_table = 'dataset_pvcp.pvcp_data_outils_client_performance'
    AND standard_kpi_code = 'CSAT' AND is_formula = 1;

UPDATE matrice_kpis_mapping
  SET formula = 'SAFE_DIVIDE(SUM(in_hold_min), NULLIF(SUM(temps_appel), 0)) * 100'
  WHERE source_table = 'dataset_pvcp.pvcp_data_outils_client_performance'
    AND standard_kpi_code = 'TX_MEA' AND is_formula = 1;

UPDATE matrice_kpis_mapping
  SET formula = 'SAFE_DIVIDE(SUM(nb_ventes), NULLIF(SUM(nb_appels), 0))'
  WHERE source_table = 'dataset_pvcp.pvcp_data_outils_client_performance'
    AND standard_kpi_code = 'TAUX_CONV' AND is_formula = 1;

-- 5. Champs structurels PVCP
UPDATE ref_etl_config SET
  snapshot_date_expr = 'date_importation',
  agent_field        = 'Nom_de_l_agent',
  op_field           = 'OPERATION',
  file_field         = 'FILE',
  activite_field     = 'ACTIVITE',
  week_field         = '$.woy_iso_desc_en',
  year_code_field    = '$.last_or_current_year_code'
WHERE projet = 'PVCP_PERFORMANCE';

-- 6. Champs structurels VENUM (fix crash date_importation)
UPDATE ref_etl_config SET
  snapshot_date_expr = 'TIMESTAMP(IMPORT_DATETIME)',
  agent_field        = 'NOM_ASSIGNE',
  op_field           = NULL,
  file_field         = NULL,
  activite_field     = NULL,
  week_field         = '$.woy_iso_desc_en',
  year_code_field    = '$.last_or_current_year_code'
WHERE projet = 'VENUM_PERFORMANCE';

-- 7. mapping_json PVCP : vider (remplace par matrice_kpis_mapping)
UPDATE ref_etl_config SET mapping_json = '{}' WHERE projet = 'PVCP_PERFORMANCE';
