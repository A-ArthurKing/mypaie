/*
 * Fichier : PerformanceGrid.jsx
 * Rôle    : Affichage des données de performance PVCP sous forme de tableau.
 * Module  : mypaie / Pages / Performance / SubPages
 */

import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DateRangePicker from '../../../../Components/DateRangePicker/DateRangePicker'
import './PerformanceGrid.css'

function PerformanceGrid({ 
  lignes, 
  total, 
  loading, 
  erreur, 
  filtres, 
  appliquerFiltres, 
  offset, 
  limit, 
  setOffset,
  onSelectAgent 
}) {
  const { projetId } = useParams()
  const navigate = useNavigate()
  
  const decodedProjet = useMemo(() => projetId ? decodeURIComponent(projetId) : null, [projetId])

  // Filtrage des lignes pour le projet sélectionné
  const lignesProjet = useMemo(() => {
    if (!decodedProjet) return []
    return lignes.filter(l => (l.projet || 'PVCP') === decodedProjet)
  }, [lignes, decodedProjet])

  // Calcul des KPIs moyens pour le header de la grille
  const kpis = useMemo(() => {
    if (!lignesProjet.length) return { dmt: 0, conv: 0, prod: 0 }
    
    const totals = lignesProjet.reduce((acc, curr) => {
      acc.calls += curr.in_call_nbr || 0
      acc.bookings += curr.booking_nbr || 0
      acc.call_min += curr.call_min || 0
      acc.worked_min += curr.worked_min || 0
      acc.logged_min += curr.logged_min || 0
      return acc
    }, { calls: 0, bookings: 0, call_min: 0, worked_min: 0, logged_min: 0 })

    return {
      dmt: totals.calls > 0 ? (totals.call_min / totals.calls).toFixed(2) : 0,
      conv: totals.calls > 0 ? ((totals.bookings / totals.calls) * 100).toFixed(1) : 0,
      prod: totals.logged_min > 0 ? ((totals.worked_min / totals.logged_min) * 100).toFixed(1) : 0
    }
  }, [lignesProjet])

  if (erreur) return <div className="perf-error">Erreur: {erreur.message || String(erreur)}</div>

  return (
    <div className="performance-grid">
      
      {/* ── Navigation haut de page ── */}
      <div style={{ display: 'flex', marginBottom: '5px' }}>
        <button className="perf-grid__retour" onClick={() => navigate('/performance')}>
          <i className="fa-solid fa-arrow-left" /> Retour aux projets
        </button>
      </div>

      <div className="perf-grid__nav">
        <div className="perf-grid__title">
          <i className="fa-solid fa-folder-open" />
          <span>{decodedProjet}</span>
          <span className="perf-grid__count">{lignesProjet.length} agents</span>
        </div>
      </div>

      {/* ── Dashboard Top KPI ── */}
      <section className="perf-kpi-dashboard">
        <div className="perf-kpi-card">
          <span className="perf-kpi-card__label">DMT Moyenne</span>
          <span className="perf-kpi-card__value">{kpis.dmt} min</span>
        </div>
        <div className="perf-kpi-card">
          <span className="perf-kpi-card__label">Taux de Conversion</span>
          <span className="perf-kpi-card__value">{kpis.conv}%</span>
        </div>
        <div className="perf-kpi-card">
          <span className="perf-kpi-card__label">Taux d'Occupation</span>
          <span className="perf-kpi-card__value">{kpis.prod}%</span>
        </div>
      </section>

      {/* ── Filtres ── */}
      <section className="perf-filters">
        <div className="perf-filters__group">
          <label>Vue</label>
          <select 
            value={filtres.granularity} 
            onChange={(e) => appliquerFiltres({ granularity: e.target.value })}
            className="perf-filters__select"
          >
            <option value="total">Consolidé (Agent)</option>
            <option value="week">Hebdomadaire (Agent × Semaine)</option>
            <option value="month">Mensuelle (Agent × Mois)</option>
          </select>
        </div>
        <div className="perf-filters__group">
          <label>Période</label>
          <DateRangePicker 
            startDate={filtres.dateDebut}
            endDate={filtres.dateFin}
            onChange={({ start, end }) => appliquerFiltres({ dateDebut: start, dateFin: end })}
          />
        </div>
        <div className="perf-filters__group">
          <label>Agent</label>
          <input 
            type="text" 
            placeholder="Rechercher un agent..."
            value={filtres.agent}
            onChange={(e) => appliquerFiltres({ agent: e.target.value })}
            className="perf-filters__input"
          />
        </div>
      </section>

      {/* ── Table ── */}
      <div className="perf-table-container">
        <table className="perf-table">
          <thead>
            <tr>
              {filtres.granularity !== 'total' && <th title="Période sélectionnée (Mois ou Semaine ISO)">Période</th>}
              <th title="Matricule de l'agent">Matricule</th>
              <th title="Nom de l'agent">Agent</th>
              <th title="Groupe ou opération d'appartenance">Équipe</th>
              <th className="num" title="Nombre de semaines travaillées agrégées">
                {filtres.granularity === 'total' ? 'Semaines' : 'Unit'}
              </th>
              <th className="num" title="Nombre total d'appels traités">Appels</th>
              <th className="num" title="Nombre de ventes réalisées (Bookings)">Ventes</th>
              <th className="num" title="Taux de conversion (Ventes / Appels * 100)">Conv. %</th>
              <th className="num" title="Chiffre d'Affaires généré en Euros">CA (€)</th>
              <th className="num" title="Score moyen de satisfaction client (sur 5)">CSAT</th>
              <th className="num" title="Durée Moyenne de Traitement par appel (en minutes)">DMT</th>
              <th className="num" title="Temps total connecté à l'outil (en heures)">Logged (h)</th>
            </tr>
          </thead>
          <tbody>
            {lignesProjet.map((l, idx) => {
              const calls = Number(l.in_call_nbr) || 0
              const bookings = Number(l.booking_nbr) || 0
              const ca = Number(l.chiffre_affaire) || 0
              const csat = l.metrics_full?.csat_moyen ?? l.csat_moyen
              
              // Utilisation du taux calculé par le backend si dispo
              const convBackend = l.metrics_full?.taux_conversion_calc ?? l.taux_conversion_calc
              const conv = convBackend !== null && convBackend !== undefined 
                ? Number(convBackend).toFixed(1) 
                : (calls > 0 ? ((bookings / calls) * 100).toFixed(1) : '0.0')
                
              const dmt = calls > 0 ? (Number(l.call_min || 0) / calls).toFixed(2) : '0.00'
              const loggedH = (Number(l.logged_min || 0) / 60).toFixed(1)

              // Date d'affichage pour les vues détaillées
              const periodeStr = filtres.granularity === 'month' ? l.mois : (filtres.granularity === 'week' ? `Sem. ${idx+1}` : null) 
              // En fait week view a date_ref qui est le lundi
              const dateRefStr = l.date_ref ? new Date(l.date_ref).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : l.mois

              return (
                <tr key={l.agent_id_hash || idx} onClick={() => onSelectAgent(decodedProjet, l.agent_id_hash)}>
                  {filtres.granularity !== 'total' && (
                    <td className="txt-bold">{filtres.granularity === 'month' ? l.mois : dateRefStr}</td>
                  )}
                  <td>
                    <span className="txt-muted">{l.matricule || '—'}</span>
                  </td>
                  <td>
                    <div className="perf-agent-cell">
                      <div className="perf-avatar">{(l.agent_name || '?').charAt(0)}</div>
                      <span>{l.agent_name || 'Agent inconnu'}</span>
                    </div>
                  </td>
                  <td>{l.agent_group || '—'}</td>
                  <td className="num txt-muted">{l.nb_records || 1}</td>
                  <td className="num">{calls.toLocaleString('fr-FR')}</td>
                  <td className="num font-bold">{bookings.toLocaleString('fr-FR')}</td>
                  <td className="num">
                    <span className={`perf-badge ${Number(conv) > 10 ? 'success' : ''}`}>
                      {conv}%
                    </span>
                  </td>
                  <td className="num font-bold">{ca > 0 ? ca.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : '—'}</td>
                  <td className="num">{csat !== null && csat !== undefined ? Number(csat).toFixed(1) : '—'}</td>
                  <td className="num">{dmt}m</td>
                  <td className="num txt-muted">{loggedH}h</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        
        {lignesProjet.length === 0 && !loading && (
          <div className="perf-empty">Aucune donnée de performance pour cette sélection.</div>
        )}
      </div>

      {/* ── Pagination ── */}
      {total > limit && (
        <div className="perf-pagination">
          <button 
            className="perf-pagination__btn" 
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            <i className="fa-solid fa-chevron-left" aria-hidden="true" />
          </button>
          
          <div className="perf-pagination__info">
            Page <strong>{Math.floor(offset / limit) + 1}</strong> sur {Math.ceil(total / limit)}
            <span className="perf-pagination__total">({total.toLocaleString('fr-FR')} lignes)</span>
          </div>

          <button 
            className="perf-pagination__btn" 
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
          >
            <i className="fa-solid fa-chevron-right" aria-hidden="true" />
          </button>
        </div>
      )}

    </div>
  )
}

export default PerformanceGrid
