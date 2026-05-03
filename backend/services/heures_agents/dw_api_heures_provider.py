"""
Fichier : dw_api_heures_provider.py
Rôle    : Service de lecture des heures agents depuis MySQL (table heures_corrigees).
          Remplace l'ancien provider BigQuery pour des requêtes plus rapides
          et une lecture directe à la source (base gestionpaie).
Dépend  : db_gestionpaie_connector
Module  : mypaie / backend / services / heures_agents
"""

# #region IMPORTS
import logging
import datetime
from typing import Optional
from config.db_gestionpaie_connector import get_gestionpaie_connection
from tools.cache import get_cached, set_cached
# #endregion

# #region CONFIGURATION
logger = logging.getLogger(__name__)

# Table source dans gestionpaie
_TABLE = "heures_corrigees"

# Colonnes exposées (identiques à l'ancien provider BigQuery)
COLONNES_EXPOSEES = [
    "matricule",
    "LastName",
    "FirstName",
    "Equipe",
    "date",
    "projet",
    "heure_ht",
    "heure_hp",
    "heure_hc",
    "heure_hf",
    "heure_total",
    "heure_ecart",
    "TYPE_CONGE",
    "TYPE_FORMATION",
    "cloture_sup",
    "cloture_rh",
    "updated_at",
]

_COLONNES_SQL = ", ".join(COLONNES_EXPOSEES)
# #endregion


# #region SERVICE
def get_heures_agents(
    date_debut: Optional[str] = None,
    date_fin: Optional[str] = None,
    matricule: Optional[str] = None,
    equipe: Optional[str] = None,
    projet: Optional[str] = None,
    limit: int = 500,
    offset: int = 0,
) -> dict:
    """
    Interroge MySQL (gestionpaie.heures_corrigees) pour récupérer les heures agents.
    Les lignes supprimées (deleted_at IS NOT NULL) sont exclues.
    Retourne un dict { data, total, limit, offset }.
    """
    where_clauses = ["deleted_at IS NULL"]
    params: list = []

    if date_debut:
        where_clauses.append("date >= %s")
        params.append(date_debut)

    if date_fin:
        where_clauses.append("date <= %s")
        params.append(date_fin)

    if matricule:
        where_clauses.append("matricule = %s")
        params.append(matricule)

    if equipe:
        where_clauses.append("Equipe LIKE %s")
        params.append(f"%{equipe}%")

    if projet:
        where_clauses.append("projet LIKE %s")
        params.append(f"%{projet}%")

    where_sql = "WHERE " + " AND ".join(where_clauses)

    data_sql  = (
        f"SELECT {_COLONNES_SQL} FROM {_TABLE} {where_sql} "
        f"ORDER BY date DESC, LastName ASC "
        f"LIMIT %s OFFSET %s"
    )
    count_sql = f"SELECT COUNT(*) AS total FROM {_TABLE} {where_sql}"

    try:
        conn = get_gestionpaie_connection()
        with conn:
            with conn.cursor() as cur:
                cur.execute(count_sql, params)
                total = (cur.fetchone() or {}).get("total", 0)

                cur.execute(data_sql, params + [limit, offset])
                rows = cur.fetchall()

        return {
            "data":   _serialize_rows(rows),
            "total":  int(total),
            "limit":  limit,
            "offset": offset,
        }
    except Exception as err:
        logger.error("Erreur MySQL lors de la lecture des heures agents: %s", err)
        raise


# TTL du cache dropdowns : 30 minutes
_CACHE_TTL_DROPDOWNS = 1800


def get_equipes_distinctes() -> list:
    """Retourne la liste des équipes distinctes pour alimenter le filtre dropdown."""
    cached = get_cached("equipes_distinctes")
    if cached is not None:
        return cached

    sql = (
        f"SELECT DISTINCT Equipe FROM {_TABLE} "
        f"WHERE Equipe IS NOT NULL AND deleted_at IS NULL "
        f"ORDER BY Equipe"
    )
    try:
        conn = get_gestionpaie_connection()
        with conn:
            with conn.cursor() as cur:
                cur.execute(sql)
                rows = [r["Equipe"] for r in cur.fetchall() if r["Equipe"]]
        set_cached("equipes_distinctes", rows, _CACHE_TTL_DROPDOWNS)
        return rows
    except Exception as err:
        logger.error("Erreur MySQL lors de la lecture des équipes: %s", err)
        raise


def get_projets_distincts() -> list:
    """Retourne la liste des projets distincts pour alimenter le filtre dropdown."""
    cached = get_cached("projets_distincts")
    if cached is not None:
        return cached

    sql = (
        f"SELECT DISTINCT projet FROM {_TABLE} "
        f"WHERE projet IS NOT NULL AND deleted_at IS NULL "
        f"ORDER BY projet"
    )
    try:
        conn = get_gestionpaie_connection()
        with conn:
            with conn.cursor() as cur:
                cur.execute(sql)
                rows = [r["projet"] for r in cur.fetchall() if r["projet"]]
        set_cached("projets_distincts", rows, _CACHE_TTL_DROPDOWNS)
        return rows
    except Exception as err:
        logger.error("Erreur MySQL lors de la lecture des projets: %s", err)
        raise


def get_totaux_par_matricule(
    date_debut: Optional[str],
    date_fin: Optional[str],
    matricules: list,
) -> dict:
    """
    Retourne le total des heures (heure_total) agrégé par matricule pour
    une liste de matricules et une plage de dates.
    Résultat : { matricule_str: total_ms, ... }
    """
    if not matricules:
        return {}

    placeholders = ", ".join(["%s"] * len(matricules))
    where_clauses = [
        "deleted_at IS NULL",
        f"matricule IN ({placeholders})",
    ]
    params: list = list(matricules)

    if date_debut:
        where_clauses.append("date >= %s")
        params.append(date_debut)
    if date_fin:
        where_clauses.append("date <= %s")
        params.append(date_fin)

    where_sql = "WHERE " + " AND ".join(where_clauses)
    sql = (
        f"SELECT matricule, "
        f"  SEC_TO_TIME(SUM(TIME_TO_SEC(heure_total))) AS total_heure "
        f"FROM {_TABLE} {where_sql} "
        f"GROUP BY matricule"
    )

    try:
        conn = get_gestionpaie_connection()
        with conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()

        result = {}
        for row in rows:
            mat = str(row["matricule"])
            result[mat] = _time_str_to_ms(row["total_heure"])
        return result
    except Exception as err:
        logger.error("Erreur MySQL lors du calcul des totaux par matricule: %s", err)
        raise
# #endregion


# Colonnes stockées en varchar 'HH:MM:SS' à convertir en millisecondes
_COLONNES_TIME = frozenset({
    "heure_ht", "heure_hp", "heure_hc", "heure_hf",
    "heure_total", "heure_ecart",
})


def _time_str_to_ms(val) -> int:
    """Convertit une string 'HH:MM:SS' (ou timedelta) en millisecondes."""
    if isinstance(val, datetime.timedelta):
        return int(val.total_seconds() * 1000)
    if not val or not isinstance(val, str):
        return 0
    try:
        parts = val.split(":")
        h = int(parts[0]) if len(parts) > 0 else 0
        m = int(parts[1]) if len(parts) > 1 else 0
        s = int(parts[2]) if len(parts) > 2 else 0
        return (h * 3600 + m * 60 + s) * 1000
    except (ValueError, IndexError):
        return 0


def _serialize_rows(rows: list) -> list:
    """
    Convertit les types MySQL non-JSON-serialisables :
    - date/datetime → chaîne ISO
    - timedelta (colonnes TIME) → millisecondes
    - varchar 'HH:MM:SS' (colonnes heure_*) → millisecondes (format attendu par le frontend)
    """
    serialized = []
    for row in rows:
        clean = {}
        for key, value in row.items():
            if key in _COLONNES_TIME:
                clean[key] = _time_str_to_ms(value)
            elif isinstance(value, datetime.timedelta):
                clean[key] = int(value.total_seconds() * 1000)
            elif isinstance(value, (datetime.date, datetime.datetime)):
                clean[key] = value.isoformat()
            else:
                clean[key] = value
        serialized.append(clean)
    return serialized
# #endregion
