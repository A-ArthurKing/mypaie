/*
 * Fichier : AgentRow.jsx
 * Rôle    : Ligne individuelle d'un agent avec son panneau de détail.
 * Module  : mypaie / Pages / NotesQualite / SubPages / NotesQualiteDetail / Components
 */

import React from 'react'
import './AgentRow.css'

function AgentRow({ agent, ouvert, onToggle, gridTemplate, itemsCanon }) {
  const classeNote = (note) => Number(note) >= 80 ? 'nq-note--good' : 'nq-note--bad'

  return (
    <div className={`nq-agent-row${ouvert ? ' nq-agent-row--ouvert' : ''}`}>
      <button
        className="nq-agent-row__header"
        style={{ gridTemplateColumns: gridTemplate }}
        onClick={onToggle}
        title={ouvert ? 'Replier' : 'Afficher le détail'}
      >
        {/* Colonne agent */}
        <div className="nq-agent-row__ident">
          <i className={`fa-solid ${ouvert ? 'fa-chevron-down' : 'fa-chevron-right'} nq-agent-row__chevron`} />
          <div className="nq-agent-row__avatar">{agent.agent.charAt(0).toUpperCase()}</div>
          <div className="nq-agent-row__infos">
            <span className="nq-agent-row__nom">{agent.agent}</span>
            <span className="nq-agent-row__meta">{agent.nbEvals} évaluation{agent.nbEvals > 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Colonnes notes par item */}
        {agent.notesItems.map(it => (
          <div key={it.item} className="nq-agent-row__cell">
            {it.moyenne === null ? (
              <span className="nq-cell-empty">—</span>
            ) : (
              <>
                <span className={`nq-cell-note ${classeNote(it.moyenne)}`}>
                  {it.moyenne.toFixed(1)}%
                </span>
                <span className="nq-cell-sub">{it.nb} éval.</span>
              </>
            )}
          </div>
        ))}

        {/* Colonne globale */}
        <div className="nq-agent-row__cell nq-agent-row__cell--right">
          <span className={`nq-cell-note nq-cell-note--big ${classeNote(agent.noteGlobale)}`}>
            {agent.noteGlobale.toFixed(1)}%
          </span>
        </div>
      </button>

      {/* Panneau déroulant : sous-items groupés par Item_Global */}
      {ouvert && (
        <div className="nq-agent-row__panel">
          {agent.groupesPanel.map(groupe => (
            <div key={groupe.item} className="nq-panel-groupe">
              <div className="nq-panel-groupe__header">
                <span className="nq-panel-groupe__titre">{groupe.item}</span>
                <span className={`nq-panel-groupe__moy nq-cell-note ${classeNote(groupe.moyenneItem)}`}>
                  {groupe.moyenneItem.toFixed(1)}%
                </span>
              </div>
              <table className="nq-table nq-table--compact nq-table--inner">
                <thead>
                  <tr>
                    <th>Sous-Item</th>
                    <th>Évaluateur</th>
                    <th>Date</th>
                    <th className="nq-th--num">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {groupe.lignes.map((l, i) => (
                    <tr key={i}>
                      <td>{l.Sous_Item}</td>
                      <td className="nq-td--muted">{l.Evaluateur || '—'}</td>
                      <td className="nq-td--muted">{new Date(l.Date_Evaluation).toLocaleDateString('fr-FR')}</td>
                      <td className="nq-td--num">
                        <span className={`nq-note ${classeNote(l.Note_Sous_Item)}`}>
                          {l.Note_Sous_Item}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AgentRow
