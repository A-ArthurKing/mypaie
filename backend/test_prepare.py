import sys; sys.path.insert(0, "/app")
from modules.agents.services.ai_engine.tools import prepare_grille_proposal_tool
try:
    prepare_grille_proposal_tool(5, "test", '{"invalid": json')
except Exception as e:
    print("ERROR:", e)
