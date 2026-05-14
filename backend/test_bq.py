from config.dw_api_bigquery_connector import get_bigquery_client
client = get_bigquery_client()
for r in client.query("SELECT projet, COUNT(*) as c FROM gcp_my_paie.paie_qualite WHERE date_evaluation >= '2026-05-01' AND date_evaluation <= '2026-05-13' GROUP BY projet").result():
    print(f'{r["projet"]}: {r["c"]}')
