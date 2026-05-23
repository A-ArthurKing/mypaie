import os
import json
import logging
import calendar
from datetime import datetime, date
from decimal import Decimal
import jwt
from flask import Blueprint, request, jsonify
from config.db_mysql_connector import get_mysql_connection

logger = logging.getLogger(__name__)

collaborateur_bp = Blueprint('collaborateur', __name__)

JWT_SECRET = os.getenv('JWT_SECRET', 'super_secret_dev_key_mypaie_2026')


def _to_serializable(obj):
    """Convertit récursivement les Decimal en float pour la sérialisation JSON."""
    if isinstance(obj, dict):
        return {k: _to_serializable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_serializable(v) for v in obj]
    if isinstance(obj, Decimal):
        return float(obj)
    return obj


def _get_current_collaborateur(request):
    """Decode JWT and return payload if role=Collaborateur, else None."""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        if payload.get('role') != 'Collaborateur':
            return None
        return payload
    except jwt.InvalidTokenError:
        return None


@collaborateur_bp.route('/api/collaborateur/ma-grille', methods=['GET'])
def ma_grille():
    """
    Retourne la règle de prime active associée à la structure de l'agent connecté,
    ainsi que sa config (paliers + configs actives).
    """
    collab = _get_current_collaborateur(request)
    if not collab:
        return jsonify({"error": "Non autorisé"}), 401

    matricule = collab.get('matricule')
    id_structure = collab.get('id_structure')

    if not id_structure:
        return jsonify({"grille": None, "message": "Aucune structure associée à ce collaborateur"})

    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            # 1. Trouver la règle active pour cette structure
            cur.execute(
                """SELECT id, code, libelle, description, description_kpi,
                          periodicite, grille_objectifs, periode_debut, periode_fin
                   FROM matrice_primes
                   WHERE id_structure = %s AND actif = 1
                   ORDER BY periode_debut DESC
                   LIMIT 1""",
                (id_structure,)
            )
            regle = cur.fetchone()

            if not regle:
                return jsonify({
                    "grille": None,
                    "message": "Aucune règle de prime active pour votre structure"
                })

            # 2. Récupérer la config active de cette règle
            cur.execute(
                """SELECT mpc.id, mpc.libelle, mpc.grille_nom, mpc.content,
                          mpc.est_active, mpc.grille_ordre
                   FROM matrice_primes_configs mpc
                   WHERE mpc.matrice_id = %s AND mpc.est_active = 1
                   ORDER BY mpc.grille_ordre ASC
                   LIMIT 1""",
                (regle['id'],)
            )
            config_active = cur.fetchone()

            # 3. Données du collaborateur
            cur.execute(
                """SELECT re.matricule, re.nom, re.prenom, re.prime_langue, re.statut
                   FROM ref_employes re
                   WHERE re.matricule = %s
                   LIMIT 1""",
                (matricule,)
            )
            agent_info = cur.fetchone()

            grille_objectifs = regle.get('grille_objectifs')
            if grille_objectifs and isinstance(grille_objectifs, str):
                try:
                    grille_objectifs = json.loads(grille_objectifs)
                except Exception:
                    grille_objectifs = None

            # Désérialiser le content JSON de la config active
            config_content = None
            if config_active:
                raw_content = config_active.get('content')
                if raw_content and isinstance(raw_content, str):
                    try:
                        config_content = json.loads(raw_content)
                    except Exception:
                        config_content = None
                elif isinstance(raw_content, dict):
                    config_content = raw_content

            agent_serializable = _to_serializable(agent_info or {})

            # ── 4. Calcul des KPIs réels du mois courant ──────────────────────────
            kpis_reels = {}
            prime_brute_estimee = 0.0
            periode_calcul = None

            if config_content and matricule:
                now = datetime.now()
                y, m = now.year, now.month
                date_debut = date(y, m, 1).isoformat()
                date_fin = date(y, m, calendar.monthrange(y, m)[1]).isoformat()
                MOIS_FR = ['janvier','février','mars','avril','mai','juin',
                           'juillet','août','septembre','octobre','novembre','décembre']
                periode_calcul = {
                    "date_debut": date_debut,
                    "date_fin": date_fin,
                    "mois_label": f"{MOIS_FR[m-1]} {y}"
                }

                try:
                    # Fetch bq_kpi_codes aliases for better metric_key resolution
                    kpi_aliases = {}  # code_kpi.upper() → [bq_code, ...]
                    cur.execute("SELECT code_kpi, bq_kpi_codes FROM config_kpis WHERE is_active=1")
                    for row in cur.fetchall():
                        code = row['code_kpi'].upper()
                        codes_raw = row['bq_kpi_codes']
                        if codes_raw:
                            aliases = json.loads(codes_raw) if isinstance(codes_raw, str) else codes_raw
                            kpi_aliases[code] = aliases

                    from modules.regles_primes.services.kpi_unified_resolver import get_unified_agent_data
                    unified = get_unified_agent_data(date_debut, date_fin, [str(matricule)])
                    agent_kpi_data = unified.get(str(matricule), {})
                    # Normalize keys for case-insensitive lookup
                    agent_kpi_upper = {k.upper(): v for k, v in agent_kpi_data.items()}

                    def _resolve_val(metric_key):
                        """Look up a KPI value by metric_key, falling back to bq_kpi_codes aliases."""
                        val = agent_kpi_upper.get(metric_key.upper())
                        if val is not None:
                            return val
                        for alias in kpi_aliases.get(metric_key.upper(), []):
                            val = agent_kpi_upper.get(alias.upper())
                            if val is not None:
                                return val
                        return None

                    has_missing_data = False
                    for ind in config_content.get('indicateurs', []):
                        ind_id = ind.get('id')
                        metric_key = ind.get('metric_key', '')
                        val_reelle = _resolve_val(metric_key)

                        if val_reelle is None:
                            has_missing_data = True

                        kpi_result = {
                            'metric_key': metric_key,
                            'valeur_reelle': float(val_reelle) if val_reelle is not None else None,
                            'prime_kpi': None,
                            'malus_pct': None,
                        }

                        if val_reelle is not None:
                            mode_prime = ind.get('mode_prime')
                            type_ponderation = ind.get('type_ponderation')
                            paliers_valeur = ind.get('paliers_valeur', [])
                            malus_conditions = ind.get('malus_conditions', [])

                            if mode_prime == 'montant_direct' and paliers_valeur:
                                for palier in paliers_valeur:
                                    seuil_min = float(palier.get('seuil_min') or 0)
                                    seuil_max = palier.get('seuil_max')
                                    v = float(val_reelle)
                                    if v >= seuil_min and (seuil_max is None or v <= float(seuil_max)):
                                        montant = float(palier.get('montant') or 0)
                                        if palier.get('type_montant') == 'fixe':
                                            kpi_result['prime_kpi'] = montant
                                        elif palier.get('type_montant') == 'pourcentage_kpi':
                                            kpi_result['prime_kpi'] = round(v * montant / 100, 2)
                                        break

                            elif type_ponderation == 'malus' and malus_conditions:
                                for cond in malus_conditions:
                                    seuil_min = float(cond.get('seuil_min') or 0)
                                    seuil_max = cond.get('seuil_max')
                                    v = float(val_reelle)
                                    if v >= seuil_min and (seuil_max is None or v <= float(seuil_max)):
                                        kpi_result['malus_pct'] = float(cond.get('malus_pct') or 0)
                                        break

                        if ind_id:
                            kpis_reels[ind_id] = kpi_result

                    # Sum bonus primes then apply malus
                    if has_missing_data:
                        prime_brute_estimee = None
                    else:
                        for kpi_res in kpis_reels.values():
                            if kpi_res.get('prime_kpi') is not None:
                                prime_brute_estimee += kpi_res['prime_kpi']
                        for kpi_res in kpis_reels.values():
                            if kpi_res.get('malus_pct') is not None:
                                prime_brute_estimee = round(prime_brute_estimee * (1 - kpi_res['malus_pct'] / 100), 2)

                except Exception as kpi_err:
                    logger.warning("Calcul KPIs réels impossible pour matricule %s: %s", matricule, kpi_err)

            return jsonify({
                "agent": agent_serializable,
                "regle": {
                    "id": regle['id'],
                    "code": regle['code'],
                    "libelle": regle['libelle'],
                    "description": regle['description'],
                    "description_kpi": regle['description_kpi'],
                    "periodicite": regle['periodicite'],
                    "periode_debut": str(regle['periode_debut']) if regle['periode_debut'] else None,
                    "periode_fin": str(regle['periode_fin']) if regle['periode_fin'] else None,
                    "grille_objectifs": grille_objectifs,
                    "config": {
                        "id": config_active['id'] if config_active else None,
                        "libelle": config_active['libelle'] if config_active else None,
                        "grille_nom": config_active['grille_nom'] if config_active else None,
                        "content": config_content
                    } if config_active else None
                },
                "kpis": kpis_reels,
                "prime_brute_estimee": prime_brute_estimee,
                "periode_calcul": periode_calcul,
            })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()
