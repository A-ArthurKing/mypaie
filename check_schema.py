import sys; sys.path.insert(0, "/app")
from core.db.bigquery import get_bigquery_client
c = get_bigquery_client()

tables = [
    ("dataset_pvcp", "pvcp_data_qualite_evalplus"),
    ("dataproject_EvalPlus", "evalplus_detail_evaluations_agents")
]

for ds, tb in tables:
    print(f"\n--- COLUMNS FOR {ds}.{tb} ---")
    try:
        q = f"SELECT column_name, data_type FROM `data-project-438313`.{ds}.INFORMATION_SCHEMA.COLUMNS WHERE table_name='{tb}'"
        for r in c.query(q).result():
            print(f"  {r['column_name']}: {r['data_type']}")
    except Exception as e:
        print("  Error:", e)
