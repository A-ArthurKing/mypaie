# backend/modules/agents/services/ai_engine/tools.py

import json
import time
import logging
from typing import Optional
from config.db_mysql_connector import get_mysql_connection
from modules.regles_primes.services.dw_api_regles_provider import (
    get_regle_by_id, 
    create_regle_config,
    update_regle
)
from modules.parametres.services.mapping_provider import get_all_kpis_with_status
from core.socket import emit_update

logger = logging.getLogger(__name__)

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

        info = f"--- RÈGLE ID {regle_data['id']} ---\n"
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
    Interroge les données de performance RÉELLES de l'équipe associée à la règle pour un mois donné.
    """
    import statistics
    from modules.performance.services.dw_api_performance_provider import get_perf_totaux_par_matricule
    from modules.notes_qualite.services.dw_api_qualite_provider import get_qualite_totaux_par_matricule
    from modules.heures_agents.services.dw_api_heures_provider import get_totaux_par_matricule

    logger.info(f"[IA Tool] get_real_performance_tool → regle_id={regle_id}, mois={mois}")

    try:
        if mois and len(mois) >= 7:
            year, month = int(mois[:4]), int(mois[5:7])
        else:
            import datetime as _dt
            today = _dt.date.today()
            first_this = today.replace(day=1)
            prev = first_this - _dt.timedelta(days=1)
            year, month = prev.year, prev.month
            mois = f"{year}-{month:02d}"

        import calendar
        last_day = calendar.monthrange(year, month)[1]
        date_debut = f"{year}-{month:02d}-01"
        date_fin   = f"{year}-{month:02d}-{last_day}"
    except Exception as e:
        return f"❌ Format de mois invalide (attendu YYYY-MM) : {e}"

    try:
        conn = get_mysql_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT id_structure FROM matrice_primes WHERE id = %s", (regle_id,))
                row = cur.fetchone()
                if not row or not row.get('id_structure'):
                    return f"⚠️ La règle ID={regle_id} n'a pas de structure associée."

                id_structure = row['id_structure']
                cur.execute(
                    "SELECT id_projet, id_operation, id_sous_projet, id_activite "
                    "FROM ref_structure_map WHERE id = %s", (id_structure,)
                )
                struct = cur.fetchone()
                
                # Récupérer les agents
                where_parts = []
                p = []
                for k, v in struct.items():
                    if v:
                        where_parts.append(f"{k} = %s")
                        p.append(v)
                
                sql_agents = f"SELECT matricule FROM ref_employes WHERE {' AND '.join(where_parts)}"
                cur.execute(sql_agents, p)
                matricules = [r['matricule'] for r in cur.fetchall() if r['matricule']]
        finally:
            conn.close()

        if not matricules:
            return f"ℹ️ Aucun agent trouvé pour la structure associée à la règle ID={regle_id}."

        nb_agents = len(matricules)

        # Appels BigQuery individuellement — chaque erreur est capturée proprement
        perf_map = {}
        qualite_map = {}
        heures_map = {}
        data_errors = []

        try:
            perf_map = get_perf_totaux_par_matricule(date_debut, date_fin, matricules)
        except Exception as e_perf:
            logger.error(f"[IA Tool] Erreur récupération performance BigQuery: {e_perf}", exc_info=True)
            data_errors.append("Performance")

        try:
            qualite_map = get_qualite_totaux_par_matricule(date_debut, date_fin, matricules)
        except Exception as e_qual:
            logger.error(f"[IA Tool] Erreur récupération qualité BigQuery: {e_qual}", exc_info=True)
            data_errors.append("Qualité")

        try:
            heures_map = get_totaux_par_matricule(date_debut, date_fin, matricules)
        except Exception as e_heure:
            logger.error(f"[IA Tool] Erreur récupération heures BigQuery: {e_heure}", exc_info=True)
            data_errors.append("Heures")

        # Rapport stats
        def _stats(vals):
            valid = [v for v in vals if v is not None]
            if not valid: return None
            return {
                "min": round(min(valid), 2),
                "max": round(max(valid), 2),
                "moy": round(statistics.mean(valid), 2),
                "median": round(statistics.median(valid), 2),
                "n": len(valid)
            }

        def _suggest_target(st, higher):
            if not st: return None
            # Suggestion légèrement au-dessus ou en-dessous de la médiane (+/- 7%)
            if higher: return round(st['median'] * 1.07, 2)
            else: return round(st['median'] * 0.93, 2)

        if data_errors and len(data_errors) == 3:
            return "{\"status\": \"error\", \"message\": \"Impossible d'accéder aux données de performance pour le moment. Les services de données sont temporairement indisponibles.\"}"

        out = f"## Données réelles de l'équipe — {mois}\n\n"
        out += f"**Règle ID {regle_id}** | **{nb_agents} agent(s) ciblé(s)** | Période : {date_debut} → {date_fin}\n\n"
        if data_errors:
            out += f"⚠️ Données partiellement indisponibles ({', '.join(data_errors)}) — les autres sections sont affichées.\n\n"

        # (Simplified for briefness, following the logic from gemini_agent_provider)
        # KPI mapping
        kpi_perf = {
            "revenue_amt_eur": ([v.get("chiffre_affaire") for v in perf_map.values()], True, "€", "Chiffre d'Affaires"),
            "booking_nbr":     ([v.get("nb_ventes") for v in perf_map.values()], True, "ventes", "Nombre de Ventes"),
        }
        
        def _section(title, kpi_dict):
            s = f"### {title}\n"
            has_data = False
            for key, (values, higher, unite, label) in kpi_dict.items():
                st = _stats(values)
                if not st: continue
                has_data = True
                direction = "↑ higher_better" if higher else "↓ lower_better"
                suggest = _suggest_target(st, higher)
                s += f"- **{label}** (`{key}`) [{unite}] — {direction}\n"
                s += f"  - Min={st['min']} | Moy={st['moy']} | Médiane={st['median']} | Max={st['max']}\n"
                if suggest: s += f"  - 💡 **Objectif suggéré : {suggest} {unite}**\n"
            return s + "\n"

        out += _section("Performance (BigQuery)", kpi_perf)
        return out
    except Exception as e:
        logger.error(f"[IA Tool] Erreur get_real_performance_tool: {e}", exc_info=True)
        return '{"status": "error", "message": "Impossible d\'accéder aux données de performance pour le moment. Veuillez réessayer plus tard."}'


def list_available_kpis_tool() -> str:
    """
    Retourne la liste de TOUS les KPIs standards disponibles dans la base de données.
    Présente les libellés métier pour communication à l'utilisateur, et les tech_keys pour usage interne.
    """
    logger.info("[IA Tool] list_available_kpis_tool")
    try:
        kpis = get_all_kpis_with_status()
        if not kpis:
            return "⚠️ AUCUN KPI n'est configuré dans la base."

        lines = ["--- KPIs DISPONIBLES (utilise le libellé métier pour parler à l'utilisateur, le tech_key en interne) ---\n"]
        current_univers = None
        for k in kpis:
            if k['univers'] != current_univers:
                current_univers = k['univers']
                lines.append(f"\n[Catégorie : {current_univers}]")
            if not k['actif']:
                continue  # Ne pas montrer les KPIs inactifs à l'utilisateur
            tech_key = k.get('tech_key') or k['code']
            libelle = k.get('libelle') or k['code']
            description = k.get('description') or ''
            desc_str = f" — {description}" if description else ''
            lines.append(f"  • Libellé (à montrer) : \"{libelle}\"{desc_str}")
            lines.append(f"    [tech_key interne : '{tech_key}']")
        return "\n".join(lines)
    except Exception as e:
        logger.error(f"[IA Tool] Erreur list_available_kpis_tool: {e}")
        return '{"status": "error", "message": "Impossible d\'accéder au référentiel des KPIs pour le moment."}'


def prepare_grille_proposal_tool(regle_id: int, grille_nom: str, grille_json: str) -> str:
    """
    Valide et génère une PROPOSITION de grille d'objectifs pour une règle de prime.
    """
    logger.info(f"[IA Tool] prepare_grille_proposal_tool → regle_id={regle_id}, nom='{grille_nom}'")
    try:
        grille = json.loads(grille_json) if isinstance(grille_json, str) else grille_json
        required_keys = ['indicateurs', 'statuts', 'paliers']
        missing = [k for k in required_keys if k not in grille]
        if missing:
            return f"❌ Erreur : JSON incomplet. Clés manquantes : {', '.join(missing)}"

        all_kpis = get_all_kpis_with_status()
        valid_tech_keys = {k.get('tech_key') or k['code'] for k in all_kpis}
        valid_codes = {k['code'] for k in all_kpis}

        kpis_not_found = []
        for ind in grille.get('indicateurs', []):
            mk = ind.get('metric_key', '')
            if mk and mk not in valid_tech_keys and mk not in valid_codes:
                kpis_not_found.append(mk)

        if kpis_not_found:
            logger.warning(f"[IA Tool] KPIs non reconnus dans config_kpis : {kpis_not_found} — proposition autorisée quand même")

        # Nettoyer/Générer les IDs
        for i, ind in enumerate(grille.get('indicateurs', [])):
            if not ind.get('id'): ind['id'] = f"kpi_{int(time.time())}_{i}"

        regle_data = get_regle_by_id(regle_id)
        if not regle_data: return f"❌ Règle ID {regle_id} introuvable."

        resume = f"### 📝 Proposition de configuration : **{grille_nom}**\n\n"
        resume += f"Cette configuration est prête à être examinée. Elle n'est pas encore appliquée.\n\n"
        
        # ... (simplified resume construction similar to provider)
        total_poids = sum(float(i.get('poids', 0)) for i in grille.get('indicateurs', []))
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
    Crée RÉELLEMENT et ACTIVE immédiatement une nouvelle version de grille d'objectifs en base de données.
    À utiliser UNIQUEMENT si l'utilisateur demande explicitement de "créer", "sauvegarder" ou "appliquer" 
    la grille APRÈS avoir vu une proposition, ou s'il donne un ordre direct de création.
    Cette action déclenche une mise à jour en temps réel de l'interface utilisateur.

    Paramètres :
    - regle_id   : ID de la règle cible
    - grille_nom : Nom de la version (ex: "Version IA v1")
    - grille_json: Contenu JSON complet de la grille
    """
    logger.info(f"[IA Tool] save_grille_config_tool → regle_id={regle_id}, nom='{grille_nom}'")
    try:
        grille = json.loads(grille_json) if isinstance(grille_json, str) else grille_json
        
        # Création en base
        res = create_regle_config(
            regle_id=regle_id,
            libelle=grille_nom,
            content=grille,
            activate=True,
            grille_uuid=f"grille_ia_{int(time.time())}",
            grille_nom=grille_nom
        )
        
        if res.get("status") == "success":
            # Notification temps réel
            emit_update("regle_configs_updated", {"regle_id": regle_id})
            return f"✅ La grille '{grille_nom}' a été créée et activée avec succès en base de données. L'interface a été actualisée."
        else:
            return f"❌ Échec de la création en base : {res}"
            
    except Exception as e:
        logger.error(f"[IA Tool] Erreur save_grille_config_tool: {e}")
        return f"❌ Erreur lors de la sauvegarde : {str(e)}"


def rename_grille_version_tool(regle_id: int, new_name: str) -> str:
    """
    Renomme la version de grille actuellement active pour une règle de prime.
    À utiliser UNIQUEMENT quand l'utilisateur demande explicitement de renommer la version en cours
    (ex: "Renomme cette version V1", "Appelle-la Version Finale").
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
        return f"✅ Version renommée avec succès : '{old_name}' → '{new_name.strip()}'. L'interface a été actualisée."
    except Exception as e:
        logger.error(f"[IA Tool] Erreur rename_grille_version_tool: {e}", exc_info=True)
        return '{"status": "error", "message": "Impossible de renommer la version pour le moment."}'


def update_regle_metadata_tool(regle_id: int, nom: str, description: str) -> str:
    """
    Met à jour les informations générales (nom, description) de la règle de prime.
    À utiliser si l'utilisateur demande de renommer la règle ou d'en changer la description.
    Cette action déclenche une mise à jour en temps réel de l'interface utilisateur.
    """
    logger.info(f"[IA Tool] update_regle_metadata_tool → regle_id={regle_id}")
    try:
        current = get_regle_by_id(regle_id)
        if not current: return "❌ Règle introuvable."
        
        data = {
            "nom": nom if nom else current['nom'],
            "description": description if description else current['description'],
            "periodicite": current['periodicite'],
            "id_structure": current['id_structure']
        }
        
        res = update_regle(regle_id, data)
        if res.get("status") == "success":
            emit_update("regle_updated", {"regle_id": regle_id})
            return f"✅ Informations de la règle mises à jour avec succès (Nom: {data['nom']})."
        else:
            return f"❌ Échec de la mise à jour : {res}"
    except Exception as e:
        logger.error(f"[IA Tool] Erreur update_regle_metadata_tool: {e}")
        return f"❌ Erreur : {str(e)}"
