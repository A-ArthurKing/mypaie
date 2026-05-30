"""
Fichier : calculation_engine.py
Rôle    : Moteur de calcul des primes (Atteinte d'objectifs).
          Interprète la grille JSON pour produire le résultat financier
          final par agent : atteinte KPI → palier → score pondéré → prime.
Module  : mypaie / backend / services / regles_primes
"""

import logging
import pymysql
from typing import Dict, Any, List, Optional
from modules.regles_primes.services.kpi_unified_resolver import get_unified_agent_data
from config.db_mysql_connector import get_mysql_connection

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers internes
# ---------------------------------------------------------------------------

def _get_kpi_value(agent_kpis: dict, metric_key: str):
    """
    Recherche robuste de la valeur d'un KPI dans le dictionnaire agent_kpis.
    Ordre de priorité :
      1. Correspondance exacte (case-sensitive)
      2. Lowercase / UPPERCASE
      3. Correspondance insensible à la casse (scan)
      4. Fallback BigQuery : {metric_key}_avg  (ratio / durée / taux)
      5. Fallback BigQuery : {metric_key}_sum  (volume / count)
      6. Fallback insensible à la casse pour _avg / _sum
    Retourne None si aucune clé ne correspond.
    """
    if not metric_key:
        return None
    # 1. Exact
    v = agent_kpis.get(metric_key)
    if v is not None:
        return v
    # 2. lower / UPPER
    v = agent_kpis.get(metric_key.lower())
    if v is not None:
        return v
    v = agent_kpis.get(metric_key.upper())
    if v is not None:
        return v
    # 3. Scan insensible à la casse (sans suffixe)
    lk = metric_key.lower()
    for k, val in agent_kpis.items():
        if k.lower() == lk and val is not None:
            return val
    # 4-5. Fallback BigQuery : la source renvoie {code}_avg et {code}_sum
    #      On préfère _avg (valeur la plus représentative pour les ratios / durées)
    #      puis _sum (volumes).
    for suffix in ('_avg', '_sum'):
        v = agent_kpis.get(f"{metric_key}{suffix}")
        if v is not None:
            return v
        v = agent_kpis.get(f"{metric_key.lower()}{suffix}")
        if v is not None:
            return v
    # 6. Scan insensible à la casse avec suffixes
    for suffix in ('_avg', '_sum'):
        target = f"{lk}{suffix}"
        for k, val in agent_kpis.items():
            if k.lower() == target and val is not None:
                return val
    return None

def _get_agents_statuts(matricules: List[str]) -> Dict[str, str]:
    """
    Charge le niveau/profil (ex: Débutant, Confirmé, Sénior) de chaque agent
    depuis ref_employes.statut.
    Retourne { matricule: statut_nom }
    """
    if not matricules:
        return {}
    try:
        conn = get_mysql_connection()
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            placeholders = ",".join(["%s"] * len(matricules))
            cur.execute(
                f"SELECT matricule, statut FROM ref_employes WHERE matricule IN ({placeholders})",
                list(matricules)
            )
            rows = cur.fetchall()
        conn.close()
        return {r['matricule']: (r['statut'] or '') for r in rows}
    except Exception as e:
        logger.warning("Impossible de charger les statuts agents : %s — fallback sur premier niveau", e)
        return {}


def _get_agents_sanctions(regle_id: int, matricules: List[str]) -> set:
    """
    Retourne l'ensemble des matricules sanctionnés pour cette règle.
    Un agent sanctionné voit sa prime bloquée à 0.
    """
    if not regle_id or not matricules:
        return set()
    try:
        conn = get_mysql_connection()
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            placeholders = ",".join(["%s"] * len(matricules))
            cur.execute(
                f"""SELECT agent_matricule FROM matrice_primes_agents_gestion
                    WHERE matrice_id = %s AND agent_matricule IN ({placeholders}) AND sanction = 'Oui'""",
                [regle_id] + list(matricules)
            )
            rows = cur.fetchall()
        conn.close()
        return {r['agent_matricule'] for r in rows}
    except Exception as e:
        logger.warning("Impossible de charger les sanctions : %s", e)
        return set()


def _find_palier(paliers: List[dict], atteinte_pct: float) -> dict:
    """
    Trouve le palier applicable pour un taux d'atteinte donné.

    Sémantique (confirmée par Step4Paliers.jsx) :
      seuil_atteinte = borne SUPÉRIEURE EXCLUSIVE de la plage du palier.
      null           = pas de borne supérieure (palier "ouvert" = le plus haut).

    Exemple avec paliers [Insuffisant(70), Partiel(85), Correct(100), Atteint(null)] :
      atteinte < 70%   → Insuffisant  (0 % versé)
      70% ≤ att < 85%  → Partiel      (50 % versé)
      85% ≤ att < 100% → Correct      (75 % versé)
      att ≥ 100%       → Atteint      (100 % versé)
    """
    if not paliers:
        return {'pourcentage_paiement': 0, 'label': '—'}

    sorted_paliers = sorted(
        paliers,
        key=lambda p: p.get('seuil_atteinte') if p.get('seuil_atteinte') is not None else float('inf')
    )
    for palier in sorted_paliers:
        seuil = palier.get('seuil_atteinte')
        if seuil is None or atteinte_pct < seuil:
            return palier

    # Fallback : dernier palier (atteinte ≥ tous les seuils définis)
    return sorted_paliers[-1]


def _compute_atteinte(val_reelle: float, cible: float, direction: str) -> float:
    """
    Calcule le pourcentage d'atteinte d'un KPI selon sa direction.
      lower_better : plus la valeur est basse, mieux c'est.
                     atteinte = (cible / val_reelle) × 100
      higher_better : plus la valeur est haute, mieux c'est.
                      atteinte = (val_reelle / cible) × 100
    """
    try:
        if direction == 'lower_better':
            if val_reelle <= 0:
                return 0.0
            return round((cible / val_reelle) * 100, 2)
        else:  # higher_better (défaut)
            if cible <= 0:
                return 0.0
            return round((val_reelle / cible) * 100, 2)
    except ZeroDivisionError:
        return 0.0


# ---------------------------------------------------------------------------
# Génération de la formule lisible (persistée en base)
# ---------------------------------------------------------------------------

def build_formule_lisible(grille: dict) -> str:
    """
    Dérive une description texte de la formule de calcul à partir du JSON grille.
    Appelée à chaque sauvegarde de la grille → stockée dans matrice_primes.formule_lisible.

    Format produit :
      prime_finale = prime_brute × score_global / 100
      score_global = somme des contributions KPI
        [+] Duration_call  (45 pts, lower_better)  atteinte = cible / réel × 100
        [-] Hold_Time      (10 pts, lower_better, malus) ...
      Paliers :
        atteinte < 70%  → 0% versé (Insuffisant)
        atteinte < 85%  → 50% versé (Partiel)
        ...
      Niveaux :
        Débutant  : prime_brute = 1200 DH | cibles : Duration_call=350, ...
        Confirmé  : prime_brute = 1500 DH | cibles : ...
    """
    indicateurs    = grille.get("indicateurs", [])
    paliers        = grille.get("paliers", [])
    statuts_grille = grille.get("statuts", [])

    if not indicateurs or not paliers or not statuts_grille:
        return ""

    # Correspondance kpi_id → nom affichable
    kpi_id_to_nom = {
        ind.get('id'): (ind.get('nom') or ind.get('metric_key', '?'))
        for ind in indicateurs
    }

    lines = []
    lines.append("prime_finale = prime_brute × score_global / 100")
    lines.append("")
    lines.append("score_global = somme des contributions KPI :")

    for ind in indicateurs:
        nom       = ind.get('nom') or ind.get('metric_key', '?')
        poids     = ind.get('poids', 0)
        direction = ind.get('direction', 'higher_better')
        ponder    = ind.get('type_ponderation', 'bonus')
        sign      = "[+]" if ponder == 'bonus' else "[-]"
        formula   = "réel / cible × 100" if direction == 'higher_better' else "cible / réel × 100"
        contrib   = "contribution = poids × (pp / 100)" if ponder == 'bonus' else "contribution = −poids × ((100 − pp) / 100)"
        lines.append(f"  {sign} {nom} ({poids} pts, {direction}) → atteinte = {formula} → {contrib}")

    lines.append("")
    lines.append("Paliers d'atteinte (seuil = borne supérieure exclusive) :")
    sorted_paliers = sorted(
        paliers,
        key=lambda p: p.get('seuil_atteinte') if p.get('seuil_atteinte') is not None else float('inf')
    )
    for p in sorted_paliers:
        label = p.get('label', '?')
        pp    = p.get('pourcentage_paiement', 0)
        seuil = p.get('seuil_atteinte')
        if seuil is not None:
            lines.append(f"  atteinte < {seuil}% → {pp}% versé ({label})")
        else:
            lines.append(f"  atteinte ≥ seuil précédent → {pp}% versé ({label})")

    lines.append("")
    lines.append("Niveaux et primes brutes :")
    for s in statuts_grille:
        nom    = s.get('nom', '?')
        brute  = s.get('prime_brute', 0)
        cibles = s.get('cibles', {})
        cible_parts = [
            f"{kpi_id_to_nom.get(kid, kid)}={val}"
            for kid, val in cibles.items()
        ]
        cible_str = ", ".join(cible_parts) if cible_parts else "—"
        lines.append(f"  {nom} : prime_brute = {brute} DH | cibles : {cible_str}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Point d'entrée principal
# ---------------------------------------------------------------------------

def run_payout_calculation(
    regle: dict,
    matricules: List[str],
    date_debut: str,
    date_fin: str
) -> Dict[str, Any]:
    """
    Exécute le calcul de prime pour tous les agents d'une règle.

    Pipeline :
    1. kpi_unified_resolver  → données KPIs consolidées par agent (BQ + GestionPaie)
    2. ref_employes.statut   → niveau agent (Débutant / Confirmé / Sénior)
    3. grille JSON           → cibles, paliers, poids par niveau
    4. Pour chaque KPI       → atteinte % → palier → pourcentage_paiement
    5. score_global          → somme pondérée (poids × pp / 100)
    6. prime_finale          → prime_brute × score_global / 100

    Retourne { matricule: { statut, prime_brute, score_global, prime_finale, detail_kpis } }
    """
    grille         = regle.get("grille_objectifs") or {}
    regle_id       = regle.get("id")
    indicateurs    = grille.get("indicateurs", [])
    paliers        = grille.get("paliers", [])
    statuts_grille = grille.get("statuts", [])

    if not indicateurs or not paliers or not statuts_grille:
        logger.warning(
            "Grille incomplète pour la règle %s — indicateurs, paliers ou statuts manquants.", regle_id
        )
        return {}

    # 1. Données KPIs unifiées
    kpi_data = get_unified_agent_data(date_debut, date_fin, matricules)

    # 2. Profils agents (Débutant / Confirmé / Sénior)
    statuts_agents = _get_agents_statuts(matricules)

    # 3. Agents sanctionnés (prime bloquée)
    sanctions = _get_agents_sanctions(regle_id, matricules)

    # 4. Données d'assiduité (prorata réel + malus présence)
    config_temps     = grille.get("config_temps", {}) or {}
    malus_rules      = config_temps.get("malus_assiduite") or []
    mode_prorata     = config_temps.get("mode_prorata", "aucun")
    jours_ouvres_ref = float(config_temps.get("jours_ouvres") or 22)
    seuil_minimum    = config_temps.get("seuil_minimum_jours")
    base_horaire_ref = float(config_temps.get("base_horaire") or 191)
    assiduite_data   = {}
    need_assiduite   = bool(malus_rules) or mode_prorata != "aucun"
    if need_assiduite:
        try:
            from modules.agents.services.assiduite_provider import get_assiduite_pour_mois
            # date_debut est au format YYYY-MM-DD → on extrait YYYY-MM
            mois_str = date_debut[:7]
            rows = get_assiduite_pour_mois(mois_str)
            assiduite_data = {str(r['matricule']): r for r in rows}
        except Exception as e:
            logger.warning("Impossible de charger les données d'assiduité : %s", e)

    results = {}

    for mat in matricules:
        mat_str    = str(mat)
        agent_kpis = kpi_data.get(mat_str, {})

        # --- Sanction : prime bloquée à 0 ---
        if mat_str in sanctions:
            results[mat_str] = {
                "statut":        None,
                "prime_brute":   0.0,
                "score_global":  0.0,
                "prime_finale":  0.0,
                "bloque":        True,
                "motif_blocage": "Sanction active",
                "detail_kpis":   []
            }
            continue

        # --- Identification du niveau/profil ---
        statut_nom = statuts_agents.get(mat_str, '')
        # Correspondance insensible à la casse avec les niveaux de la grille
        statut_grille_entry = next(
            (s for s in statuts_grille if s.get('nom', '').strip().lower() == statut_nom.strip().lower()),
            statuts_grille[0]  # Fallback sur le premier niveau défini
        )

        prime_brute = float(statut_grille_entry.get('prime_brute') or 0)
        cibles      = statut_grille_entry.get('cibles', {})  # { kpi_frontend_id: valeur_cible }

        # --- Calcul KPI par KPI ---
        detail_kpis = []
        score_global = 0.0

        for ind in indicateurs:
            kpi_id      = ind.get('id')          # id frontend ex: "kpi_1779950722890"
            metric_key  = ind.get('metric_key')  # clé BQ ex: "Duration_call"
            poids       = float(ind.get('poids') or 0)
            direction   = ind.get('direction', 'higher_better')
            ponderation = ind.get('type_ponderation', 'bonus')  # 'bonus' | 'malus'

            val_reelle = _get_kpi_value(agent_kpis, metric_key)
            cible_raw  = cibles.get(kpi_id)
            cible      = float(cible_raw) if cible_raw not in (None, '') else None

            # Calcul de l'atteinte et du palier applicable
            if val_reelle is None or cible is None or cible == 0:
                atteinte_pct      = 0.0
                palier_applicable = _find_palier(paliers, 0.0)
            else:
                atteinte_pct      = _compute_atteinte(float(val_reelle), cible, direction)
                palier_applicable = _find_palier(paliers, atteinte_pct)

            pp = float(palier_applicable.get('pourcentage_paiement', 0))

            # Contribution au score global selon le type de pondération :
            #   bonus : le KPI ajoute  poids × (pp / 100) points
            #   malus : le KPI déduit  poids × ((100 - pp) / 100) points
            if ponderation == 'bonus':
                contribution = poids * (pp / 100)
            else:
                contribution = -(poids * ((100 - pp) / 100))

            score_global += contribution

            detail_kpis.append({
                "kpi_id":        kpi_id,
                "libelle":       ind.get('nom', metric_key),
                "metric_key":    metric_key,
                "valeur_reelle": val_reelle,
                "cible":         cible,
                "atteinte_pct":  atteinte_pct,
                "palier":        palier_applicable.get('label', '—'),
                "pourcentage_paiement": pp,
                "poids":         poids,
                "ponderation":   ponderation,
                "contribution":  round(contribution, 4)
            })

        score_global = max(0.0, round(score_global, 4))
        prime_finale = round(prime_brute * (score_global / 100), 2)

        # --- Malus assiduité (absences / retards) ---
        malus_applique = None
        agent_assiduite = assiduite_data.get(mat_str, {})
        if malus_rules and agent_assiduite:
            max_malus_pct = 0
            triggered_rule = None
            for rule in malus_rules:
                kpi_name   = rule.get('kpi', '')
                operateur  = rule.get('operateur', '>=')
                seuil      = float(rule.get('seuil', 0))
                type_malus = rule.get('type', 'partiel')
                malus_pct  = 100 if type_malus == 'total' else float(rule.get('malus_pct', 0))

                val_assiduite = agent_assiduite.get(kpi_name)
                if val_assiduite is None:
                    continue
                val_assiduite = float(val_assiduite)

                condition_ok = (
                    (operateur == '>=' and val_assiduite >= seuil) or
                    (operateur == '>'  and val_assiduite >  seuil) or
                    (operateur == '='  and val_assiduite == seuil)
                )
                if condition_ok and malus_pct > max_malus_pct:
                    max_malus_pct  = malus_pct
                    triggered_rule = rule

            if triggered_rule and max_malus_pct > 0:
                prime_finale = 0.0 if max_malus_pct >= 100 else round(prime_finale * (1 - max_malus_pct / 100), 2)
                malus_applique = {
                    "kpi":       triggered_rule.get('kpi'),
                    "valeur":    agent_assiduite.get(triggered_rule.get('kpi')),
                    "malus_pct": max_malus_pct,
                    "type":      triggered_rule.get('type'),
                }

        # --- Prorata de présence réelle ---
        prorata_info = None
        if mode_prorata != 'aucun' and agent_assiduite:
            if mode_prorata == 'jours':
                jours_travailles = float(agent_assiduite.get('jours_travailles') or 0)
                ref              = jours_ouvres_ref
                unite            = 'jours'
            else:  # heures
                jours_travailles = float(agent_assiduite.get('jours_travailles') or 0)
                # Convertir les jours réels en heures (approximation : heures = jours × (base/jours_ref))
                jours_travailles = round(jours_travailles * (base_horaire_ref / jours_ouvres_ref), 2)
                ref              = base_horaire_ref
                unite            = 'heures'

            if seuil_minimum is not None and jours_travailles < float(seuil_minimum):
                # En dessous du seuil minimum → aucune prime
                prime_finale = 0.0
                prorata_info = {
                    "mode":             mode_prorata,
                    "valeur_reelle":    jours_travailles,
                    "valeur_reference": ref,
                    "taux":             0.0,
                    "motif":            f"Seuil minimum non atteint ({jours_travailles:.1f} < {seuil_minimum} {unite})",
                }
            elif ref > 0:
                taux         = min(jours_travailles / ref, 1.0)  # Plafonné à 100%
                prime_finale = round(prime_finale * taux, 2)
                prorata_info = {
                    "mode":             mode_prorata,
                    "valeur_reelle":    jours_travailles,
                    "valeur_reference": ref,
                    "taux":             round(taux * 100, 2),
                    "motif":            None,
                }

        results[mat_str] = {
            "statut":         statut_nom or statut_grille_entry.get('nom'),
            "statut_utilise": statut_grille_entry.get('nom'),
            "prime_brute":    prime_brute,
            "score_global":   score_global,
            "prime_finale":   prime_finale,
            "bloque":         False,
            "motif_blocage":  None,
            "detail_kpis":    detail_kpis,
            "malus_assiduite": malus_applique,
            "prorata_presence": prorata_info,
        }

    return results
