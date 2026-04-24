/*
 * Fichier : HeuresAgents.jsx
 * Rôle    : Page parente des heures — Orchestre les routes Grid et Detail.
 * Module  : mypaie / Pages / HeuresAgents
 */

// #region IMPORTS
import { Routes, Route } from 'react-router-dom'
import './HeuresAgents.css'
import useHeuresAgents from './useHeuresAgents'
import HeuresAgentsGrid from './SubPages/HeuresAgentsGrid/HeuresAgentsGrid'
import HeuresAgentsDetail from './SubPages/HeuresAgentsDetail/HeuresAgentsDetail'
import Loader from '../../Shared/UI/Loader/Loader'
// #endregion

// #region COMPOSANT
function HeuresAgents() {

  // Hook unique de gestion des données (partagé entre les vues)
  const {
    lignes,
    total,
    loading,
    erreur,
    equipes,
    projets,
    filtresDefaut,
    appliquerFiltres,
  } = useHeuresAgents()

  return (
    <div className="heures-agents-page">

      {/* En-tête fixe (Header de la page) */}
      <header className="heures-agents-page__header">
        <div>
          <h1 className="heures-agents-page__title">
            <i className="fa-solid fa-clock" aria-hidden="true" style={{ marginRight: '10px', color: 'var(--color-accent)' }} />
            Heures des Agents
          </h1>
          <p className="heures-agents-page__subtitle">
            Suivi analytique par projet — BigQuery
          </p>
        </div>
      </header>

      <div className="heures-agents-page__content">
        {loading && <Loader />}
        
        {/* Routage interne pour séparer Grid (Index) et Detail (Sous-page) */}
        <Routes>
          <Route index element={
            <HeuresAgentsGrid 
              lignes={lignes}
              total={total}
              loading={loading}
              erreur={erreur}
              equipes={equipes}
              projets={projets}
              filtresDefaut={filtresDefaut}
              appliquerFiltres={appliquerFiltres}
            />
          } />
          <Route path=":projetId" element={
            <HeuresAgentsDetail lignes={lignes} />
          } />
        </Routes>
      </div>

    </div>
  )
}
// #endregion

export default HeuresAgents

