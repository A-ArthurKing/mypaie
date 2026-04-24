/*
 * Fichier : NotesQualite.jsx
 * Rôle    : Page principale des notes qualité (Eval Plus).
 * Module  : mypaie / Pages / NotesQualite
 */

import { useMemo, useEffect } from 'react'
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom'
import useNotesQualite from './useNotesQualite'
import DateRangePicker from '../../Components/DateRangePicker/DateRangePicker'
import NotesQualiteGrid from './SubPages/NotesQualiteGrid/NotesQualiteGrid'
import NotesQualiteDetail from './SubPages/NotesQualiteDetail/NotesQualiteDetail'
import Loader from '../../Shared/UI/Loader/Loader'
import './NotesQualite.css'

function NotesQualite() {
  const { 
    lignes,
    projetsStats,
    statsGlobal,
    loading, 
    erreur, 
    filtres, 
    appliquerFiltres,
    chargerGrid,
    chargerDetail
  } = useNotesQualite()

  const navigate = useNavigate()
  const location = useLocation()

  // On cache le KPI global si on est dans le détail d'un projet
  const isDetail = location.pathname !== '/qualite' && location.pathname !== '/qualite/'

  // Moyenne globale visible uniquement sur la grille
  const moyenneGlobale = useMemo(() => {
    if (statsGlobal) return Number(statsGlobal.moyenne_globale).toFixed(1)
    if (projetsStats.length === 0) return 0
    const sum = projetsStats.reduce((acc, curr) => acc + (Number(curr.moyenne) || 0), 0)
    return (sum / projetsStats.length).toFixed(1)
  }, [projetsStats, statsGlobal])

  return (
    <div className="notes-qualite-page">
      <header className="notes-qualite-page__header">
        <div>
          <h1 className="notes-qualite-page__title">
            <i className="fa-solid fa-star" aria-hidden="true" style={{ marginRight: '10px', color: '#ffc107' }} />
            Notes Qualité
          </h1>
          <p className="notes-qualite-page__subtitle">
            Analyse des évaluations Eval Plus
          </p>
        </div>
        
        {!isDetail && (statsGlobal || projetsStats.length > 0) && !loading && (
          <div className="nq-kpi-global">
            <span className="nq-kpi-global__label">Moyenne Globale</span>
            <span className="nq-kpi-global__value">{moyenneGlobale}%</span>
          </div>
        )}
      </header>

      <section className="nq-filtres">
        <div className="nq-filtres__groupe">
          <label>Période</label>
          <DateRangePicker 
            startDate={filtres.dateDebut}
            endDate={filtres.dateFin}
            onChange={({ start, end }) => appliquerFiltres({ dateDebut: start, dateFin: end })}
          />
        </div>
      </section>

      <div className="notes-qualite-page__content">
        {loading && <Loader />}
        
        <Routes>
          <Route index element={
            <GridWrapper 
              projetsStats={projetsStats}
              loading={loading}
              erreur={erreur}
              chargerGrid={chargerGrid}
              onSelectProjet={(p) => navigate(encodeURIComponent(p))}
            />
          } />
          
          <Route path=":projetId" element={
            <DetailWrapper 
              lignes={lignes}
              loading={loading}
              chargerDetail={chargerDetail}
            />
          } />
        </Routes>
      </div>
    </div>
  )
}

function GridWrapper({ projetsStats, loading, erreur, chargerGrid, onSelectProjet }) {
  useEffect(() => {
    chargerGrid()
  }, [chargerGrid])

  return (
    <>
      {!loading && (
        <div className="nq-statut">
          <span><strong>{projetsStats.length}</strong> projets analysés</span>
        </div>
      )}

      <NotesQualiteGrid 
        projetsStats={projetsStats}
        loading={loading}
        erreur={erreur}
        onSelectProjet={onSelectProjet}
      />
    </>
  )
}

function DetailWrapper({ lignes, loading, chargerDetail }) {
  const { projetId } = useParams()
  
  useEffect(() => {
    if (projetId) chargerDetail(decodeURIComponent(projetId))
  }, [projetId, chargerDetail])

  return <NotesQualiteDetail lignes={lignes} loading={loading} />
}

export default NotesQualite
