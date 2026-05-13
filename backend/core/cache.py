"""
Fichier : core/cache.py
Rôle    : Cache en mémoire avec TTL pour réduire la latence des appels BigQuery répétitifs.
          Évite de re-exécuter des requêtes coûteuses pour des données stables (dropdowns, stats).
Module  : mypaie / backend / core
"""

# #region IMPORTS
import time
import logging
# #endregion

# #region CONFIGURATION
logger = logging.getLogger(__name__)

# Stockage interne : clé → (valeur, timestamp_expiration)
_store: dict = {}
# #endregion


# #region API PUBLIQUE
def get_cached(key: str):
    """Retourne la valeur en cache si elle n'est pas expirée, sinon None."""
    if key in _store:
        value, expires_at = _store[key]
        if time.monotonic() < expires_at:
            return value
        del _store[key]
    return None


def set_cached(key: str, value, ttl: int) -> None:
    """Stocke une valeur avec un TTL en secondes."""
    _store[key] = (value, time.monotonic() + ttl)
    logger.debug("Cache SET [%s] TTL=%ds", key, ttl)


def invalidate(key: str) -> None:
    """Supprime une entrée spécifique du cache."""
    _store.pop(key, None)


def clear_all() -> None:
    """Vide intégralement le cache (utile pour forcer un rechargement)."""
    _store.clear()
    logger.info("Cache vidé intégralement.")
# #endregion
