
USE mypaie_config;
INSERT INTO ref_etl_config (projet, type_projet, source_table, mapping_json, is_active)
VALUES (
    'VENUM_PERFORMANCE', 
    'SERVICE_CLIENT', 
    '\.dataset_venum.venum_data_outils_client_performance', 
    '{
        "schema": {
            "agent_name": "NOM_ASSIGNE",
            "operation": "NULL",
            "sous_projet": "NULL",
            "activite": "NULL",
            "date_import": "IMPORT_DATETIME",
            "week_strategy": "DATE_COLUMN",
            "date_col": "DATE_TICKET"
        },
        "fields": {
            "nb_appels": "$.TICKETS",
            "nb_ventes": "$.TICKETS_RESOLUS",
            "temps_production_min": "$.DURATION",
            "temps_appel_min": "$.TALK_TIME",
            "in_hold_min": "$.WAITING_TIME"
        }
    }',
    TRUE
)
ON DUPLICATE KEY UPDATE mapping_json=VALUES(mapping_json), source_table=VALUES(source_table);
