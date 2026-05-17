"""
Fichier : tools/kpi_engine.py
Rôle    : Moteur de calcul universel pour les KPIs Virtuels (Formules).
          Permet d'évaluer des expressions mathématiques sécurisées 
          avec support des dépendances récursives.
Module  : mypaie / backend / tools
"""

import logging
import re
import pymysql
from typing import Dict, Any, Optional
from config.db_mysql_connector import get_mysql_connection

logger = logging.getLogger(__name__)

# Seuls les chiffres, opérateurs de base, parenthèses et espaces sont autorisés après résolution
_SAFE_MATH_RE = re.compile(r'^[\d\s\.\+\-\*/\(\)]+$')

def evaluate_formula(formula: str, context: dict, kpis_registry: dict, depth: int = 0) -> float | None:
    """
    Évalue une formule de KPI virtuel de façon récursive et sécurisée.
    Syntaxe supportée : [CODE_KPI]
    """
    if not formula or depth > 5: # Limite de profondeur pour éviter les boucles
        return None

    # 1. Identifier les tags [KPI_CODE]
    tags = re.findall(r'\[(.*?)\]', formula)
    expr = formula

    for tag in tags:
        val = None
        # Priorité 1 : Valeur déjà présente dans le contexte (Donnée brute)
        if tag in context:
            val = context[tag]
        # Priorité 2 : C'est un autre KPI du registre
        elif tag in kpis_registry:
            target_kpi = kpis_registry[tag]
            # Si c'est un virtuel, on évalue sa formule récursivement
            if target_kpi.get('type') == 'VIRTUAL' and target_kpi.get('formule'):
                val = evaluate_formula(target_kpi['formule'], context, kpis_registry, depth + 1)
            else:
                # Si c'est un natif non présent dans le contexte, on prend 0
                val = context.get(tag, 0)
        
        # Remplacement dans l'expression (sécurisation : None -> 0)
        # On caste en str pour l'insertion dans la chaîne de calcul
        expr = expr.replace(f'[{tag}]', str(val if val is not None else 0))

    # 2. Sécurisation finale avant évaluation
    clean_expr = expr.strip()
    if not _SAFE_MATH_RE.match(clean_expr):
        logger.warning("Formule rejetée (caractères non autorisés après résolution) : %s", clean_expr)
        return None

    try:
        # Évaluation dans un contexte vide (pas d'accès aux built-ins Python)
        # On utilise float() car eval peut retourner des types variés
        result = eval(clean_expr, {"__builtins__": {}}, {}) # noqa: S307
        return round(float(result), 4) if result is not None else None
    except ZeroDivisionError:
        return 0.0
    except Exception as e:
        logger.debug("Erreur calcul formule '%s' : %s", formula, e)
        return None

def get_kpi_registry() -> Dict[str, Dict[str, Any]]:
    """Charge le dictionnaire des KPIs actifs (MySQL)."""
    try:
        conn = get_mysql_connection()
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute("""
                SELECT code_kpi, libelle, univers, type, formule 
                FROM config_kpis 
                WHERE is_active = 1
            """)
            rows = cur.fetchall()
            return {r['code_kpi']: r for r in rows}
    except Exception as e:
        logger.error("Erreur chargement registre KPIs : %s", e)
        return {}
    finally:
        try:
            conn.close()
        except:
            pass
