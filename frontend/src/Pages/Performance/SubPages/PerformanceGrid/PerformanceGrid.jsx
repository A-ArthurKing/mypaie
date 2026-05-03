/*
 * Fichier : PerformanceGrid.jsx
 * Rôle    : Affichage des données de performance PVCP sous forme de tableau.
 * Module  : mypaie / Pages / Performance / SubPages
 */

import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DateRangePicker from '../../../../Components/DateRangePicker/DateRangePicker'
import KpiInfoModal from '../../../../Components/KpiInfoModal/KpiInfoModal'
import './PerformanceGrid.css'

// Dictionnaire des métadonnées pour la modale d'information
const KPI_METADATA = {
  conv: {
    title: "Taux de Conversion",
    formula: "(Nombre de ventes / Nombre d'appels) × 100",
    sourceTable: "dataset_pvcp.pvcp_data_outils_client_performance",
    metrics: "booking_nbr, in_call_nbr",
    description: "Pourcentage d'appels ayant abouti à une vente."
  },
  mea: {
    title: "Taux de Mise en Attente (Tx MEA)",
    formula: "(Temps d'attente / Temps d'appel) × 100",
    sourceTable: "dataset_pvcp.pvcp_data_outils_client_performance",
    metrics: "in_hold_min_nbr, in_call_min_nbr",
    description: "Ratio du temps que le client a passé en attente pendant l'appel."
  },
  ca: {
    title: "Chiffre d'Affaires (CA)",
    formula: "Somme des revenus générés",
    sourceTable: "dataset_pvcp.pvcp_data_outils_client_performance",
    metrics: "revenue_amt_eur",
    description: "Total du chiffre d'affaires brut généré par les ventes."
  },
  csat: {
    title: "Score CSAT",
    formula: "Moyenne pondérée des scores de satisfaction",
    sourceTable: "dataset_pvcp.pvcp_data_outils_client_performance",
    metrics: "total_csat_num, csat_nbr",
    description: "Note moyenne attribuée par les clients après l'interaction."
  },
  dmt: {
    title: "Durée Moyenne de Traitement (DMT)",
    formula: "Temps total d'appel / Nombre d'appels",
    sourceTable: "dataset_pvcp.pvcp_data_outils_client_performance",
    metrics: "in_call_min_nbr, in_call_nbr",
    description: "Durée moyenne en minutes passée en ligne avec les clients."
  },
  logged: {
    title: "Temps Connecté (Logged)",
    formula: "Temps total de production / 60",
    sourceTable: "dataset_pvcp.pvcp_data_outils_client_performance",
    metrics: "agent_logged_time_min_nbr",
    description: "Volume horaire total pendant lequel l'agent était connecté aux outils."
  },
  ventes: {
    title: "Ventes Brutes",
    formula: "Somme des réservations/contrats",
    sourceTable: "dataset_pvcp.pvcp_data_outils_client_performance",
    metrics: "booking_nbr",
    description: "Volume total de ventes ou réservations enregistrées."
  },
  appels: {
    title: "Appels Traités",
    formula: "Somme des appels décrochés",
    sourceTable: "dataset_pvcp.pvcp_data_outils_client_performance",
    metrics: "in_call_nbr",
    description: "Volume total d'appels entrants ou sortants traités par l'agent."
  }
};

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
  
  const [infoModalData, setInfoModalData] = useState(null);

  const handleOpenInfo = (e, key) => {
    e.preventDefault();
    e.stopPropagation();
    setInfoModalData(KPI_METADATA[key]);
  };
  
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
              <th className="num" title="Nombre total d'appels traités">
                Appels <i className="fa-solid fa-circle-exclamation info-icon" onClick={(e) => handleOpenInfo(e, 'appels')}></i>
              </th>
              <th className="num" title="Nombre de ventes réalisées (Bookings)">
                Ventes <i className="fa-solid fa-circle-exclamation info-icon" onClick={(e) => handleOpenInfo(e, 'ventes')}></i>
              </th>
              <th className="num" title="Taux de conversion (Ventes / Appels * 100)">
                Conv. % <i className="fa-solid fa-circle-exclamation info-icon" onClick={(e) => handleOpenInfo(e, 'conv')}></i>
              </th>
              <th className="num" title="Taux de mise en attente (Temps attente / Temps appel * 100)">
                Tx MEA % <i className="fa-solid fa-circle-exclamation info-icon" onClick={(e) => handleOpenInfo(e, 'mea')}></i>
              </th>
              <th className="num" title="Chiffre d'Affaires généré en Euros">
                CA (€) <i className="fa-solid fa-circle-exclamation info-icon" onClick={(e) => handleOpenInfo(e, 'ca')}></i>
              </th>
              <th className="num" title="Score moyen de satisfaction client (sur 5)">
                CSAT <i className="fa-solid fa-circle-exclamation info-icon" onClick={(e) => handleOpenInfo(e, 'csat')}></i>
              </th>
              <th className="num" title="Durée Moyenne de Traitement par appel (en minutes)">
                DMT <i className="fa-solid fa-circle-exclamation info-icon" onClick={(e) => handleOpenInfo(e, 'dmt')}></i>
              </th>
              <th className="num" title="Temps total connecté à l'outil (en heures)">
                Logged (h) <i className="fa-solid fa-circle-exclamation info-icon" onClick={(e) => handleOpenInfo(e, 'logged')}></i>
              </th>
            </tr>
          </thead>
          <tbody>
            {lignesProjet.map((l, idx) => {
              const calls = Number(l.in_call_nbr || l.nb_appels) || 0
              const bookings = Number(l.booking_nbr || l.nb_ventes) || 0
              const ca = Number(l.chiffre_affaire) || 0
              const csat = l.metrics_full?.csat_moyen ?? l.csat_moyen
              
              // Utilisation du taux calculé par le backend si dispo
              // Dans les vues mensuelles/hebdo, c'est un ratio brut (ex: 0.04), on le multiplie par 100
              let convBackend = l.metrics_full?.taux_conversion_calc ?? l.taux_conversion_calc ?? l.taux_conversion
              if (filtres.granularity !== 'total' && convBackend) {
                 convBackend = convBackend * 100
              }
              const conv = convBackend !== null && convBackend !== undefined 
                ? Number(convBackend).toFixed(1) 
                : (calls > 0 ? ((bookings / calls) * 100).toFixed(1) : '0.0')
                
              const txMea = l.tx_mea !== null && l.tx_mea !== undefined ? Number(l.tx_mea).toFixed(1) : '0.0'
                
              const dmt = calls > 0 ? (Number(l.call_min || l.temps_appel || 0) / calls).toFixed(2) : '0.00'
              const loggedH = (Number(l.logged_min || l.temps_production || 0) / 60).toFixed(1)

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
                  <td className="num">{txMea}%</td>
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

      {/* Modale d'information sur les KPIs */}
      <KpiInfoModal 
        isOpen={!!infoModalData} 
        onClose={() => setInfoModalData(null)} 
        data={infoModalData} 
      />
    </div>
  )
}

export default PerformanceGrid
