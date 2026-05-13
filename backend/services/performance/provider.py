"""
Fichier : services/performance/provider.py
Rôle    : Fournisseur de données Performance — re-export depuis l'implémentation.
Module  : mypaie / backend / services / performance
"""

from services.performance.dw_api_performance_provider import (  # noqa: F401
    get_performance_pvcp,
    get_perf_totaux_par_matricule,
)
