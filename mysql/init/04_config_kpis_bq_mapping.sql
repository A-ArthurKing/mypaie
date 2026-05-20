-- ============================================================
-- Fichier : 04_config_kpis_bq_mapping.sql
-- Rôle    : Enrichissement de config_kpis avec le lien BigQuery.
--           Ajoute bq_kpi_codes (alias BQ) et bq_aggregation (SUM/AVG)
--           pour permettre un pivot SQL dynamique dans le provider.
-- ============================================================
USE mypaie_config;

-- Ajout des colonnes (idempotent via IF NOT EXISTS via procédure)
SET @col1_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'mypaie_config'
      AND TABLE_NAME = 'config_kpis'
      AND COLUMN_NAME = 'bq_kpi_codes'
);
SET @col2_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'mypaie_config'
      AND TABLE_NAME = 'config_kpis'
      AND COLUMN_NAME = 'bq_aggregation'
);

SET @sql1 = IF(@col1_exists = 0,
    'ALTER TABLE config_kpis ADD COLUMN bq_kpi_codes JSON NULL COMMENT \'Codes kpi_code BigQuery acceptés (ex: ["booking_nbr","nb_ventes"])\'',
    'SELECT 1'
);
SET @sql2 = IF(@col2_exists = 0,
    'ALTER TABLE config_kpis ADD COLUMN bq_aggregation ENUM(\'SUM\',\'AVG\') NOT NULL DEFAULT \'SUM\' COMMENT \'Méthode d aggregation sur valeur_sum (SUM) ou valeur_avg (AVG)\'',
    'SELECT 1'
);

PREPARE stmt1 FROM @sql1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- ============================================================
-- Seed des KPIs PERF existants avec leurs codes BigQuery
-- Ces valeurs correspondent au pivot hardcodé actuel du provider.
-- Avec ce seed, le pivot devient entièrement piloté par MySQL.
-- ============================================================

-- Chiffre d'Affaires / Revenue
UPDATE config_kpis
SET bq_kpi_codes = JSON_ARRAY('net_booking_rental_amt_eur', 'chiffre_affaire', 'revenue_amt_eur'),
    bq_aggregation = 'SUM'
WHERE code_kpi IN ('CHIFFRE_AFFAIRE', 'chiffre_affaire', 'revenue_amt_eur', 'NET_BOOKING_RENTAL_AMT_EUR');

-- Nombre de ventes / Bookings
UPDATE config_kpis
SET bq_kpi_codes = JSON_ARRAY('booking_nbr', 'nb_ventes'),
    bq_aggregation = 'SUM'
WHERE code_kpi IN ('NB_VENTES', 'nb_ventes', 'booking_nbr', 'BOOKING_NBR');

-- Nombre d'appels entrants
UPDATE config_kpis
SET bq_kpi_codes = JSON_ARRAY('in_call_nbr', 'nb_appels'),
    bq_aggregation = 'SUM'
WHERE code_kpi IN ('NB_APPELS', 'nb_appels', 'in_call_nbr', 'IN_CALL_NBR');

-- Temps d'appel (en minutes)
UPDATE config_kpis
SET bq_kpi_codes = JSON_ARRAY('in_call_min_nbr', 'temps_appel'),
    bq_aggregation = 'SUM'
WHERE code_kpi IN ('TEMPS_APPEL', 'temps_appel', 'in_call_min_nbr', 'IN_CALL_MIN_NBR');

-- Temps de production (logged/worked time)
UPDATE config_kpis
SET bq_kpi_codes = JSON_ARRAY('agent_logged_time_min_nbr', 'call_worked_time_min_nbr', 'temps_production'),
    bq_aggregation = 'SUM'
WHERE code_kpi IN ('TEMPS_PRODUCTION', 'temps_production');

-- CSAT (satisfaction client - nombre de cas évalués)
UPDATE config_kpis
SET bq_kpi_codes = JSON_ARRAY('csat_nbr', 'csat'),
    bq_aggregation = 'SUM'
WHERE code_kpi IN ('CSAT', 'csat', 'csat_nbr');

-- Nombre de CSAT (dénominateur)
UPDATE config_kpis
SET bq_kpi_codes = JSON_ARRAY('total_csat_num', 'nb_csat'),
    bq_aggregation = 'SUM'
WHERE code_kpi IN ('NB_CSAT', 'nb_csat', 'total_csat_num');

-- TX MEA (Taux de mise en attente)
UPDATE config_kpis
SET bq_kpi_codes = JSON_ARRAY('tx_mea'),
    bq_aggregation = 'AVG'
WHERE code_kpi IN ('TX_MEA', 'tx_mea');

-- Taux de conversion
UPDATE config_kpis
SET bq_kpi_codes = JSON_ARRAY('taux_conversion', 'is_converted', 'taux_conversion_calc'),
    bq_aggregation = 'AVG'
WHERE code_kpi IN ('TAUX_CONVERSION', 'taux_conversion', 'taux_conversion_calc');
