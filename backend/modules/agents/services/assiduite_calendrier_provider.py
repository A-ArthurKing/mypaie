"""
Fichier : assiduite_calendrier_provider.py
Rôle    : Retourne les données journalières d'un agent pour le mois demandé,
          prêtes à être affichées dans un calendrier interactif.

Chaque jour du mois est classé dans l'un des statuts suivants :
  TRAVAILLE    — présence effective (heure_ht > 0)
  ABS_INJUST   — planifié mais absent sans justificatif
  ABS_JUST     — absence couverte par un code_ecart = 2 (Absence)
  CONGE        — congé légal (CP / CSS / C.MAT / …)
  FERIE        — jour férié (Commentaire = FERIE)
  DO           — jour de repos / hors planning (Commentaire = DO, ou hp = 0)
  HORS_PLANNING — aucune donnée dans gestionpaie pour ce jour

Le flag `is_retard` (code_ecart = 1) est orthogonal au statut : un agent peut
être présent (TRAVAILLE) et avoir un retard enregistré le même jour.

Module  : mypaie / backend / modules / agents / services
"""

import logging
from calendar import monthrange
from collections import defaultdict
from datetime import date as _date

from config.db_gestionpaie_connector import get_gestionpaie_connection

logger = logging.getLogger(__name__)

# ─── Constantes (reprises de assiduite_sync_provider) ─────────────────────────
_TYPES_CONGE = frozenset({
    'CP', 'CSS', 'C.MAT', 'C.DEC', 'C.MAR', 'C.PAT',
    'CONGE', 'CONG', 'C.EXC',
})
_TYPES_CONGE_VIDES           = frozenset({'NONE', 'NON', '', 'NULL'})
_COMMENTAIRES_HORS_PLANNING  = frozenset({'DO', 'DESTAFFING'})

_CODE_RETARD  = 1
_CODE_ABSENCE = 2


def get_calendrier_agent(matricule: str, mois: str) -> dict:
    """
    Retourne les données journalières d'un agent pour un mois donné.

    Args:
        matricule : identifiant RH de l'agent
        mois      : format YYYY-MM

    Returns:
        {
            matricule : str,
            mois      : str,
            stats : {
                jours_ouvres    : int,
                jours_travailles: int,
                cp_css          : int,
                retard          : int,
                abs_justifie    : int,
                abs_injustifie  : int,
            },
            jours : [
                {
                    date        : "YYYY-MM-DD",
                    jour_semaine: int (0=Lun … 6=Dim),
                    statut      : str,
                    is_retard   : bool,
                    heure_hp?   : str (HH:MM:SS),
                    heure_ht?   : str (HH:MM:SS),
                },
                …
            ]
        }
    """
    year, month = map(int, mois.split('-'))
    _, nb_jours = monthrange(year, month)
    date_debut  = f"{mois}-01"
    date_fin    = f"{mois}-{nb_jours:02d}"

    conn = get_gestionpaie_connection()
    try:
        with conn.cursor() as cur:
            # ── heures_corrigees ───────────────────────────────────────────
            cur.execute(
                """
                SELECT  `date`,
                        COALESCE(heure_hp,   '00:00:00') AS heure_hp,
                        COALESCE(heure_ht,   '00:00:00') AS heure_ht,
                        COALESCE(TYPE_CONGE,  'NONE')    AS type_conge,
                        COALESCE(Commentaire, 'NONE')    AS commentaire
                FROM    heures_corrigees
                WHERE   matricule  = %s
                  AND   `date`    >= %s
                  AND   `date`    <= %s
                  AND   deleted_at IS NULL
                """,
                (matricule, date_debut, date_fin),
            )
            hc_map = {str(r['date']): r for r in cur.fetchall()}

            # ── heures_ecart ───────────────────────────────────────────────
            cur.execute(
                """
                SELECT  `date`, code_ecart
                FROM    heures_ecart
                WHERE   matricule  = %s
                  AND   `date`    >= %s
                  AND   `date`    <= %s
                  AND   deleted_at IS NULL
                """,
                (matricule, date_debut, date_fin),
            )
            he_map: dict[str, list] = defaultdict(list)
            for r in cur.fetchall():
                he_map[str(r['date'])].append(int(r['code_ecart']))
    finally:
        conn.close()

    # ── Construire les jours ───────────────────────────────────────────────────
    stats = {
        'jours_ouvres':     0,
        'jours_travailles': 0,
        'cp_css':           0,
        'retard':           0,
        'abs_justifie':     0,
        'abs_injustifie':   0,
    }
    jours = []

    for day in range(1, nb_jours + 1):
        date_str     = f"{year}-{month:02d}-{day:02d}"
        jour_semaine = _date(year, month, day).weekday()  # 0=Lun, 6=Dim
        hc           = hc_map.get(date_str)
        ecarts       = he_map.get(date_str, [])
        is_retard    = _CODE_RETARD in ecarts

        if hc is None:
            jours.append({
                'date':        date_str,
                'jour_semaine': jour_semaine,
                'statut':      'HORS_PLANNING',
                'is_retard':   False,
            })
            continue

        hp   = str(hc['heure_hp']).strip()
        ht   = str(hc['heure_ht']).strip()
        tc   = str(hc['type_conge']).strip().upper()
        comm = str(hc['commentaire']).strip().upper()

        # ── Classification du jour ────────────────────────────────────────
        if comm == 'FERIE':
            statut = 'FERIE'

        elif comm in _COMMENTAIRES_HORS_PLANNING or hp == '00:00:00':
            statut = 'DO'

        elif tc not in _TYPES_CONGE_VIDES and tc in _TYPES_CONGE:
            statut = 'CONGE'
            stats['jours_ouvres'] += 1
            stats['cp_css']       += 1

        elif ht and ht > '00:00:00':
            statut = 'TRAVAILLE'
            stats['jours_ouvres']     += 1
            stats['jours_travailles'] += 1
            if is_retard:
                stats['retard'] += 1

        elif _CODE_ABSENCE in ecarts:
            statut = 'ABS_JUST'
            stats['jours_ouvres']  += 1
            stats['abs_justifie']  += 1

        else:
            statut = 'ABS_INJUST'
            stats['jours_ouvres']  += 1
            stats['abs_injustifie'] += 1

        entry: dict = {
            'date':         date_str,
            'jour_semaine': jour_semaine,
            'statut':       statut,
            'is_retard':    is_retard,
        }
        if hp and hp != '00:00:00':
            entry['heure_hp'] = hp
        if ht and ht != '00:00:00':
            entry['heure_ht'] = ht

        jours.append(entry)

    return {
        'matricule': matricule,
        'mois':      mois,
        'stats':     stats,
        'jours':     jours,
    }
