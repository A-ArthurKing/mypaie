"""
Fichier : assiduite_sync_provider.py
Rôle    : Synchronisation automatique de assiduite_mensuelle depuis gestionpaie.
          Lit heures_corrigees + heures_ecart pour calculer les métriques
          réelles de chaque agent, puis upsert dans la table locale —
          en respectant le flag is_overridden (lignes protégées par la RH).

Algorithme par agent par mois
──────────────────────────────
  • jours_ouvres     : jours où heure_hp > 0 et Commentaire ∉ {DO, FERIE, DESTAFFING}
                       Les jours de congé légal (CP/CSS/…) sont aussi comptés dans OUV
                       car ils s'imputent sur les droits, pas sur le planning brut.
  • jours_travailles : jours où heure_ht > 0 (présence effective)
  • cp_css           : jours avec TYPE_CONGE ∈ congés légaux reconnus
  • retard           : nb dates distinctes avec code_ecart = 1 dans heures_ecart
  • abs_justifie     : nb dates distinctes avec code_ecart = 2 dans heures_ecart
                       (intersection avec jours ouvrés uniquement)
  • abs_injustifie   : jours ouvrés planifiés non travaillés (ht = 0) et non couverts
                       ni par un congé légal, ni par un code ecart justifié

Module  : mypaie / backend / modules / agents / services
"""

import logging
from calendar import monthrange
from collections import defaultdict
from datetime import datetime

from config.db_gestionpaie_connector import get_gestionpaie_connection
from config.db_mysql_connector import get_mysql_connection
from tools.cache import invalidate

logger = logging.getLogger(__name__)

# ─── Constantes ───────────────────────────────────────────────────────────────

# Types de congé légal reconnus (inscrits dans heures_corrigees.TYPE_CONGE)
_TYPES_CONGE = frozenset({
    'CP', 'CSS', 'C.MAT', 'C.DEC', 'C.MAR', 'C.PAT',
    'CONGE', 'CONG', 'C.EXC',
})

# Valeurs de Commentaire qui marquent un jour hors planning (DO = Day Off, FERIE = férié)
_COMMENTAIRES_HORS_PLANNING = frozenset({'DO', 'FERIE', 'DESTAFFING'})

# Valeurs de TYPE_CONGE qui signifient « pas de congé »
_TYPES_CONGE_VIDES = frozenset({'NONE', 'NON', '', 'NULL'})

# Codes dans heures_ecart
_CODE_RETARD  = 1
_CODE_ABSENCE = 2

# Taille des batches pour les requêtes IN(...)
_BATCH_SIZE = 200


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _first_last_day(mois: str) -> tuple[str, str]:
    """Retourne (date_debut, date_fin) sous forme YYYY-MM-DD pour un mois YYYY-MM."""
    year, month = map(int, mois.split('-'))
    _, last = monthrange(year, month)
    return f"{mois}-01", f"{mois}-{last:02d}"


def _to_str(val) -> str:
    """Normalise une valeur potentiellement None en chaîne vide."""
    return (val or '').strip().upper()


def _heure_positive(val: str) -> bool:
    """Retourne True si la chaîne HH:MM:SS représente un temps > 00:00:00."""
    s = (val or '').strip()
    return bool(s) and s > '00:00:00'


# ─── Chargement gestionpaie ────────────────────────────────────────────────────

def _load_heures_corrigees(
    conn,
    matricules: list[str],
    date_debut: str,
    date_fin: str,
) -> dict[str, list[dict]]:
    """
    Charge heures_corrigees pour une liste de matricules sur une plage de dates.
    Exclut les lignes soft-deleted (deleted_at IS NOT NULL).

    Returns:
        { matricule: [{date, heure_hp, heure_ht, type_conge, commentaire}, …] }
    """
    if not matricules:
        return {}
    placeholders = ','.join(['%s'] * len(matricules))
    sql = f"""
        SELECT  matricule,
                `date`,
                COALESCE(heure_hp,  '00:00:00') AS heure_hp,
                COALESCE(heure_ht,  '00:00:00') AS heure_ht,
                COALESCE(TYPE_CONGE,  'NONE')   AS type_conge,
                COALESCE(Commentaire, 'NONE')   AS commentaire
        FROM    heures_corrigees
        WHERE   matricule IN ({placeholders})
          AND   `date`    >= %s
          AND   `date`    <= %s
          AND   deleted_at IS NULL
    """
    data: dict[str, list] = defaultdict(list)
    with conn.cursor() as cur:
        cur.execute(sql, (*matricules, date_debut, date_fin))
        for row in cur.fetchall():
            data[str(row['matricule'])].append({
                'date':        str(row['date']),
                'heure_hp':    str(row['heure_hp']).strip(),
                'heure_ht':    str(row['heure_ht']).strip(),
                'type_conge':  _to_str(row['type_conge']),
                'commentaire': _to_str(row['commentaire']),
            })
    return dict(data)


def _load_heures_ecart(
    conn,
    matricules: list[str],
    date_debut: str,
    date_fin: str,
) -> dict[str, list[dict]]:
    """
    Charge heures_ecart pour une liste de matricules sur une plage de dates.

    Returns:
        { matricule: [{date, code_ecart}, …] }
    """
    if not matricules:
        return {}
    placeholders = ','.join(['%s'] * len(matricules))
    sql = f"""
        SELECT  matricule,
                `date`,
                code_ecart
        FROM    heures_ecart
        WHERE   matricule IN ({placeholders})
          AND   `date`    >= %s
          AND   `date`    <= %s
          AND   deleted_at IS NULL
    """
    data: dict[str, list] = defaultdict(list)
    with conn.cursor() as cur:
        cur.execute(sql, (*matricules, date_debut, date_fin))
        for row in cur.fetchall():
            data[str(row['matricule'])].append({
                'date':       str(row['date']),
                'code_ecart': int(row['code_ecart']),
            })
    return dict(data)


# ─── Calcul métriques ─────────────────────────────────────────────────────────

def _compute_metrics(
    rows_hc: list[dict],
    rows_he: list[dict],
) -> dict:
    """
    Calcule les métriques d'assiduité d'un agent à partir de ses lignes brutes.

    Returns:
        {
            jours_ouvres    : int   # jours planifiés (hors DO/FERIE/DESTAFFING)
            jours_travailles: int   # jours avec présence effective
            cp_css          : int   # jours de congé légal (CP/CSS/C.MAT/…)
            retard          : int   # occurrences de retard (dates distinctes)
            abs_justifie    : int   # jours d'absence justifiée (code_ecart 2)
            abs_injustifie  : int   # jours absents non couverts
        }
    """
    # ── Données depuis heures_ecart ──────────────────────────────────────────
    dates_retard   = set()
    dates_abs_just = set()
    for e in rows_he:
        code = e['code_ecart']
        if code == _CODE_RETARD:
            dates_retard.add(e['date'])
        elif code == _CODE_ABSENCE:
            dates_abs_just.add(e['date'])

    # ── Parcours journalier depuis heures_corrigees ───────────────────────────
    jours_ouvres      = set()  # jours planifiés (travaillables ou congé légal)
    jours_travailles  = set()  # présence effective (heure_ht > 0)
    jours_cp_css      = set()  # congé légal
    jours_abs_inj     = set()  # absent sans couverture

    for h in rows_hc:
        d    = h['date']
        hp   = h['heure_hp']
        ht   = h['heure_ht']
        tc   = h['type_conge']
        comm = h['commentaire']

        # Jour hors planning : ni ouvré, ni congé, ni absent
        if comm in _COMMENTAIRES_HORS_PLANNING:
            continue
        if not _heure_positive(hp):
            continue  # pas de temps planifié → pas un jour ouvré

        # Congé légal : jour ouvré consommé en congé (ne compte pas comme présence)
        if tc not in _TYPES_CONGE_VIDES and tc in _TYPES_CONGE:
            jours_ouvres.add(d)
            jours_cp_css.add(d)
            continue

        # Jour ouvré standard (présence attendue)
        jours_ouvres.add(d)

        if _heure_positive(ht):
            # Présent (même avec retard)
            jours_travailles.add(d)
        elif d not in dates_abs_just:
            # Absent sans justificatif connu → injustifié
            jours_abs_inj.add(d)

    return {
        'jours_ouvres':     len(jours_ouvres),
        'jours_travailles': len(jours_travailles),
        'cp_css':           len(jours_cp_css),
        'retard':           len(dates_retard),
        # abs_justifie : uniquement les jours ecart-code-2 qui sont aussi des jours ouvrés
        'abs_justifie':     len(dates_abs_just & jours_ouvres),
        'abs_injustifie':   len(jours_abs_inj),
    }


# ─── Fonction principale ───────────────────────────────────────────────────────

def sync_assiduite_pour_mois(mois: str) -> dict:
    """
    Synchronise assiduite_mensuelle pour un mois donné.

    - Charge tous les agents actifs (ref_employes WHERE actif = 1).
    - Ignore les agents dont is_overridden = 1 (protégés par la RH).
    - Calcule les métriques depuis gestionpaie (heures_corrigees + heures_ecart).
    - Upsert dans assiduite_mensuelle avec synced_at = NOW().
    - Inscrit une entrée AUTO_SYNC dans assiduite_historique.
    - Invalide le cache pour forcer un rechargement côté API.

    Args:
        mois: Format YYYY-MM (ex. "2026-05")

    Returns:
        {
            updated           : int   # agents mis à jour
            skipped_overridden: int   # agents ignorés car protégés
            skipped_no_data   : int   # agents sans données dans gestionpaie
            errors            : list  # [{"matricule": ..., "error": ...}]
        }
    """
    date_debut, date_fin = _first_last_day(mois)
    stats: dict = {
        'updated':            0,
        'skipped_overridden': 0,
        'skipped_no_data':    0,
        'errors':             [],
    }

    conn_local = get_mysql_connection()
    conn_gp    = get_gestionpaie_connection()

    try:
        # ── 1. Récupérer les agents actifs + leur statut de protection ────────
        with conn_local.cursor() as cur:
            cur.execute(
                """
                SELECT  e.matricule,
                        COALESCE(am.is_overridden, 0) AS is_overridden
                FROM    ref_employes e
                LEFT JOIN assiduite_mensuelle am
                        ON  am.matricule = e.matricule
                        AND am.mois      = %s
                WHERE   e.actif = 1
                """,
                (mois,),
            )
            rows = cur.fetchall()

        matricules_overridden = {r['matricule'] for r in rows if r['is_overridden']}
        matricules_to_sync    = [r['matricule'] for r in rows if not r['is_overridden']]

        stats['skipped_overridden'] = len(matricules_overridden)

        if not matricules_to_sync:
            logger.info("Sync assiduité %s : aucun agent à synchroniser.", mois)
            return stats

        # ── 2. Charger les données gestionpaie par batches ────────────────────
        all_hc: dict = {}
        all_he: dict = {}
        for i in range(0, len(matricules_to_sync), _BATCH_SIZE):
            batch = matricules_to_sync[i : i + _BATCH_SIZE]
            all_hc.update(_load_heures_corrigees(conn_gp, batch, date_debut, date_fin))
            all_he.update(_load_heures_ecart(conn_gp, batch, date_debut, date_fin))

        # ── 3. Calculer + upsert ──────────────────────────────────────────────
        now_ts = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')

        with conn_local.cursor() as cur:
            for matricule in matricules_to_sync:
                rows_hc = all_hc.get(matricule, [])
                rows_he = all_he.get(matricule, [])

                if not rows_hc and not rows_he:
                    stats['skipped_no_data'] += 1
                    continue

                try:
                    m = _compute_metrics(rows_hc, rows_he)

                    # Upsert principal — ne touche PAS à is_overridden
                    cur.execute(
                        """
                        INSERT INTO assiduite_mensuelle
                            (matricule, mois, abs_injustifie, retard, abs_justifie,
                             cp_css, jours_ouvres, jours_travailles, is_overridden, synced_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 0, %s)
                        ON DUPLICATE KEY UPDATE
                            abs_injustifie   = VALUES(abs_injustifie),
                            retard           = VALUES(retard),
                            abs_justifie     = VALUES(abs_justifie),
                            cp_css           = VALUES(cp_css),
                            jours_ouvres     = VALUES(jours_ouvres),
                            jours_travailles = VALUES(jours_travailles),
                            synced_at        = VALUES(synced_at),
                            updated_at       = CURRENT_TIMESTAMP
                        """,
                        (
                            matricule, mois,
                            m['abs_injustifie'], m['retard'], m['abs_justifie'],
                            m['cp_css'], m['jours_ouvres'], m['jours_travailles'],
                            now_ts,
                        ),
                    )

                    # Trace dans historique
                    cur.execute(
                        """
                        INSERT INTO assiduite_historique
                            (matricule, mois, abs_injustifie, retard, abs_justifie,
                             cp_css, jours_ouvres, commentaire, modifie_par, source)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'AUTO_SYNC', 'AUTO_SYNC')
                        """,
                        (
                            matricule, mois,
                            m['abs_injustifie'], m['retard'], m['abs_justifie'],
                            m['cp_css'], m['jours_ouvres'],
                            f"Synchro auto gestionpaie — {now_ts}",
                        ),
                    )

                    stats['updated'] += 1

                except Exception as exc:
                    logger.warning(
                        "Erreur sync agent %s/%s : %s", matricule, mois, exc
                    )
                    stats['errors'].append({
                        'matricule': matricule,
                        'error':     str(exc),
                    })

            conn_local.commit()

        # ── 4. Invalider le cache API ─────────────────────────────────────────
        invalidate(f"assiduite:{mois}")

        logger.info(
            "Sync assiduité %s terminé — %s mis à jour, %s protégés, %s sans données, %s erreurs.",
            mois,
            stats['updated'],
            stats['skipped_overridden'],
            stats['skipped_no_data'],
            len(stats['errors']),
        )
        return stats

    finally:
        conn_local.close()
        conn_gp.close()
