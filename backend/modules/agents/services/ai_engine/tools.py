# backend/modules/agents/services/ai_engine/tools.py

import json
import time
import logging
import difflib
import statistics
import calendar
import datetime as _dt
import random
import os
from google.cloud import bigquery as bq_types

from config.db_mysql_connector import get_mysql_connection
from modules.regles_primes.services.dw_api_regles_provider import (
    get_regle_by_id,
    create_regle_config,
    update_regle
)
from modules.parametres.services.mapping_provider import get_all_kpis_with_status
from modules.performance.services.dw_api_performance_provider import get_perf_totaux_par_matricule
from modules.notes_qualite.services.dw_api_qualite_provider import get_qualite_totaux_par_matricule
from modules.heures_agents.services.dw_api_heures_provider import get_totaux_par_matricule
from core.db.bigquery import get_bigquery_client
from core.socket import emit_update

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# Helpers privés
# ─────────────────────────────────────────────────────────────

def _compute_date_range(mois: str) -> tuple:
    """
    Calcule (date_debut, date_fin, mois_label) depuis un mois 'YYYY-MM' ou
    couvre les 3 derniers mois complets si mois est vide.
    """
    if mois and len(mois) >= 7:
        year, month = int(mois[:4]), int(mois[5:7])
        last_day = calendar.monthrange(year, month)[1]
        return (
            f"{year}-{month:02d}-01",
            f"{year}-{month:02d}-{last_day}",
            mois
        )
    today     = _dt.date.today()
    last_prev = today.replace(day=1) - _dt.timedelta(days=1)
    start_m   = last_prev.month - 2
    start_y   = last_prev.year
    if start_m <= 0:
        start_m += 12
        start_y -= 1
    return (
        f"{start_y}-{start_m:02d}-01",
        f"{last_prev.year}-{last_prev.month:02d}-{last_prev.day}",
        f"{_dt.date(start_y, start_m, 1).strftime('%b %Y')} – {last_prev.strftime('%b %Y')}"
    )


def _fetch_agents_for_regle(regle_id: int) -> tuple:
    """
    Retourne (matricules, bq_name_to_mat) pour la structure associée à la règle.
    bq_name_to_mat : { "NOM PRENOM" : "matricule" }
    """
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id_structure FROM matrice_primes WHERE id = %s", (regle_id,))
            row = cur.fetchone()
            if not row or not row.get('id_structure'):
                return [], {}

            id_structure = row['id_structure']
            cur.execute(
                "SELECT id_projet, id_operation, id_sous_projet, id_activite "
                "FROM ref_structure_map WHERE id = %s",
                (id_structure,)
            )
            struct = cur.fetchone()

            where_parts, p = [], []
            if struct:
                for k, v in struct.items():
                    if v and k != 'id_projet':
                        where_parts.append(f"{k} = %s")
                        p.append(v)

            if not where_parts:
                cur.execute(
                    "SELECT matricule, nom, prenom FROM ref_employes WHERE id_structure = %s",
                    (id_structure,)
                )
            else:
                cur.execute(
                    f"SELECT matricule, nom, prenom FROM ref_employes WHERE {' AND '.join(where_parts)}",
                    p
                )
            agents_rows = cur.fetchall()
    finally:
        conn.close()

    matricules     = [r['matricule'] for r in agents_rows if r['matricule']]
    bq_name_to_mat = {}
    for r in agents_rows:
        nom    = (r.get('nom')    or '').strip().upper()
        prenom = (r.get('prenom') or '').strip().upper()
        full_name = f"{nom} {prenom}".strip()
        if full_name and r.get('matricule'):
            bq_name_to_mat[full_name] = str(r['matricule'])
    return matricules, bq_name_to_mat


def _normalize_grille_metric_keys(grille: dict) -> dict:
    """
    Normalise les metric_key des indicateurs vers les code_kpi canoniques de config_kpis
    (casse incluse). Garantit la cohérence entre la grille JSON et le moteur KPI.
    """
    try:
        all_kpis   = get_all_kpis_with_status()
        code_index = {k['code'].upper(): k['code'] for k in all_kpis}
        bq_to_code = {
            bq.upper(): k['code']
            for k in all_kpis
            for bq in (k.get('bq_kpi_codes') or [])
        }
        for ind in grille.get('indicateurs', []):
            mk = ind.get('metric_key', '')
            if not mk:
                continue
            mk_upper = mk.upper()
            if mk_upper in code_index:
                ind['metric_key'] = code_index[mk_upper]
            elif mk_upper in bq_to_code:
                ind['metric_key'] = bq_to_code[mk_upper]
            else:
                logger.warning("[normalize_metric_keys] metric_key '%s' non reconnu dans config_kpis", mk)
    except Exception as e:
        logger.warning("[normalize_metric_keys] Impossible de normaliser les metric_key : %s", e)
    return grille


# ─────────────────────────────────────────────────────────────
# Outils IA
# ─────────────────────────────────────────────────────────────

def get_regle_info_tool(regle_id: int) -> str:
    """
    Retourne TOUTES les informations d'une règle de prime (description, KPIs, objectifs, paliers)
    à partir de son identifiant (regle_id).
    À utiliser obligatoirement dès qu'une question porte sur le contenu de la règle courante.
    """
    logger.info(f"[IA Tool] get_regle_info_tool → regle_id={regle_id}")
    try:
        regle_data = get_regle_by_id(regle_id)
        if not regle_data:
            return f"Erreur: Aucune règle trouvée pour l'ID {regle_id}."

        info  = f"--- RÈGLE ID {regle_data['id']} ---\n"
        info += f"Code: {regle_data['code']}\n"
        info += f"Nom: {regle_data['nom']}\n"
        info += f"Projet: {regle_data.get('projet', 'Global')}\n"
        info += f"Description: {regle_data.get('description', 'Aucune description')}\n"
        info += f"Statut: {'Active' if regle_data['actif'] else 'Inactive'}\n\n"
        info += "--- GRILLE D'OBJECTIFS (KPIs / PALIERS) ---\n"
        if regle_data.get('grille_objectifs'):
            info += json.dumps(regle_data['grille_objectifs'], indent=2, ensure_ascii=False)
        else:
            info += "Aucune grille d'objectifs configurée pour cette règle."
        return info
    except Exception as e:
        logger.error(f"[IA Tool] Erreur get_regle_info_tool: {e}")
        return f"Erreur interne lors de la récupération de la règle: {str(e)}"


def get_active_grille_json_tool(regle_id: int) -> str:
    """
    Retourne le JSON BRUT et COMPLET de la grille d'objectifs actuellement active pour une règle.
    À utiliser OBLIGATOIREMENT comme première étape avant toute modification de grille.
    Retourne aussi la liste des autres versions disponibles (non actives) pour information.
    """
    logger.info(f"[IA Tool] get_active_grille_json_tool → regle_id={regle_id}")
    try:
        conn = get_mysql_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, libelle, content, grille_nom, created_at "
                    "FROM matrice_primes_configs WHERE matrice_id = %s AND est_active = 1 LIMIT 1",
                    (regle_id,)
                )
                active_row = cur.fetchone()
                cur.execute(
                    "SELECT id, libelle, grille_nom, est_active, created_at "
                    "FROM matrice_primes_configs WHERE matrice_id = %s ORDER BY grille_ordre ASC, created_at DESC",
                    (regle_id,)
                )
                all_versions = cur.fetchall()
        finally:
            conn.close()

        result = ""
        if active_row:
            content = active_row['content']
            if isinstance(content, str):
                content = json.loads(content)
            result += f"=== GRILLE ACTIVE (version ID={active_row['id']}) ===\n"
            result += f"Nom : {active_row.get('grille_nom') or active_row['libelle']}\n"
            result += f"Créée le : {active_row['created_at']}\n\n"
            result += "JSON COMPLET DE LA GRILLE (à modifier puis renvoyer via prepare_grille_proposal_tool) :\n"
            result += json.dumps(content, indent=2, ensure_ascii=False)
        else:
            regle_data = get_regle_by_id(regle_id)
            if regle_data and regle_data.get('grille_objectifs'):
                result += "=== GRILLE ACTIVE (depuis grille_objectifs de la règle) ===\n"
                result += "JSON COMPLET DE LA GRILLE :\n"
                result += json.dumps(regle_data['grille_objectifs'], indent=2, ensure_ascii=False)
            else:
                result += "⚠️ Aucune grille active trouvée pour cette règle. "
                result += "Utilise prepare_grille_proposal_tool pour en proposer une nouvelle."

        if all_versions:
            result += "\n\n=== HISTORIQUE DES VERSIONS ===\n"
            for v in all_versions:
                active_flag = " ← ACTIVE" if v['est_active'] else ""
                result += f"  • ID={v['id']} | {v.get('grille_nom') or v['libelle']} | {v['created_at']}{active_flag}\n"
        return result
    except Exception as e:
        logger.error(f"[IA Tool] Erreur get_active_grille_json_tool: {e}", exc_info=True)
        return f"❌ Erreur interne lors de la récupération de la grille : {str(e)}"


def get_context_notes_tool(regle_id: int) -> str:
    """
    Retourne toutes les notes mémorisées (mémoire persistante) pour une règle donnée.
    À lire systématiquement en début de conversation.
    """
    logger.info(f"[IA Tool] get_context_notes_tool → regle_id={regle_id}")
    try:
        conn = get_mysql_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, note, created_at FROM ai_regle_context "
                    "WHERE regle_id = %s ORDER BY created_at ASC",
                    (regle_id,)
                )
                rows = cur.fetchall()
        finally:
            conn.close()

        if not rows:
            return f"Aucune note mémorisée pour la règle ID={regle_id}. C'est la première interaction avec cette règle."
        lines = [f"=== MÉMOIRE CONTEXTUELLE — Règle ID {regle_id} ({len(rows)} note(s)) ==="]
        for r in rows:
            lines.append(f"  [{r['created_at']}] {r['note']}")
        lines.append("=== FIN DE LA MÉMOIRE ===")
        return "\n".join(lines)
    except Exception as e:
        logger.error(f"[IA Tool] Erreur get_context_notes_tool: {e}", exc_info=True)
        return f"❌ Erreur lors de la lecture de la mémoire : {str(e)}"


def save_context_note_tool(regle_id: int, note: str) -> str:
    """
    Sauvegarde une note permanente dans la mémoire contextuelle de la règle.
    """
    logger.info(f"[IA Tool] save_context_note_tool → regle_id={regle_id}, note='{note[:80]}...'")
    if not note or not note.strip():
        return "❌ La note est vide. Rien n'a été sauvegardé."
    try:
        conn = get_mysql_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM matrice_primes WHERE id = %s", (regle_id,))
                if not cur.fetchone():
                    return f"❌ Règle ID={regle_id} introuvable. Note non sauvegardée."
                cur.execute(
                    "INSERT INTO ai_regle_context (regle_id, note) VALUES (%s, %s)",
                    (regle_id, note.strip())
                )
                conn.commit()
                note_id = cur.lastrowid
        finally:
            conn.close()
        return f"✅ Note mémorisée (ID={note_id}) pour la règle ID={regle_id}."
    except Exception as e:
        logger.error(f"[IA Tool] Erreur save_context_note_tool: {e}", exc_info=True)
        return f"❌ Erreur lors de la sauvegarde de la note : {str(e)}"


def get_real_performance_tool(regle_id: int, mois: str) -> str:
    """
    Interroge les données de performance RÉELLES de l'équipe associée à la règle.
    Quand mois est vide, couvre les 3 derniers mois complets pour fiabiliser l'analyse.
    Retourne notamment la section KPIS SANS DONNÉES à consulter OBLIGATOIREMENT
    avant de créer une grille — si un KPI est listé là-dedans, l'utilisateur DOIT en être averti.
    """
    logger.info(f"[IA Tool] get_real_performance_tool → regle_id={regle_id}, mois={mois}")

    try:
        date_debut, date_fin, mois_label = _compute_date_range(mois)
    except Exception as e:
        return f"❌ Format de mois invalide (attendu YYYY-MM) : {e}"

    try:
        matricules, bq_name_to_mat = _fetch_agents_for_regle(regle_id)
    except Exception as e:
        logger.error(f"[IA Tool] Erreur récupération agents: {e}", exc_info=True)
        return f"⚠️ La règle ID={regle_id} n'a pas de structure associée ou erreur DB."

    if not matricules:
        return f"ℹ️ Aucun agent trouvé pour la structure associée à la règle ID={regle_id}."

    bq_names       = list(bq_name_to_mat.keys())
    bq_lookup_keys = bq_names if bq_names else [str(m) for m in matricules]
    mat_to_bq_name = {v: k for k, v in bq_name_to_mat.items()}

    perf_map, qualite_map, data_errors = {}, {}, []

    try:
        perf_by_name = get_perf_totaux_par_matricule(date_debut, date_fin, bq_lookup_keys)
        perf_map = {bq_name_to_mat.get(n, n): v for n, v in perf_by_name.items()}
    except Exception as e:
        logger.error(f"[IA Tool] Erreur performance BQ: {e}", exc_info=True)
        data_errors.append("Performance")

    try:
        qualite_by_name = get_qualite_totaux_par_matricule(date_debut, date_fin, bq_lookup_keys)
        qualite_map = {bq_name_to_mat.get(n, n): v for n, v in qualite_by_name.items()}
    except Exception as e:
        logger.error(f"[IA Tool] Erreur qualité BQ: {e}", exc_info=True)
        data_errors.append("Qualité")

    try:
        get_totaux_par_matricule(date_debut, date_fin, matricules)
    except Exception as e:
        logger.error(f"[IA Tool] Erreur heures BQ: {e}", exc_info=True)
        data_errors.append("Heures")

    if len(data_errors) == 3:
        return '{"status": "error", "message": "Impossible d\'accéder aux données de performance pour le moment."}'

    def _stats(vals):
        valid = [v for v in vals if v is not None]
        if not valid:
            return None
        return {
            "min"   : round(min(valid), 2),
            "max"   : round(max(valid), 2),
            "moy"   : round(statistics.mean(valid), 2),
            "median": round(statistics.median(valid), 2),
            "n"     : len(valid)
        }

    def _suggest_target(st, higher):
        if not st:
            return None
        return round(st['median'] * 1.07 if higher else st['median'] * 0.93, 2)

    def _section(title, kpi_dict):
        s, has_data = f"### {title}\n", False
        for key, (values, higher, unite, label) in kpi_dict.items():
            st = _stats(values)
            if not st:
                continue
            has_data  = True
            direction = "↑ higher_better" if higher else "↓ lower_better"
            suggest   = _suggest_target(st, higher)
            s += f"- **{label}** (`{key}`) [{unite}] — {direction}\n"
            s += f"  - Min={st['min']} | Moy={st['moy']} | Médiane={st['median']} | Max={st['max']}\n"
            if suggest:
                s += f"  - 💡 Objectif suggéré : {suggest} {unite}\n"
        return (s + "\n") if has_data else ""

    # Échantillon de 3 agents
    sample_matricules = random.sample([str(m) for m in matricules], min(3, len(matricules)))
    sample_data = ""
    for m in sample_matricules:
        display_name = mat_to_bq_name.get(str(m), f"Agent {m}")
        sample_data += f"- **{display_name.title()}** (mat. {m}):\n"
        if str(m) in perf_map:
            ca     = perf_map[str(m)].get('chiffre_affaire', 0) or perf_map[str(m)].get('CHIFFRE_AFFAIRE', 'N/A')
            ventes = perf_map[str(m)].get('nb_ventes', 'N/A')
            sample_data += f"  - CA: {ca} | Ventes: {ventes}\n"
        if str(m) in qualite_map:
            sample_data += f"  - Qualité: {qualite_map[str(m)]}%\n"

    kpi_perf = {
        "revenue_amt_eur": ([v.get("chiffre_affaire") for v in perf_map.values()], True,  "€",      "Chiffre d'Affaires"),
        "booking_nbr"    : ([v.get("nb_ventes")       for v in perf_map.values()], True,  "ventes", "Nombre de Ventes"),
        "DMT"            : ([v.get("dmt")             for v in perf_map.values()], False, "sec",    "DMT"),
        "IS_CONVERTED"   : ([v.get("taux_conversion") for v in perf_map.values()], True,  "%",      "Taux de Conversion"),
    }
    kpi_qualite = {
        "QUALITE": ([v for v in qualite_map.values()], True, "%", "Note Qualité Globale")
    }

    # Disponibilité des données par KPI
    kpis_sans_donnees, kpis_avec_donnees = [], []
    for metric_key, (values, *_, label) in {**kpi_perf, **kpi_qualite}.items():
        valid = [v for v in values if v is not None]
        if valid:
            kpis_avec_donnees.append({"metric_key": metric_key, "label": label, "nb_agents": len(valid)})
        else:
            kpis_sans_donnees.append({"metric_key": metric_key, "label": label})

    out  = f"## Données réelles de l'équipe — {mois_label}\n\n"
    out += f"**Règle ID {regle_id}** | **{len(matricules)} agent(s) ciblé(s)** | Période : {date_debut} → {date_fin}\n\n"
    if sample_data:
        out += "### Échantillon d'agents (pour simuler la prime)\n" + sample_data + "\n"
    if data_errors:
        out += f"⚠️ Données partiellement indisponibles ({', '.join(data_errors)}).\n\n"

    out += _section("Performance (BigQuery)", kpi_perf)
    out += _section("Qualité (BigQuery)", kpi_qualite)

    if kpis_avec_donnees:
        out += "### ✅ KPIs avec données disponibles\n"
        for k in kpis_avec_donnees:
            out += f"  • **{k['label']}** (`{k['metric_key']}`) — données sur {k['nb_agents']} agent(s)\n"
        out += "\n"

    if kpis_sans_donnees:
        out += "### ⚠️ KPIS SANS DONNÉES — AVERTISSEMENT OBLIGATOIRE\n"
        out += f"Ces KPIs n'ont aucune valeur sur la période analysée ({mois_label}).\n"
        out += "OBLIGATION : signaler ce point à l'utilisateur avant d'inclure ces KPIs dans la grille.\n"
        for k in kpis_sans_donnees:
            out += f"  • ❌ **{k['label']}** (`{k['metric_key']}`) — AUCUNE donnée disponible\n"
        out += f"\nkpis_sans_donnees: {json.dumps([k['metric_key'] for k in kpis_sans_donnees])}\n"
    else:
        out += "### ✅ Toutes les métriques connues ont des données sur la période analysée.\n"

    return out


def list_available_kpis_tool(regle_id: int) -> str:
    """
    Retourne la liste de TOUS les KPIs disponibles pour une règle donnée (en filtrant par projet).
    1. Les KPIs normalisés (recommandés) configurés dans la base.
    2. Les métriques brutes non normalisées actuellement présentes dans le Data Warehouse (BigQuery).
    Utilise ces informations pour demander des clarifications à l'utilisateur si besoin.
    """
    logger.info(f"[IA Tool] list_available_kpis_tool pour regle_id={regle_id}")
    try:
        regle_data = get_regle_by_id(regle_id)
        projet     = regle_data.get('projet') if regle_data else None
        kpis_norm  = get_all_kpis_with_status()

        lines = ["--- KPIs NORMALISÉS DISPONIBLES (À PRIVILÉGIER POUR LA GRILLE) ---\n"]
        current_univers = None
        for k in kpis_norm:
            if not k['actif']:
                continue
            if k['univers'] != current_univers:
                current_univers = k['univers']
                lines.append(f"\n[Catégorie : {current_univers}]")
            tech_key    = k.get('tech_key') or k['code']
            libelle     = k.get('libelle') or k['code']
            description = k.get('description') or ''
            desc_str    = f" — {description}" if description else ''
            lines.append(f"  • Libellé : \"{libelle}\"{desc_str}")
            lines.append(f"    [tech_key interne (metric_key) : '{tech_key}']")

        lines.append(f"\n\n--- MÉTRIQUES BRUTES DISPONIBLES SUR LE PROJET '{projet or 'TOUS'}' (NON NORMALISÉES) ---")
        lines.append("IMPORTANT : Depuis BigQuery, tu dois toujours choisir la valeur '_sum' (total du mois) ou '_avg' (moyenne quotidienne).")
        lines.append("Si l'utilisateur demande un KPI absent de la liste normalisée, utilise la bonne variante brute (ex: Duration_call_avg) comme 'metric_key'.")

        PROJECT_ID   = os.getenv('GCP_PROJECT_ID', 'data-project-438313')
        # Utilise BQ_DATASET_ID en priorité (cohérence avec le reste du backend)
        DATASET_PAIE = os.getenv('BQ_DATASET_ID') or os.getenv('BQ_DATASET_PAIE') or 'gcp_my_paie'
        client       = get_bigquery_client()

        # Paramétrage BigQuery
        if projet:
            # Pour PVCP, on veut PERFORMANCE (PVCP) et QUALITE (PVCP_FR, PVCP_BE, PVCP_EVALPLUS, etc.)
            where_clause_perf = "WHERE projet = @projet"
            where_clause_qual = "WHERE projet LIKE @projet_prefix"
            job_config = bq_types.QueryJobConfig(
                query_parameters=[
                    bq_types.ScalarQueryParameter("projet", "STRING", projet),
                    bq_types.ScalarQueryParameter("projet_prefix", "STRING", f"{projet}%")
                ]
            )
        else:
            where_clause_perf = ""
            where_clause_qual = ""
            job_config = bq_types.QueryJobConfig()

        sql = f"""
            SELECT DISTINCT kpi_code, 'PERFORMANCE' as univers
            FROM `{PROJECT_ID}.{DATASET_PAIE}.paie_performance_mensuelle` {where_clause_perf}
            UNION ALL
            SELECT DISTINCT kpi_code, 'QUALITE' as univers
            FROM `{PROJECT_ID}.{DATASET_PAIE}.paie_qualite_mensuelle` {where_clause_qual}
        """
        try:
            bq_rows  = client.query(sql, job_config=job_config).result()
            perf_raw, qual_raw = [], []
            for r in bq_rows:
                if not r.kpi_code: continue
                if r.univers == 'PERFORMANCE':
                    # L'architecture dynamique exporte systématiquement _sum et _avg
                    perf_raw.extend([f"{r.kpi_code}_sum", f"{r.kpi_code}_avg"])
                else:
                    qual_raw.append(r.kpi_code)

            lines.append("\n[Catégorie : PERFORMANCE (Brut)]")
            lines.append(
                f"  • Codes disponibles : {', '.join(sorted(set(perf_raw)))}"
                if perf_raw else "  (Aucune métrique de performance trouvée pour ce projet)"
            )
            lines.append("\n[Catégorie : QUALITE (Brut)]")
            lines.append(
                f"  • Codes disponibles : {', '.join(sorted(qual_raw))}"
                if qual_raw else "  (Aucune métrique de qualité trouvée pour ce projet)"
            )
        except Exception as e:
            logger.warning(f"Impossible de lire BQ pour list_available_kpis_tool: {e}")
            lines.append("  (Indisponible actuellement)")

        return "\n".join(lines)
    except Exception as e:
        logger.error(f"[IA Tool] Erreur list_available_kpis_tool: {e}")
        return '{"status": "error", "message": "Impossible d\'accéder au référentiel des KPIs pour le moment."}'


def resolve_kpi_names_tool(regle_id: int, user_kpi_names_json: str) -> str:
    """
    Résout les noms de KPIs mentionnés par l'utilisateur vers les codes KPI officiels de la base.

    À appeler EN PREMIER dès que l'utilisateur mentionne des noms d'indicateurs dans sa description
    de grille (ex: "DMT", "Taux de Conversion", "AVG NBR", "Qualité", "Tx MEA", etc.).

    Paramètres :
    - regle_id            : ID de la règle courante
    - user_kpi_names_json : JSON array des noms mentionnés, ex: '["DMT", "CVR Naturelle", "Tx MEA"]'

    Retourne un objet JSON :
    {
      "resolved"  : [{ "user_name", "code_kpi", "libelle", "univers", "confidence" }],
      "unresolved": [{ "user_name", "best_guess": {...} | null, "candidates": [tous les KPIs actifs] }],
      "summary"   : { "total", "resolved_count", "unresolved_count" }
    }
    """
    logger.info(f"[IA Tool] resolve_kpi_names_tool → regle_id={regle_id}, names={user_kpi_names_json}")

    try:
        if isinstance(user_kpi_names_json, list):
            user_names = user_kpi_names_json
        else:
            stripped = user_kpi_names_json.strip()
            if stripped.startswith('['):
                try:
                    user_names = json.loads(stripped)
                except Exception:
                    user_names = [stripped]
            else:
                user_names = [n.strip() for n in stripped.replace(';', ',').split(',') if n.strip()]

        if not user_names:
            return json.dumps({"error": "Liste de noms vide."}, ensure_ascii=False)

        all_kpis    = get_all_kpis_with_status()
        active_kpis = [k for k in all_kpis if k.get('actif')]

        candidates_list = [
            {
                "code_kpi"   : k['code'],
                "libelle"    : k['libelle'],
                "univers"    : k['univers'],
                "description": (k.get('description') or ''),
                "bq_aliases" : (k.get('bq_kpi_codes') or [])
            }
            for k in active_kpis
        ]

        # ── Enrichissement avec les KPIs bruts BigQuery si le référentiel normalisé est vide ──
        # Cas courant : aucun KPI n'a encore été configuré dans Paramètres → KPIs.
        # On récupère les codes bruts de BQ pour les proposer comme candidats de repli.
        bq_raw_candidates = []
        use_raw_mode = len(active_kpis) == 0
        if use_raw_mode:
            try:
                regle_data = get_regle_by_id(regle_id)
                projet = regle_data.get('projet') if regle_data else None
                PROJECT_ID   = os.getenv('GCP_PROJECT_ID', 'data-project-438313')
                DATASET_PAIE = os.getenv('BQ_DATASET_ID') or os.getenv('BQ_DATASET_PAIE') or 'gcp_my_paie'
                client = get_bigquery_client()
                if projet:
                    sql = f"""
                        SELECT DISTINCT TRIM(kpi_code) as kpi_code, 'PERFORMANCE' as univers
                        FROM `{PROJECT_ID}.{DATASET_PAIE}.paie_performance_mensuelle`
                        WHERE projet = @projet AND kpi_code IS NOT NULL AND TRIM(kpi_code) != ''
                        UNION DISTINCT
                        SELECT DISTINCT TRIM(kpi_code) as kpi_code, 'QUALITE' as univers
                        FROM `{PROJECT_ID}.{DATASET_PAIE}.paie_qualite_mensuelle`
                        WHERE projet LIKE @projet_prefix AND kpi_code IS NOT NULL AND TRIM(kpi_code) != ''
                    """
                    job_config = bq_types.QueryJobConfig(
                        query_parameters=[
                            bq_types.ScalarQueryParameter("projet", "STRING", projet),
                            bq_types.ScalarQueryParameter("projet_prefix", "STRING", f"{projet}%")
                        ]
                    )
                    for r in client.query(sql, job_config=job_config).result():
                        if r.univers == 'PERFORMANCE':
                            # Architecture dynamique (Zéro code en dur) : ajout de _sum et _avg
                            bq_raw_candidates.append({
                                "code_kpi"   : f"{r.kpi_code}_sum",
                                "libelle"    : f"{r.kpi_code} (Somme/Total)",
                                "univers"    : r.univers,
                                "description": "Somme totale sur le mois",
                                "bq_aliases" : [],
                                "source"     : "raw_bq"
                            })
                            bq_raw_candidates.append({
                                "code_kpi"   : f"{r.kpi_code}_avg",
                                "libelle"    : f"{r.kpi_code} (Moyenne)",
                                "univers"    : r.univers,
                                "description": "Moyenne quotidienne sur le mois",
                                "bq_aliases" : [],
                                "source"     : "raw_bq"
                            })
                        else:
                            bq_raw_candidates.append({
                                "code_kpi"   : r.kpi_code,
                                "libelle"    : r.kpi_code,
                                "univers"    : r.univers,
                                "description": "",
                                "bq_aliases" : [],
                                "source"     : "raw_bq"
                            })
                    candidates_list = bq_raw_candidates
            except Exception as e:
                logger.warning(f"[resolve_kpi] Impossible de charger les KPIs bruts BQ: {e}")

        CONFIDENCE_THRESHOLD = 0.55 if use_raw_mode else 0.62
        resolved, unresolved = [], []

        # Corpus de matching : KPIs normalisés ou bruts BQ
        match_corpus = bq_raw_candidates if use_raw_mode else active_kpis

        for raw_name in user_names:
            user_name  = raw_name.strip()
            user_lower = user_name.lower()
            best_score, best_match = 0.0, None

            for kpi in match_corpus:
                if use_raw_mode:
                    code_lower = kpi['code_kpi'].lower()
                    scores = [difflib.SequenceMatcher(None, user_lower, code_lower).ratio()]
                    if user_lower in code_lower or code_lower in user_lower:
                        scores.append(0.80)
                    # acronyme : "DMT" vs "Duration_call" → 'd', 'c' → faible mais tentative
                    words   = code_lower.replace('_', ' ').split()
                    acronym = ''.join(w[0] for w in words if w)
                    if user_lower == acronym:
                        scores.append(0.85)
                    local_best = max(scores)
                    if local_best > best_score:
                        best_score, best_match = local_best, kpi
                else:
                    kpi_obj       = kpi
                    libelle_lower = kpi_obj['libelle'].lower()
                    desc_lower    = (kpi_obj.get('description') or '').lower()
                    code_lower    = kpi_obj['code'].lower()
                    bq_aliases    = [a.lower() for a in (kpi_obj.get('bq_kpi_codes') or [])]

                    if user_lower == libelle_lower:
                        best_score, best_match = 1.0, kpi_obj; break
                    if user_lower == code_lower:
                        best_score, best_match = 0.98, kpi_obj; break
                    if user_lower in bq_aliases:
                        best_score, best_match = 0.97, kpi_obj; break

                    scores = []
                    if user_lower in libelle_lower or libelle_lower in user_lower:
                        scores.append(0.85)
                    scores.append(difflib.SequenceMatcher(None, user_lower, libelle_lower).ratio())
                    if desc_lower:
                        scores.append(difflib.SequenceMatcher(None, user_lower, desc_lower).ratio() * 0.7)
                    words   = libelle_lower.split()
                    acronym = ''.join(w[0] for w in words if w)
                    if user_lower == acronym:
                        scores.append(0.90)
                    elif user_lower in acronym or acronym.startswith(user_lower):
                        scores.append(0.75)
                    for alias in bq_aliases:
                        sim = difflib.SequenceMatcher(None, user_lower, alias).ratio()
                        if sim > 0.8:
                            scores.append(sim * 0.95)
                        elif user_lower in alias or alias in user_lower:
                            scores.append(0.78)
                    local_best = max(scores) if scores else 0.0
                    if local_best > best_score:
                        best_score, best_match = local_best, kpi_obj

            if best_match and best_score >= CONFIDENCE_THRESHOLD:
                if use_raw_mode:
                    resolved.append({
                        "user_name" : user_name,
                        "code_kpi"  : best_match['code_kpi'],
                        "libelle"   : best_match['code_kpi'],
                        "univers"   : best_match['univers'],
                        "confidence": round(best_score, 2),
                        "source"    : "raw_bq"
                    })
                else:
                    resolved.append({
                        "user_name" : user_name,
                        "code_kpi"  : best_match['code'],
                        "libelle"   : best_match['libelle'],
                        "univers"   : best_match['univers'],
                        "confidence": round(best_score, 2)
                    })
            else:
                best_guess = None
                if best_match:
                    if use_raw_mode:
                        best_guess = {"code_kpi": best_match['code_kpi'], "libelle": best_match['code_kpi'], "confidence": round(best_score, 2), "source": "raw_bq"}
                    else:
                        best_guess = {"code_kpi": best_match['code'], "libelle": best_match['libelle'], "confidence": round(best_score, 2)}
                unresolved.append({
                    "user_name" : user_name,
                    "best_guess": best_guess,
                    "candidates": candidates_list
                })

        result = {
            "resolved"  : resolved,
            "unresolved": unresolved,
            "mode"      : "raw_bq" if use_raw_mode else "normalized",
            "summary"   : {
                "total"           : len(user_names),
                "resolved_count"  : len(resolved),
                "unresolved_count": len(unresolved),
                "referentiel_vide": use_raw_mode
            }
        }
        logger.info(f"[IA Tool] resolve_kpi_names_tool → {len(resolved)} résolus, {len(unresolved)} non résolus (mode={'raw_bq' if use_raw_mode else 'normalized'})")
        return json.dumps(result, ensure_ascii=False, indent=2)

    except Exception as e:
        logger.error(f"[IA Tool] Erreur resolve_kpi_names_tool: {e}", exc_info=True)
        return json.dumps({"error": f"Erreur interne : {str(e)}"}, ensure_ascii=False)


def prepare_grille_proposal_tool(regle_id: int, grille_nom: str, grille_json: str) -> str:
    """
    Valide et génère une PROPOSITION de grille d'objectifs pour une règle de prime.
    """
    logger.info(f"[IA Tool] prepare_grille_proposal_tool → regle_id={regle_id}, nom='{grille_nom}'")
    try:
        grille = json.loads(grille_json) if isinstance(grille_json, str) else grille_json
        missing = [k for k in ('indicateurs', 'statuts', 'paliers') if k not in grille]
        if missing:
            return f"❌ Erreur : JSON incomplet. Clés manquantes : {', '.join(missing)}"

        all_kpis       = get_all_kpis_with_status()
        valid_tech_keys = {k.get('tech_key') or k['code'] for k in all_kpis}
        valid_codes     = {k['code'] for k in all_kpis}
        kpis_not_found  = [
            ind.get('metric_key', '')
            for ind in grille.get('indicateurs', [])
            if ind.get('metric_key') and ind['metric_key'] not in valid_tech_keys and ind['metric_key'] not in valid_codes
        ]
        if kpis_not_found:
            logger.warning(f"[IA Tool] KPIs non reconnus : {kpis_not_found} — proposition autorisée quand même")

        for i, ind in enumerate(grille.get('indicateurs', [])):
            if not ind.get('id'):
                ind['id'] = f"kpi_{int(time.time())}_{i}"

        if not get_regle_by_id(regle_id):
            return f"❌ Règle ID {regle_id} introuvable."

        resume  = f"### 📝 Proposition de configuration : **{grille_nom}**\n\n"
        resume += "Cette configuration est prête à être examinée. Elle n'est pas encore appliquée.\n\n"
        resume += "**Indicateurs et poids :**\n"
        for ind in grille.get('indicateurs', []):
            resume += f"  • {ind.get('nom', ind.get('metric_key'))} ({ind.get('poids', 0)} pts)\n"
        resume += f"\n```json_grille_proposal\n{json.dumps(grille, indent=2, ensure_ascii=False)}\n```\n"
        return resume
    except Exception as e:
        logger.error(f"[IA Tool] Erreur prepare_grille_proposal_tool: {e}", exc_info=True)
        return f"❌ Erreur interne : {str(e)}"


def save_grille_config_tool(regle_id: int, grille_nom: str, grille_json: str) -> str:
    """
    Crée RÉELLEMENT et ACTIVE immédiatement une nouvelle version de grille en base de données.
    À utiliser UNIQUEMENT si l'utilisateur demande explicitement de créer/sauvegarder/appliquer la grille
    APRÈS avoir vu une proposition.
    """
    logger.info(f"[IA Tool] save_grille_config_tool → regle_id={regle_id}, nom='{grille_nom}'")
    try:
        grille = json.loads(grille_json) if isinstance(grille_json, str) else grille_json
        grille = _normalize_grille_metric_keys(grille)
        res    = create_regle_config(
            regle_id   = regle_id,
            libelle    = grille_nom,
            content    = grille,
            activate   = True,
            grille_uuid= f"grille_ia_{int(time.time())}",
            grille_nom = grille_nom
        )
        if res.get("status") == "success":
            emit_update("regle_configs_updated", {"regle_id": regle_id})
            return f"✅ La grille '{grille_nom}' a été créée et activée avec succès. L'interface a été actualisée."
        return f"❌ Échec de la création en base : {res}"
    except Exception as e:
        logger.error(f"[IA Tool] Erreur save_grille_config_tool: {e}")
        return f"❌ Erreur lors de la sauvegarde : {str(e)}"


def rename_grille_version_tool(regle_id: int, new_name: str) -> str:
    """
    Renomme la version de grille actuellement active pour une règle de prime.
    Ne crée PAS de nouvelle version — modifie uniquement le nom de la version active existante.
    """
    logger.info(f"[IA Tool] rename_grille_version_tool → regle_id={regle_id}, new_name='{new_name}'")
    if not new_name or not new_name.strip():
        return "❌ Le nouveau nom est vide. Veuillez fournir un nom valide."
    try:
        conn = get_mysql_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, grille_nom, libelle FROM matrice_primes_configs "
                    "WHERE matrice_id = %s AND est_active = 1 LIMIT 1",
                    (regle_id,)
                )
                active = cur.fetchone()
                if not active:
                    return f"⚠️ Aucune version active trouvée pour la règle ID={regle_id}. Impossible de renommer."
                old_name = active.get('grille_nom') or active.get('libelle') or f"Version #{active['id']}"
                cur.execute(
                    "UPDATE matrice_primes_configs SET grille_nom = %s, libelle = %s "
                    "WHERE matrice_id = %s AND est_active = 1",
                    (new_name.strip(), new_name.strip(), regle_id)
                )
                conn.commit()
        finally:
            conn.close()
        emit_update("regle_configs_updated", {"regle_id": regle_id})
        return f"✅ Version renommée : '{old_name}' → '{new_name.strip()}'. L'interface a été actualisée."
    except Exception as e:
        logger.error(f"[IA Tool] Erreur rename_grille_version_tool: {e}", exc_info=True)
        return '{"status": "error", "message": "Impossible de renommer la version pour le moment."}'


def update_regle_metadata_tool(regle_id: int, nom: str, description: str) -> str:
    """
    Met à jour les informations générales (nom, description) de la règle de prime.
    À utiliser si l'utilisateur demande de renommer la règle ou d'en changer la description.
    """
    logger.info(f"[IA Tool] update_regle_metadata_tool → regle_id={regle_id}")
    try:
        current = get_regle_by_id(regle_id)
        if not current:
            return "❌ Règle introuvable."
        data = {
            "nom"         : nom if nom else current['nom'],
            "description" : description if description else current['description'],
            "periodicite" : current['periodicite'],
            "id_structure": current['id_structure']
        }
        res = update_regle(regle_id, data)
        if res.get("status") == "success":
            emit_update("regle_updated", {"regle_id": regle_id})
            return f"✅ Informations mises à jour (Nom: {data['nom']})."
        return f"❌ Échec de la mise à jour : {res}"
    except Exception as e:
        logger.error(f"[IA Tool] Erreur update_regle_metadata_tool: {e}")
        return f"❌ Erreur : {str(e)}"
