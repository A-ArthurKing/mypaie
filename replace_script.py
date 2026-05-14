# -*- coding: utf-8 -*-
import re

with open('backend/workers/etl_paie_performance.py', 'r', encoding='utf-8') as f:
    text = f.read()

new_func = '''def parse_mysql_kpi_mapping(base_fields: dict) -> dict:
    # Construit les expressions SQL JSON_EXTRACT_SCALAR a partir du mapping MySQL.
    parsed_fields = {}
    for k, v in base_fields.items():
        if not v: continue
        if "," in v:
            sources = [s.strip() for s in v.split(",") if s.strip()]
            extracts = [f"JSON_EXTRACT_SCALAR(METRICS, '{s}')" if s.startswith("$.") else f"'{s}'" for s in sources]
            parsed_fields[k] = f"COALESCE({', '.join(extracts)})"
        else:
            v_strip = v.strip()
            if v_strip.startswith("$."):
                parsed_fields[k] = f"JSON_EXTRACT_SCALAR(METRICS, '{v_strip}')"
            else:
                parsed_fields[k] = v_strip
    return parsed_fields
'''

text = re.sub(r'(?s)def get_dynamic_kpi_mapping.*?(?=# #region ETL CORE)', new_func + '\n', text)
text = text.replace('f = get_dynamic_kpi_mapping(client, cfg["fields"])', 'f = parse_mysql_kpi_mapping(cfg["fields"])')

with open('backend/workers/etl_paie_performance.py', 'w', encoding='utf-8') as f:
    f.write(text)
