import sys; sys.path.insert(0, "/app")
from core.db.bigquery import get_bigquery_client
c = get_bigquery_client()
q = "SELECT projet, COUNT(*) as evals, ROUND(AVG(valeur_avg), 2) as note FROM gcp_my_paie.paie_qualite_mensuelle GROUP BY 1 ORDER BY 1"
print("--- NOTES QUALITE CONSOLIDEES ---")
for r in c.query(q).result():
    print(f"{r['projet']}: {r['evals']} evals, moyenne = {r['note']}%")
