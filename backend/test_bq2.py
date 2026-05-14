from config.dw_api_bigquery_connector import get_bigquery_client
client = get_bigquery_client()
for r in client.query("SELECT projet, MIN(date_evaluation) as min_d, MAX(date_evaluation) as max_d, COUNT(*) as c FROM gcp_my_paie.paie_qualite WHERE projet LIKE '%PVCP BE%' GROUP BY projet").result():
    print(f'{r["projet"]}: {r["c"]} evals du {r["min_d"]} au {r["max_d"]}')
