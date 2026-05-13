"""
Fichier : sql_queries.py
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
    Récupération consolidée de la performance par agent.
    Les colonnes sont lues directement depuis paie_performance (déjà normalisées).
    La résolution du nom de projet se fait côté Python depuis MySQL (ref_projets_mapping),
    plus de JOIN BigQuery — suppression de la dépendance à projet_mapping BQ.
    """
    return f"""
        SELECT
            r.matricule                                                             AS agent_id_hash,
            r.agent_nom                                                             AS agent_name,
            r.matricule                                                             AS matricule,
            ANY_VALUE(r.operation)                                                  AS agent_group,
            ANY_VALUE(r.projet)                                                     AS projet,
            SUM(r.nb_appels)                                                        AS in_call_nbr,
            SUM(r.nb_ventes)                                                        AS booking_nbr,
            SUM(r.temps_appel)                                                      AS call_min,
            SUM(r.temps_production)                                                 AS logged_min,
            SUM(r.temps_production)                                                 AS worked_min,
            COUNT(*)                                                                AS nb_records,
            MAX(r.date_ref)                                                         AS date_ajout,
            SUM(r.chiffre_affaire)                                                  AS chiffre_affaire,
            SAFE_DIVIDE(SUM(r.nb_ventes), NULLIF(SUM(r.nb_appels), 0)) * 100       AS taux_conversion_calc,
            AVG(r.tx_mea)                                                           AS tx_mea,
            SAFE_DIVIDE(SUM(r.csat * r.nb_csat), NULLIF(SUM(r.nb_csat), 0))       AS csat_moyen
        FROM {table_ref} r
        {where_str}
        GROUP BY r.matricule, r.agent_nom
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
