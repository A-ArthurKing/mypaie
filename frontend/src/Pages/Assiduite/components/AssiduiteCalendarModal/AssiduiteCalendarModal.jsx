/*
 * Fichier : AssiduiteCalendarModal.jsx
 * Rôle    : Modal calendrier mensuel par agent — affiche le détail journalier
 *           de l'assiduité avec code couleur par statut, badge retard, et stats.
 *           Charge ses données dynamiquement depuis GET /api/assiduite/:mat/calendrier.
 * Dépend  : AssiduiteCalendarModal.css
 * Module  : mypaie / Pages / Assiduite / components
 */

import React, { useState, useEffect, useRef } from 'react';
import './AssiduiteCalendarModal.css';

// ─── Constantes ───────────────────────────────────────────────────────────────

const JOURS_SEMAINE = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

// Configuration visuelle par statut
const STATUT_CFG = {
  TRAVAILLE:     { label: 'Travaillé',     cls: 'acm-day--travaille'  },
  ABS_INJUST:    { label: 'Abs. injust.',  cls: 'acm-day--abs-injust' },
  ABS_JUST:      { label: 'Abs. justif.', cls: 'acm-day--abs-just'   },
  CONGE:         { label: 'Congé',         cls: 'acm-day--conge'      },
  DO:            { label: 'Repos',         cls: 'acm-day--do'         },
  FERIE:         { label: 'Férié',         cls: 'acm-day--ferie'      },
  HORS_PLANNING: { label: '—',             cls: 'acm-day--hors'       },
};

// Couleurs et libellés des chips de stats
const STATS_CFG = [
  { key: 'jours_travailles', label: 'J.TRAV', focus: 'travaille', color: '#16a34a' },
  { key: 'retard',           label: 'RETARD', focus: 'retard',    color: '#d97706' },
  { key: 'abs_injustifie',   label: 'ABS.I',  focus: 'abs_injust',color: '#dc2626' },
  { key: 'abs_justifie',     label: 'ABS.J',  focus: 'abs_just',  color: '#2563eb' },
  { key: 'cp_css',           label: 'CP/CSS', focus: 'conge',     color: '#7c3aed' },
  { key: 'jours_ouvres',     label: 'OUV.',   focus: null,        color: '#6b7280' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMoisLabel(mois) {
  if (!mois) return '';
  const [year, month] = mois.split('-').map(Number);
  const label = new Date(year, month - 1, 1)
    .toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatHeure(h) {
  // "08:05:21" → "08h05"
  if (!h) return null;
  const parts = h.split(':');
  return `${parts[0]}h${parts[1]}`;
}

// Offset lundi=0 pour la première cellule du mois
function firstDayOffset(mois) {
  const [year, month] = mois.split('-').map(Number);
  const jsDay = new Date(year, month - 1, 1).getDay(); // 0=Dim
  return (jsDay + 6) % 7; // 0=Lun
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function StatChip({ label, value, isFocused, color }) {
  return (
    <div
      className={`acm-stat${isFocused ? ' acm-stat--focus' : ''}`}
      style={isFocused ? { borderColor: color, boxShadow: `0 0 0 2px ${color}33` } : {}}
    >
      <span className="acm-stat__val" style={isFocused ? { color } : {}}>{value}</span>
      <span className="acm-stat__lbl">{label}</span>
    </div>
  );
}

function DayCell({ jour, focus }) {
  const cfg       = STATUT_CFG[jour.statut] || STATUT_CFG.HORS_PLANNING;
  const dayNum    = parseInt(jour.date.split('-')[2], 10);
  const isDim     = jour.statut === 'DO' || jour.statut === 'HORS_PLANNING';
  const isRetard  = jour.is_retard && jour.statut === 'TRAVAILLE';

  const isFocused =
    (focus === 'travaille'  && jour.statut === 'TRAVAILLE' && !isRetard) ||
    (focus === 'retard'     && isRetard) ||
    (focus === 'abs_injust' && jour.statut === 'ABS_INJUST') ||
    (focus === 'abs_just'   && jour.statut === 'ABS_JUST');

  // Construire le tooltip
  const tooltip = [
    jour.date,
    cfg.label,
    isRetard                   ? 'Retard' : null,
    jour.heure_ht              ? `Pointé : ${formatHeure(jour.heure_ht)}` : null,
    jour.heure_hp && !jour.heure_ht ? `Prévu : ${formatHeure(jour.heure_hp)}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div
      className={[
        'acm-day',
        cfg.cls,
        isRetard    ? 'acm-day--is-retard' : '',
        isFocused   ? 'acm-day--focused'   : '',
        isDim       ? 'acm-day--dim'       : '',
      ].filter(Boolean).join(' ')}
      title={tooltip}
    >
      <span className="acm-day__num">{dayNum}</span>
      {isRetard && <span className="acm-retard-dot" title="Retard enregistré">R</span>}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function AssiduiteCalendarModal({
  isOpen,
  onClose,
  agent,
  selectedMois,
  focus,  // 'travaille' | 'retard' | null
}) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const overlayRef = useRef(null);

  // Chargement à l'ouverture
  useEffect(() => {
    if (!isOpen || !agent) return;
    setLoading(true);
    setError('');
    setData(null);

    const token = localStorage.getItem('mypaie_auth_token') || '';
    fetch(
      `/api/assiduite/${encodeURIComponent(agent.matricule)}/calendrier?mois=${selectedMois}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    )
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(e => setError(e.message || 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [isOpen, agent, selectedMois]);

  const handleOverlayClick = e => {
    if (e.target === overlayRef.current) onClose();
  };

  if (!isOpen || !agent) return null;

  const offset = firstDayOffset(selectedMois);

  const focusLabel = focus === 'travaille'  ? 'Jours travaillés'
    : focus === 'retard'     ? 'Retards enregistrés'
    : focus === 'abs_injust' ? 'Absences injustifiées'
    : focus === 'abs_just'   ? 'Absences justifiées'
    : null;

  return (
    <div
      className="acm-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Calendrier assiduité — ${agent.nom} ${agent.prenom}`}
    >
      <div className="acm-modal">

        {/* ── En-tête ─────────────────────────────────────────────────── */}
        <div className="acm-header">
          <div className="acm-header__info">
            <h2 className="acm-title">
              {agent.nom}
              <span className="acm-prenom"> {agent.prenom}</span>
              <span className="acm-mat">#{agent.matricule}</span>
            </h2>
            <p className="acm-subtitle">
              {formatMoisLabel(selectedMois)}
              {focusLabel && (
                <span className="acm-focus-label"> · {focusLabel}</span>
              )}
            </p>
          </div>
          <button className="acm-close" onClick={onClose} title="Fermer">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* ── Stats ───────────────────────────────────────────────────── */}
        {data && (
          <div className="acm-stats">
            {STATS_CFG.map(s => (
              <StatChip
                key={s.key}
                label={s.label}
                value={data.stats[s.key] ?? 0}
                isFocused={focus === s.focus}
                color={s.color}
              />
            ))}
          </div>
        )}

        {/* ── Calendrier ──────────────────────────────────────────────── */}
        <div className="acm-calendar">

          {/* Jours de semaine */}
          <div className="acm-grid">
            {JOURS_SEMAINE.map(j => (
              <div key={j} className="acm-weekday">{j}</div>
            ))}
          </div>

          {loading && (
            <div className="acm-state acm-state--loading">
              <i className="fa-solid fa-spinner fa-spin" />
              Chargement des données gestionpaie…
            </div>
          )}

          {error && (
            <div className="acm-state acm-state--error">
              <i className="fa-solid fa-circle-exclamation" /> {error}
            </div>
          )}

          {data && (
            <div className="acm-grid acm-grid--days">
              {/* Cellules vides pour décaler au bon jour de semaine */}
              {Array.from({ length: offset }).map((_, i) => (
                <div key={`gap-${i}`} className="acm-day acm-day--hors" />
              ))}

              {/* Jours du mois */}
              {data.jours.map(jour => (
                <DayCell key={jour.date} jour={jour} focus={focus} />
              ))}
            </div>
          )}
        </div>

        {/* ── Légende ─────────────────────────────────────────────────── */}
        <div className="acm-legend">
          <span className="acm-leg acm-leg--travaille">Travaillé</span>
          <span className="acm-leg acm-leg--retard">
            <span className="acm-leg__r">R</span>Retard
          </span>
          <span className="acm-leg acm-leg--abs-injust">Abs. injust.</span>
          <span className="acm-leg acm-leg--abs-just">Abs. justif.</span>
          <span className="acm-leg acm-leg--conge">Congé</span>
          <span className="acm-leg acm-leg--ferie">Férié</span>
          <span className="acm-leg acm-leg--do">Repos / DO</span>
        </div>

      </div>
    </div>
  );
}
