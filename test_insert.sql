
USE mypaie_config;
INSERT INTO ref_etl_config (projet, type_projet, source_table, mapping_json, is_active)
VALUES (
    'PVCP_PERFORMANCE', 
    'TELEVENTE', 
    '.dataset_pvcp.pvcp_data_outils_client_performance', 
    '{
        "fields": {
            "chiffre_affaire": "$.revenue_amt_eur",
            "nb_ventes": "$.booking_nbr",
            "nb_appels": "$.in_call_nbr",
            "temps_production_min": "$.agent_logged_time_min_nbr",
            "temps_appel_min": "$.in_call_min_nbr",
            "csat_score": "$.total_csat_num",
            "csat_count": "$.csat_nbr",
            "in_hold_min": "$.in_hold_min_nbr"
        },
        "week_field": "$.woy_iso_desc_en",
        "year_code_field": "$.last_or_current_year_code"
    }',
    TRUE
)
ON DUPLICATE KEY UPDATE mapping_json=VALUES(mapping_json), source_table=VALUES(source_table);
