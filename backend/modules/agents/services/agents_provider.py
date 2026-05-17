"""
Fichier : services/agents/agents_provider.py
Rôle    : Fournisseur de données Agents (gestion manuelle) — re-export depuis l'implémentation.
Module  : mypaie / backend / services / agents
"""

from modules.agents.services.agents_data_provider import (  # noqa: F401
    get_agents_manual_data,
    save_agent_manual_data,
    get_all_agents_gestion,
    update_agent_global_statut,
    add_agent,
    update_agent,
    delete_agent,
)
