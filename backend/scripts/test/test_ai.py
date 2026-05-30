import sys; sys.path.insert(0, "/app")
from modules.agents.services.gemini_agent_provider import process_chat_message
import json

msg = """
* Le statut **Débutant** donne droit à une prime brute de **1 200 MAD**, sous réserve d’atteindre les objectifs suivants : une DMT de **350**, un taux de CVR naturelle de **2 %**, un AVG NBR de **750 €**, une qualité minimale de **80 %**, un taux MEA inférieur ou égal à **10 %**, ainsi qu’une valeur de **0** pour l’indicateur « INTITULE KPI6 ».
* Le statut **Confirmé** donne droit à une prime brute de **1 200 MAD**...
"""
res = process_chat_message(msg, 5, [])
print("AI Response:", res['response'])
