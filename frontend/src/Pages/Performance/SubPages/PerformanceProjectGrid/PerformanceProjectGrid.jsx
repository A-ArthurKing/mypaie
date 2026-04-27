/*
 * Fichier : PerformanceProjectGrid.jsx
 * Rôle    : Affiche la liste des projets disponibles pour la performance sous forme de cartes.
 * Module  : mypaie / Pages / Performance / SubPages
 */

import { useMemo } from 'react'
import './PerformanceProjectGrid.css'

function PerformanceProjectGrid({ lignes, onSelectProjet, loading }) {

  // Agrégation simplifiée pour les cartes projets (PVCP, etc.)
  const projectsStats = useMemo(() => {
    if (!lignes.length) return []
    
    const groups = lignes.reduce((acc, curr) => {
      const p = curr.projet || 'PVCP'
      if (!acc[p]) acc[p] = { name: p, calls: 0, bookings: 0, agents: new Set() }
      acc[p].calls += curr.in_call_nbr || 0
      acc[p].bookings += curr.booking_nbr || 0
      acc[p].agents.add(curr.agent_id_hash)
      return acc
    }, {})

    return Object.values(groups).map(p => {
      const conv = p.calls > 0 ? (p.bookings / p.calls) * 100 : 0
      return {
        ...p,
        conv: conv.toFixed(1),
        convRaw: conv,
        agentCount: p.agents.size
      }
    })
  }, [lignes])

  return (
    <div className="perf-project-grid">
      {projectsStats.map(p => (
        <PerformanceProjectCard 
          key={p.name} 
          projet={p} 
          onClick={() => onSelectProjet(p.name)} 
        />
      ))}

      {projectsStats.length === 0 && !loading && (
        <div className="perf-empty-state">
           <i className="fa-solid fa-layer-group" />
           <p>Aucune donnée de performance disponible.</p>
        </div>
      )}
    </div>
  )
}

function PerformanceProjectCard({ projet, onClick }) {
  const score = Math.round(projet.convRaw)
  // Seuil de conversion (ex: 10% pour PVCP est "bon" selon les standards habituels de vente directe)
  const isGood = score >= 10 

  // Paramètres du cercle SVG (Jauge semi-circulaire)
  const radius = 45
  const circumference = Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="perf-project-card" onClick={onClick}>
      <div className="perf-project-card__header">
        <h3 className="perf-project-card__title" title={projet.name}>{projet.name}</h3>
        <i className="fa-solid fa-arrow-right-to-bracket perf-project-card__arrow" />
      </div>

      <div className="perf-project-card__body">
        <div className="perf-project-card__gauge-container">
          <svg className="perf-project-card__gauge" viewBox="0 0 100 60">
            <path
              className="gauge-bg"
              d="M 5,55 A 45,45 0 0 1 95,55"
              fill="none"
              strokeWidth="10"
            />
            <path
              className={`gauge-value ${isGood ? 'good' : 'bad'}`}
              d="M 5,55 A 45,45 0 0 1 95,55"
              fill="none"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="perf-project-card__score-center">
            <span className="perf-project-card__score-number">{projet.conv}%</span>
            <span className="perf-project-card__score-label">Conversion</span>
          </div>
        </div>
      </div>

      <div className="perf-project-card__footer">
        <div className="perf-project-card__stat">
          <i className="fa-solid fa-users" />
          <span><strong>{projet.agentCount}</strong> agents actifs</span>
        </div>
      </div>
    </div>
  )
}

export default PerformanceProjectGrid
