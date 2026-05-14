from config.dw_api_bigquery_connector import get_bigquery_client; client = get_bigquery_client(); t = client.get_table('gcp_my_paie.paie_performance'); [print(f.name, f.field_type) for f in t.schema]
