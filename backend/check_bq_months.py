import sys
sys.path.insert(0, '/app')
from config.dw_api_bigquery_connector import get_bigquery_client, GCP_PROJECT_ID, BQ_DATASET_PAIE
from modules.performance.services.dw_api_performance_provider import _load_nom_matricule_mapping, get_perf_totaux_par_matricule

client = get_bigquery_client()
table = f"`{GCP_PROJECT_ID}.{BQ_DATASET_PAIE}.paie_performance_mensuelle`"

mat_test = ['11904', '9701', '12524', '12529']

# 1. Mapping nom->matricule
nom_map = _load_nom_matricule_mapping(mat_test)
print("=== NOM MAP ===")
for k, v in nom_map.items():
    print("  " + k + " -> " + v)

# 2. Requête BQ directe avec les noms
if nom_map:
    mat_literals = ", ".join("'" + name + "'" for name in nom_map.keys())
    sql = f"SELECT matricule, kpi_code, SUM(valeur_sum) as s, AVG(valeur_avg) as a FROM {table} WHERE UPPER(matricule) IN ({mat_literals}) AND mois >= '2026-05' AND mois <= '2026-05' GROUP BY matricule, kpi_code"
    rows = list(client.query(sql).result())
    print("\n=== RESULTATS BQ (" + str(len(rows)) + " lignes) ===")
    for r in rows[:10]:
        print("  mat=" + str(r['matricule']) + " kpi=" + str(r['kpi_code']) + " sum=" + str(r['s']) + " avg=" + str(r['a']))

# 3. Appel complet du provider
print("\n=== get_perf_totaux_par_matricule ===")
perf = get_perf_totaux_par_matricule('2026-05-01', '2026-05-31', mat_test)
print("Agents retournés: " + str(list(perf.keys())))
for mat, kpis in perf.items():
    print("  " + str(mat) + ": " + str(list(kpis.keys())[:5]))


# Mois disponibles
sql = f"SELECT mois, COUNT(DISTINCT matricule) as nb FROM {table} GROUP BY mois ORDER BY mois DESC LIMIT 10"
rows = list(client.query(sql).result())
print("=== MOIS DISPONIBLES ===")
for r in rows:
    print("  " + r['mois'] + " -> " + str(r['nb']) + " agents")

# Agents disponibles sur le dernier mois
if rows:
    last_mois = rows[0]['mois']
    sql2 = f"SELECT DISTINCT matricule FROM {table} WHERE mois = '{last_mois}' ORDER BY matricule"
    agents = list(client.query(sql2).result())
    print("\n=== TOUS LES AGENTS dans " + last_mois + " ===")
    for a in agents:
        print("  " + str(a['matricule']))

    # KPIs disponibles
    sql4 = f"SELECT DISTINCT kpi_code FROM {table} WHERE mois = '{last_mois}' ORDER BY kpi_code"
    kpis = list(client.query(sql4).result())
    print("\n=== KPI_CODES disponibles ===")
    for k in kpis:
        print("  " + str(k['kpi_code']))
