"""
Fichier : sql_queries.py
Rôle    : Bibliothèque centrale des requêtes SQL BigQuery.
          Utilisé comme un "Toolbox" pour les services de données.
Module  : mypaie / backend / tools
"""

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
    """Récupération consolidée de la performance par agent."""
    return f"""
        SELECT 
            matricule as agent_id_hash,
            agent_nom as agent_name,
            matricule as matricule,
            ANY_VALUE(operation) as agent_group,
            ANY_VALUE(projet) as projet,
            SUM(nb_appels) as in_call_nbr,
            SUM(nb_ventes) as booking_nbr,
            SUM(temps_appel) as call_min,
            SUM(temps_production) as logged_min,
            SUM(temps_production) as worked_min,
            COUNT(*) as nb_records,
            MAX(date_ref) as date_ajout,
            SUM(chiffre_affaire) as chiffre_affaire,
            SAFE_DIVIDE(SUM(nb_ventes), NULLIF(SUM(nb_appels), 0)) * 100 as taux_conversion_calc,
            SAFE_DIVIDE(SUM(csat * nb_csat), NULLIF(SUM(nb_csat), 0)) as csat_moyen
        FROM {table_ref}
        {where_str}
        GROUP BY matricule, agent_nom
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
