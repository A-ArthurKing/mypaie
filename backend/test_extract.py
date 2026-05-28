import sys; sys.path.insert(0, "/app")
from modules.agents.services.gemini_agent_provider import _extract_last_grille_json
print("Extracting...")
res = _extract_last_grille_json([{"sender": "bot", "text": "```json_grille_proposal\n{\"test\": 1}\n```"}])
print("Result:", res)
