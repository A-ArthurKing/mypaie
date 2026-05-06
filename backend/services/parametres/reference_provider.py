"""
Fichier : reference_provider.py
Rôle    : Fournit les données des référentiels (opérations, files, activités, statuts).
Module  : mypaie / backend / services / parametres
"""

import logging
import pymysql
from config.db_mysql_connector import get_mysql_connection

logger = logging.getLogger(__name__)

def get_all_references():
    """Récupère l'ensemble des référentiels et la table de structure (Cerveau)."""
    conn = get_mysql_connection()
    try:
        # Utilisation de DictCursor pour avoir des objets {col: val}
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute("SELECT id, nom as libelle FROM ref_projets ORDER BY nom")
            projets = cur.fetchall()

            cur.execute("SELECT id, libelle FROM ref_operations ORDER BY libelle")
            ops = cur.fetchall()
            
            cur.execute("SELECT id, libelle FROM ref_files ORDER BY libelle")
            files = cur.fetchall()
            
            cur.execute("SELECT id, libelle FROM ref_activites ORDER BY libelle")
            acts = cur.fetchall()
            
            cur.execute("SELECT id, libelle FROM ref_statuts ORDER BY libelle")
            statuts = cur.fetchall()

            cur.execute("SELECT id, id_projet, id_operation, id_file, id_activite FROM ref_structure_map")
            structure = cur.fetchall()

            cur.execute("SELECT id, code, libelle, unite, univers, tech_key, source_db FROM matrice_kpis WHERE actif = 1 ORDER BY libelle")
            kpis_raw = cur.fetchall()
            
            # Groupement des KPIs par univers
            kpis_grouped = {}
            for k in kpis_raw:
                u = k['univers']
                if u not in kpis_grouped:
                    kpis_grouped[u] = []
                kpis_grouped[u].append(k)
            
            return {
                "projets": projets,
                "operations": ops,
                "files": files,
                "activites": acts,
                "statuts": statuts,
                "structure": structure,
                "kpis": kpis_grouped
            }
    finally:
        conn.close()
