"""
Fichier : services/regles_primes/provider.py
Rôle    : Fournisseur de données Règles Primes — re-export depuis l'implémentation.
Module  : mypaie / backend / services / regles_primes
"""

from services.regles_primes.dw_api_regles_provider import (  # noqa: F401
    get_regle_by_id,
    update_regle_grille,
    get_regle_configs,
    create_regle_config,
    set_active_config,
    update_grilles_order,
    delete_grille,
    get_regles,
    create_regle,
    update_regle,
    delete_regle,
)
