/*
 * Fichier : StatsGrid.jsx
 * Rôle    : Grille des indicateurs de performance regroupés par thématique.
 * Module  : mypaie / Pages / Performance / Sections
 */

import React from 'react'
import './StatsGrid.css'

function StatsGrid({ details }) {
  // Sécurité pour éviter les erreurs sur données manquantes
  const d = details || {}

  // Calculs à la volée (DMT, Conversions)
  const calls      = Number(d.in_call_nbr) || 0
  const callMin    = Number(d.in_call_min_nbr) || 0
  const bookings   = Number(d.booking_nbr) || 0
  const loggedMin  = Number(d.agent_logged_time_min_nbr) || 0
  const workedMin  = Number(d.call_worked_time_min_nbr) || 0
  const ca         = Number(d.chiffre_affaire) || 0
  const csat       = d.csat_moyen !== null && d.csat_moyen !== undefined ? Number(d.csat_moyen) : null

  const dmt        = calls > 0 ? (callMin / calls).toFixed(2) : '0.00'
  // On utilise la conversion calculée par le backend si elle existe, sinon calcul frontal
  const conversionBackend = d.taux_conversion_calc
  const conversion = conversionBackend !== null && conversionBackend !== undefined
    ? Number(conversionBackend).toFixed(1)
    : (calls > 0 ? ((bookings / calls) * 100).toFixed(1) : '0.0')

  const occupation = loggedMin > 0 ? ((workedMin / loggedMin) * 100).toFixed(1) : '0.0'

  return (
    <div className="perf-stats-grid">
      
      {/* ── Section : Activité Appels ── */}
      <section className="perf-stats-card">
        <h3 className="perf-stats-card__title">Activité Appels</h3>
        <div className="perf-stats-card__content">
          <MetricItem label="Appels traités" value={calls} />
          <MetricItem label="DMT (min)" value={dmt} accent />
          <MetricItem label="CSAT Moyen" value={csat !== null ? `${csat.toFixed(1)}/10` : 'N/A'} muted />
        </div>
      </section>

      {/* ── Section : Ventes & Conversion ── */}
      <section className="perf-stats-card">
        <h3 className="perf-stats-card__title">Ventes & Conversion</h3>
        <div className="perf-stats-card__content">
          <MetricItem label="Ventes" value={bookings} />
          <MetricItem label="Taux Conversion" value={`${conversion}%`} accent />
          <MetricItem label="Chiffre d'Affaires" value={`${ca.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`} muted />
        </div>
      </section>

      {/* ── Section : Productivité ── */}
      <section className="perf-stats-card">
        <h3 className="perf-stats-card__title">Productivité</h3>
        <div className="perf-stats-card__content">
          <MetricItem label="Logged (h)" value={(loggedMin / 60).toFixed(1)} />
          <MetricItem label="Taux Occupation" value={`${occupation}%`} accent />
          <MetricItem label="Semaines traitées" value={d.nb_records} muted />
        </div>
      </section>

    </div>
  )
}

/**
 * Petit composant interne pour l'alignement Label / Valeur
 */
function MetricItem({ label, value, accent = false, muted = false }) {
  return (
    <div className={`perf-metric-item ${accent ? 'perf-metric-item--accent' : ''} ${muted ? 'perf-metric-item--muted' : ''}`}>
      <span className="perf-metric-item__label">{label}</span>
      <span className="perf-metric-item__value">{value ?? '—'}</span>
    </div>
  )
}

export default StatsGrid
