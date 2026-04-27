/*
 * Fichier : PerformanceDetail.jsx
 * Rôle    : Vue détaillée d'un agent pour la performance.
 * Module  : mypaie / Pages / Performance / SubPages
 */

/*
 * Fichier : PerformanceDetail.jsx
 * Rôle    : Page orchestratrice du détail de performance d'un agent.
 *           Décomposée en sections : HeaderAgent, StatsGrid, RawData.
 * Module  : mypaie / Pages / Performance / SubPages
 */

import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

// Import des sections
import HeaderAgent from './Sections/HeaderAgent/HeaderAgent'
import StatsGrid from './Sections/StatsGrid/StatsGrid'
import RawData from './Sections/RawData/RawData'

import './PerformanceDetail.css'

function PerformanceDetail({ lignes = [] }) {
  const { projetId, agentHash } = useParams()
  const navigate = useNavigate()

  // Recherche de l'agent dans le jeu de données courant
  const agentData = useMemo(() => {
    return lignes.find(l => l.agent_id_hash === agentHash)
  }, [lignes, agentHash])

  // Cas : agent introuvable (ex: refresh direct sur URL sans cache)
  if (!agentData) {
    return (
      <div className="perf-detail-error">
        <div className="perf-detail-error__card">
          <i className="fa-solid fa-user-slash" />
          <p>Données de l'agent indisponibles.</p>
          <button onClick={() => navigate('/performance')}>Retour à la liste</button>
        </div>
      </div>
    )
  }

  return (
    <div className="perf-detail-container">
      
      <div style={{ display: 'flex', marginBottom: '5px' }}>
        <button className="perf-header-agent__back" onClick={() => navigate(`/performance/${encodeURIComponent(projetId)}`)}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true" />
          Retour au projet
        </button>
      </div>

      {/* ── Section 1 : Navigation et Profil ── */}
      <HeaderAgent 
        agent={agentData} 
      />

      {/* ── Section 2 : Indicateurs KPIs ── */}
      <StatsGrid 
        details={agentData.metrics_full} 
      />

      {/* ── Section 3 : Données techniques ── */}
      <RawData 
        data={agentData.metrics_full} 
      />

    </div>
  )
}

export default PerformanceDetail

