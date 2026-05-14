from config.dw_api_bigquery_connector import get_bigquery_client
c=get_bigquery_client()
c.query("DELETE FROM data-project-438313.gcp_my_paie.paie_performance WHERE projet='PVCP_PERFORMANCE'").result()
