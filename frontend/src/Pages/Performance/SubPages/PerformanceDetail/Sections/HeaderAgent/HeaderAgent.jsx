/*
 * Fichier : HeaderAgent.jsx
 * Rôle    : En-tête de la vue détail — affiche le bouton retour et le profil de l'agent.
 * Module  : mypaie / Pages / Performance / Sections
 */

import React from 'react'
import './HeaderAgent.css'

function HeaderAgent({ agent }) {
  // Extraction des initiales pour l'avatar
  const initiale = (agent.agent_name || '?').charAt(0).toUpperCase()

  return (
    <header className="perf-header-agent">
      {/* Profil résumé de l'agent */}
      <div className="perf-header-agent__profile">
        <div className="perf-header-agent__avatar">{initiale}</div>
        <div className="perf-header-agent__infos">
          <h2 className="perf-header-agent__name">{agent.agent_name}</h2>
          <p className="perf-header-agent__meta">
            <span className="perf-header-agent__group">{agent.agent_group}</span>
            <span className="perf-header-agent__sep">•</span>
            <span className="perf-header-agent__project">{agent.projet}</span>
          </p>
        </div>
      </div>
    </header>
  )
}

export default HeaderAgent
