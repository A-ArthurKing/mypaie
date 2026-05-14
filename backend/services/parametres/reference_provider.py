"""
Fichier : reference_provider.py
Rôle    : Fournit les données des référentiels (opérations, files, activités, statuts).
Module  : mypaie / backend / services / parametres
"""

import logging
import pymysql
from config.db_mysql_connector import get_mysql_connection
from tools.cache import get_cached, set_cached, invalidate

logger = logging.getLogger(__name__)

_CACHE_KEY = "parametres:references"
_CACHE_TTL  = 300  # 5 minutes


def invalidate_references_cache() -> None:
    """Invalide le cache des référentiels — à appeler après toute mutation structure ou KPI."""
    invalidate(_CACHE_KEY)


def get_all_references():
    """Récupère l'ensemble des référentiels et la table de structure (Cerveau). Résultat mis en cache 5 min."""
    cached = get_cached(_CACHE_KEY)
    if cached is not None:
        logger.debug("Cache HIT [%s]", _CACHE_KEY)
        return cached

    result = None
    conn = get_mysql_connection()
    try:
        # Utilisation de DictCursor pour avoir des objets {col: val}
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute("SELECT id, nom as libelle FROM ref_projets ORDER BY nom")
            projets = cur.fetchall()

            cur.execute("SELECT id, libelle FROM ref_operations ORDER BY libelle")
            ops = cur.fetchall()
            
            cur.execute("SELECT id, libelle FROM ref_sous_projet ORDER BY libelle")
            sous_projets = cur.fetchall()
            
            cur.execute("SELECT id, libelle FROM ref_activites ORDER BY libelle")
            acts = cur.fetchall()
            
            cur.execute("SELECT id, code, libelle FROM matrice_statuts WHERE actif = 1 ORDER BY libelle")
            statuts = cur.fetchall()

            cur.execute("SELECT id, id_projet, id_operation, id_sous_projet, id_activite FROM ref_structure_map")
            structure = cur.fetchall()

            # On récupère les KPIs standards avec un flag indiquant s'ils sont déjà mappés (Liaison faite)
            cur.execute("""
                SELECT 
                    k.id, k.code, k.libelle, k.unite, k.univers, k.tech_key,
                    (SELECT COUNT(*) FROM matrice_kpis_mapping m WHERE m.standard_kpi_code = k.code) as mapping_count,
                    (SELECT m2.is_formula FROM matrice_kpis_mapping m2 WHERE m2.standard_kpi_code = k.code AND m2.is_formula = 1 LIMIT 1) as is_formula,
                    (SELECT m3.formula FROM matrice_kpis_mapping m3 WHERE m3.standard_kpi_code = k.code AND m3.is_formula = 1 LIMIT 1) as formula
                FROM matrice_kpis k
                WHERE k.actif = 1 
                ORDER BY k.libelle
            """)
            kpis_raw = cur.fetchall()
            
            # Groupement des KPIs par univers
            kpis_grouped = {}
            for k in kpis_raw:
                # Fallback : si tech_key est NULL en base, on dérive depuis le code
                # On normalise : minuscules + espaces/tirets → underscores
                if not k.get('tech_key'):
                    k['tech_key'] = k['code'].lower().replace(' ', '_').replace('-', '_')
                u = k['univers']
                if u not in kpis_grouped:
                    kpis_grouped[u] = []
                kpis_grouped[u].append(k)
            
            result = {
                "projets": projets,
                "operations": ops,
                "sous_projets": sous_projets,
                "activites": acts,
                "statuts": statuts,
                "structure": structure,
                "kpis": kpis_grouped
            }
    finally:
        conn.close()

    set_cached(_CACHE_KEY, result, _CACHE_TTL)
    return result
