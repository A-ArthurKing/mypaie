import sys
sys.path.insert(0, '/app')
from config.db_mysql_connector import get_mysql_connection

conn = get_mysql_connection()
cur = conn.cursor()

aliases_qualite = [
    ("PVCP_FR", "PRLVEMENT__DE_LA_CB", "PRLVEMENT_DE_LA_CB"),
    ("PVCP_FR", "VRIFICATION__OBLIGATOIRE_EN_CAS_DACTION", "VRIFICATION_OBLIGATOIRE_EN_CAS_DACTION"),
    ("PVCP_FR", "QUALIT_DU_CONSEIL_ET_VALORISATION_DE_LOFFRE", "QUALIT_DE_CONSEIL_ET_VALORISATION_DE_LOFFRE"),
    ("PVCP_GE", "ENGAGED_LISTENING", "ENGAGE_LISTENING"),
    ("PVCP_GE", "ANTICIPATION", "PERSONALIZED_ANTICIPATION"),
]

for projet, brut, officiel in aliases_qualite:
    # check if exists
    cur.execute("SELECT id FROM config_kpi_aliases WHERE projet=%s AND code_brut_source=%s", (projet, brut))
    if not cur.fetchone():
        cur.execute("INSERT INTO config_kpi_aliases (projet, code_brut_source, code_kpi_officiel) VALUES (%s, %s, %s)", (projet, brut, officiel))

conn.commit()
print("Aliases inserted in MySQL")
