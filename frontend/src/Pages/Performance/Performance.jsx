/*
 * Fichier : Performance.jsx
 * Rôle    : Page parente des performances (PVCP).
 * Module  : mypaie / Pages / Performance
 */

import { useMemo } from 'react'
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom'
import usePerformance from './usePerformance'
import PerformanceProjectGrid from './SubPages/PerformanceProjectGrid/PerformanceProjectGrid'
import PerformanceGrid from './SubPages/PerformanceGrid/PerformanceGrid'
import PerformanceDetail from './SubPages/PerformanceDetail/PerformanceDetail'
import Loader from '../../Shared/UI/Loader/Loader'
import RefreshIndicator from '../../Shared/UI/RefreshIndicator/RefreshIndicator'
import './Performance.css'

function Performance() {
  const {
    lignes,
    total,
    loading,
    refreshing,
    erreur,
    filtres,
    appliquerFiltres,
    offset,
    limit,
    setOffset
  } = usePerformance()

  const navigate = useNavigate()
  const location = useLocation()

  // Détermine si on affiche la liste des projets ou le détail d'un projet
  const isProjectGrid = location.pathname === '/performance' || location.pathname === '/performance/'

  // Calcul du taux de conversion global pour le header (uniquement sur la grille)
  const conversionGlobale = useMemo(() => {
    if (!lignes.length) return 0
    const totals = lignes.reduce((acc, curr) => {
      acc.calls += curr.in_call_nbr || 0
      acc.bookings += curr.booking_nbr || 0
      return acc
    }, { calls: 0, bookings: 0 })
    return totals.calls > 0 ? ((totals.bookings / totals.calls) * 100).toFixed(1) : 0
  }, [lignes])

  return (
    <div className="performance-page">
      <RefreshIndicator active={refreshing && !loading} />

      <header className="performance-page__header">
        <div>
          <h1 className="performance-page__title">
            <i className="fa-solid fa-chart-line" aria-hidden="true" style={{ marginRight: '10px', color: '#10b981' }} />
            Performance
          </h1>
          <p className="performance-page__subtitle">
            {isProjectGrid 
              ? "Sélectionnez un projet pour analyser les indicateurs" 
              : "Analyse des indicateurs opérationnels et conversion"}
          </p>
        </div>

        {isProjectGrid && lignes.length > 0 && !loading && (
          <div className="perf-kpi-global">
            <span className="perf-kpi-global__label">Conversion Globale</span>
            <span className="perf-kpi-global__value">{conversionGlobale}%</span>
          </div>
        )}
      </header>

      <div className="performance-page__content">
        {loading && <Loader />}
        
        <Routes>
          {/* Vue 1 : Grille des projets (Cartes) */}
          <Route index element={
            <>
              {!loading && lignes.length > 0 && (
                <div className="perf-statut">
                  <span><strong>1</strong> projet analysé</span>
                </div>
              )}
              <PerformanceProjectGrid 
                lignes={lignes}
                loading={loading}
                onSelectProjet={(id) => navigate(encodeURIComponent(id))}
              />
            </>
          } />
          
          {/* Vue 2 : Liste des agents du projet */}
          <Route path=":projetId" element={
            <PerformanceGrid 
              lignes={lignes}
              total={total}
              loading={loading}
              erreur={erreur}
              filtres={filtres}
              appliquerFiltres={appliquerFiltres}
              offset={offset}
              limit={limit}
              setOffset={setOffset}
              onSelectAgent={(projId, agentId) => navigate(`${encodeURIComponent(projId)}/${encodeURIComponent(agentId)}`)}
            />
          } />

          {/* Vue 3 : Détail d'un agent */}
          <Route path=":projetId/:agentHash" element={
            <PerformanceDetail lignes={lignes} />
          } />
        </Routes>
      </div>
    </div>
  )
}

export default Performance
