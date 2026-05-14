-- ============================================================
-- MIGRATION : Intégration VENUM — semaine depuis date, matricule normalisé
-- ============================================================

-- 1. Nouveaux champs dans ref_etl_config
ALTER TABLE ref_etl_config
  ADD COLUMN week_source      ENUM('metrics_json','date_column') NOT NULL DEFAULT 'metrics_json'
                              COMMENT 'Source de calcul de la semaine ISO',
  ADD COLUMN date_ref_field   VARCHAR(100) NULL
                              COMMENT 'Colonne BQ date directe si week_source=date_column',
  ADD COLUMN matricule_expr   VARCHAR(200) NULL
                              COMMENT 'Expression SQL pour normaliser MATRICULE (NULL = colonne brute)';

-- 2. PVCP : week_source par défaut déjà bon, juste ajouter matricule_expr
UPDATE ref_etl_config SET
  week_source    = 'metrics_json',
  matricule_expr = NULL
WHERE projet = 'PVCP_PERFORMANCE';

-- 3. VENUM : semaine depuis DATE_TICKET, MATRICULE à nettoyer, CANAL dans METRICS
UPDATE ref_etl_config SET
  week_source       = 'date_column',
  date_ref_field    = 'DATE_TICKET',
  matricule_expr    = 'REGEXP_REPLACE(MATRICULE, r''\\.0$'', '''')',
  op_field          = '$.CANAL_DU_TICKET'
WHERE projet = 'VENUM_PERFORMANCE';

-- 4. Mapping KPIs VENUM dans matrice_kpis_mapping
DELETE FROM matrice_kpis_mapping
  WHERE source_table = 'dataset_venum.venum_data_outils_client_performance';

INSERT INTO matrice_kpis_mapping
  (univers, source_table, source_column, standard_kpi_code, dest_table, dest_column, data_type, is_helper, is_formula, description)
VALUES
  -- Directs
  ('PERF',   'dataset_venum.venum_data_outils_client_performance', '$.TICKETS',          'APPELS',     'paie_performance_tv', 'nb_appels',   'INT',   0, 0, 'Nombre de contacts (tickets)'),
  ('PERF',   'dataset_venum.venum_data_outils_client_performance', '$.TICKETS_RESOLUS',  'NB_VENTES',  'paie_performance_tv', 'nb_ventes',   'INT',   0, 0, 'Tickets résolus (acte métier SC)'),
  ('HEURES', 'dataset_venum.venum_data_outils_client_performance', '$.DURATION',         'TEMPS_APPEL','paie_performance_tv', 'temps_appel', 'FLOAT', 0, 0, 'Durée traitement ticket (min)'),
  -- Helpers
  ('PERF',   'dataset_venum.venum_data_outils_client_performance', '$.WAITING_TIME',     'TX_MEA',      NULL,                 'in_hold_min', 'FLOAT', 1, 0, 'Temps attente ticket (helper tx_mea)'),
  -- Formulas
  ('PERF',   'dataset_venum.venum_data_outils_client_performance', NULL,                 'TX_MEA',      'paie_performance_tv','tx_mea',      'FLOAT', 0, 1, 'Taux mise en attente SC'),
  ('PERF',   'dataset_venum.venum_data_outils_client_performance', NULL,                 'TAUX_CONV',   'paie_performance_tv','taux_conversion','FLOAT', 0, 1, 'Taux résolution SC');

UPDATE matrice_kpis_mapping
  SET formula = 'SAFE_DIVIDE(SUM(in_hold_min), NULLIF(SUM(temps_appel), 0)) * 100'
  WHERE source_table = 'dataset_venum.venum_data_outils_client_performance'
    AND standard_kpi_code = 'TX_MEA' AND is_formula = 1;

UPDATE matrice_kpis_mapping
  SET formula = 'SAFE_DIVIDE(SUM(nb_ventes), NULLIF(SUM(nb_appels), 0))'
  WHERE source_table = 'dataset_venum.venum_data_outils_client_performance'
    AND standard_kpi_code = 'TAUX_CONV' AND is_formula = 1;
