/*
 * Fichier : RawData.jsx
 * Rôle    : Affiche les données techniques (JSON) de l'agent.
 * Module  : mypaie / Pages / Performance / Sections
 */

import React, { useState } from 'react'
import './RawData.css'

function RawData({ data }) {
  const [isOpen, setIsOpen] = useState(false)

  if (!data) return null

  return (
    <div className="perf-raw-data">
      {/* Bouton pour déplier les données techniques */}
      <button 
        className={`perf-raw-data__toggle ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <i className={`fa-solid ${isOpen ? 'fa-eye-slash' : 'fa-eye'}`} />
        {isOpen ? 'Masquer les données brutes' : 'Afficher les données techniques (JSON)'}
      </button>

      {/* Affichage conditionnel du JSON formaté */}
      {isOpen && (
        <div className="perf-raw-data__content">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

export default RawData
