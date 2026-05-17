"""
Fichier : services/notes_qualite/provider.py
Rôle    : Fournisseur de données Notes Qualité — re-export depuis l'implémentation.
Module  : mypaie / backend / services / notes_qualite
"""

from modules.notes_qualite.services.dw_api_qualite_provider import (  # noqa: F401
    get_qualite_agents,
    get_qualite_stats_projets,
    get_qualite_stats_global,
    get_qualite_totaux_par_matricule,
)
