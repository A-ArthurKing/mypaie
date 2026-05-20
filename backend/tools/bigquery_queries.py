"""
Fichier : bigquery_queries.py
Rôle    : Bibliothèque centrale des requêtes SQL BigQuery.
          Utilisé comme un "Toolbox" pour les services de données.
Module  : mypaie / backend / tools
"""
import os

def query_heures_detail(table_ref, colonnes_str, where_str):
    """Récupération détaillée des heures agents avec filtres."""
    return f"""
        -- Récupération détaillée des heures agents avec filtres
        SELECT {colonnes_str}
        FROM {table_ref}
        {where_str}
        ORDER BY date DESC, LastName ASC
        LIMIT @limit OFFSET @offset
    """

def query_heures_count(table_ref, where_str):
    """Comptage total des lignes d'heures pour la pagination."""
    return f"""
        -- Comptage total des lignes pour la pagination
        SELECT COUNT(*) AS total
        FROM {table_ref}
        {where_str}
    """

def query_equipes_distinctes(table_ref):
    """Liste des équipes uniques pour le filtre dropdown."""
    return f"""
        -- Liste des équipes uniques pour le filtre
        SELECT DISTINCT Equipe 
        FROM {table_ref} 
        WHERE Equipe IS NOT NULL 
        ORDER BY Equipe
    """

def query_projets_heures_distincts(table_ref):
    """Liste des projets uniques (heures) pour le filtre dropdown."""
    return f"""
        -- Liste des projets uniques pour le filtre
        SELECT DISTINCT projet 
        FROM {table_ref} 
        WHERE projet IS NOT NULL 
        ORDER BY projet
    """

def query_qualite_detail(table_ref, colonnes_str, where_str):
    """Récupération détaillée des évaluations agents."""
    return f"""
        -- Récupération détaillée des évaluations agents
        SELECT {colonnes_str}
        FROM {table_ref}
        {where_str}
        ORDER BY Date_Evaluation DESC
        LIMIT @limit OFFSET @offset
    """

def query_qualite_count(table_ref, where_str):
    """Comptage total des évaluations pour la pagination."""
    return f"""
        -- Comptage total des évaluations
        SELECT COUNT(*) AS total
        FROM {table_ref}
        {where_str}
    """

def query_qualite_stats_projets(table_ref, where_str):
    """Agrégation des moyennes et volumes par projet pour la grille KPI (Jauges)."""
    return f"""
        -- Agrégation des moyennes et volumes par projet pour la grille KPI
        SELECT 
            Projet as projet,
            AVG(Note_Sous_Item) as moyenne,
            COUNT(*) as nbEvaluations
        FROM {table_ref}
        {where_str}
        GROUP BY Projet
        ORDER BY moyenne DESC
    """

def query_qualite_stats_global(table_ref, where_str):
    """Agrégation globale par typologie (Item) et sous-typologie (Sous-Item)."""
    return f"""
        -- Agrégation globale par typologie et sous-typologie
        SELECT 
            Item_Global as item,
            Sous_Item as sous_item,
            AVG(Note_Sous_Item) as moyenne,
            COUNT(*) as nb
        FROM {table_ref}
        {where_str}
        GROUP BY ROLLUP(item, sous_item)
        ORDER BY item, sous_item
    """

def query_performance_detail(table_ref, where_str):
    """
    Récupération consolidée de la performance par agent avec pivot EAV.
    """
    return f"""
        SELECT
            r.matricule                                                             AS agent_id_hash,
            ANY_VALUE(r.matricule)                                                  AS agent_name,
            r.matricule                                                             AS matricule,
            ANY_VALUE(r.projet)                                                     AS agent_group,
            ANY_VALUE(r.projet)                                                     AS projet,
            SUM(IF(kpi_code IN ('in_call_nbr', 'nb_appels'), valeur_sum, 0))        AS in_call_nbr,
            SUM(IF(kpi_code IN ('booking_nbr', 'nb_ventes'), valeur_sum, 0))        AS booking_nbr,
            SUM(IF(kpi_code IN ('in_call_min_nbr', 'temps_appel'), valeur_sum, 0))  AS call_min,
            SUM(IF(kpi_code IN ('agent_logged_time_min_nbr', 'call_worked_time_min_nbr', 'temps_production'), valeur_sum, 0)) AS logged_min,
            SUM(IF(kpi_code IN ('agent_logged_time_min_nbr', 'call_worked_time_min_nbr', 'temps_production'), valeur_sum, 0)) AS worked_min,
            SUM(r.nb_jours)                                                         AS nb_records,
            MAX(r.last_update)                                                      AS date_ajout,
            SUM(IF(kpi_code IN ('net_booking_rental_amt_eur', 'chiffre_affaire'), valeur_sum, 0)) AS chiffre_affaire,
            SAFE_DIVIDE(SUM(IF(kpi_code IN ('booking_nbr', 'nb_ventes'), valeur_sum, 0)), NULLIF(SUM(IF(kpi_code IN ('in_call_nbr', 'nb_appels'), valeur_sum, 0)), 0)) * 100 AS taux_conversion_calc,
            AVG(IF(kpi_code IN ('tx_mea'), valeur_avg, 0))                          AS tx_mea,
            SAFE_DIVIDE(SUM(IF(kpi_code IN ('csat_nbr', 'csat'), valeur_sum, 0)), NULLIF(SUM(IF(kpi_code IN ('total_csat_num', 'nb_csat'), valeur_sum, 0)), 0)) AS csat_moyen
        FROM {table_ref} r
        {where_str}
        GROUP BY r.matricule
        ORDER BY in_call_nbr DESC
        LIMIT @limit OFFSET @offset
    """

def query_performance_count(table_ref, where_str):
    """Comptage du nombre d'agents uniques pour la pagination."""
    return f"""
        SELECT COUNT(DISTINCT matricule) AS total
        FROM {table_ref}
        {where_str}
    """
