/*
 * Fichier : ListeAgents.jsx
 * Rôle    : Section de navigation et liste des agents.
 * Module  : mypaie / Pages / NotesQualite / SubPages / NotesQualiteDetail / Sections
 */

import React from 'react'
import AgentRow from '../../Components/AgentRow/AgentRow'
import './ListeAgents.css'

function ListeAgents({ 
  decodedProjet, 
  navigate, 
  recherche, 
  setRecherche, 
  agentsFiltres, 
  itemsCanon, 
  gridTemplate,
  agentDeplie,
  setAgentDeplie
}) {
  return (
    <>
      {/* En-tête de colonnes */}
      <div className="nq-agents-header" style={{ gridTemplateColumns: gridTemplate }}>
        <div className="nq-agents-header__cell">Agent</div>
        {itemsCanon.map(item => (
          <div key={item} className="nq-agents-header__cell" title={item}>{item}</div>
        ))}
        <div className="nq-agents-header__cell nq-agents-header__cell--right">Globale</div>
      </div>

      <div className="nq-agents-list">
        {agentsFiltres.map((a) => (
          <AgentRow 
            key={a.agent}
            agent={a}
            ouvert={agentDeplie === a.agent}
            onToggle={() => setAgentDeplie(agentDeplie === a.agent ? null : a.agent)}
            gridTemplate={gridTemplate}
            itemsCanon={itemsCanon}
          />
        ))}

        {agentsFiltres.length === 0 && (
          <div className="nq-detail__vide">
            <i className="fa-solid fa-inbox" />
            <span>Aucun agent trouvé</span>
          </div>
        )}
      </div>
    </>
  )
}

export default ListeAgents
