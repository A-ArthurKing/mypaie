"""
Fichier : services/heures_agents/provider.py
Rôle    : Fournisseur de données Heures Agents — re-export depuis l'implémentation.
Module  : mypaie / backend / services / heures_agents
"""

from services.heures_agents.dw_api_heures_provider import (  # noqa: F401
    get_heures_agents,
    get_equipes_distinctes,
    get_projets_distincts,
    get_totaux_par_matricule,
)
