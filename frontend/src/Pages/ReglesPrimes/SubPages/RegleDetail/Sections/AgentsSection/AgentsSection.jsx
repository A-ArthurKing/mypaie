/*
 * Fichier : AgentsSection.jsx
 * Rôle    : Onglet "Agents" du détail d'une règle de prime.
 *           Affichera les agents associés à cette règle avec leurs résultats.
 * Module  : mypaie / Pages / ReglesPrimes / SubPages / Sections
 */

import React, { useState } from 'react';
import './AgentsSection.css';

export default function AgentsSection({ regle }) {
  const [searchAgent, setSearchAgent] = useState('');
  const [filterStatut, setFilterStatut] = useState('tous');

  return (
    <div className="agents-section">
      <div className="agents-section__toolbar">
        <div className="agents-section__search-wrapper">
          <i className="fa-solid fa-magnifying-glass agents-section__search-icon"></i>
          <input
            type="text"
            className="agents-section__search"
            placeholder="Rechercher un agent…"
            value={searchAgent}
            onChange={(e) => setSearchAgent(e.target.value)}
          />
          {searchAgent && (
            <button
              className="agents-section__search-clear"
              onClick={() => setSearchAgent('')}
              title="Effacer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>

        <div className="agents-section__filters">
          {['tous', 'eligible', 'non-eligible'].map((statut) => (
            <button
              key={statut}
              className={`agents-section__filter-btn ${filterStatut === statut ? 'agents-section__filter-btn--active' : ''}`}
              onClick={() => setFilterStatut(statut)}
            >
              {statut === 'tous' ? 'Tous' : statut === 'eligible' ? 'Éligibles' : 'Non éligibles'}
            </button>
          ))}
        </div>
      </div>

      <div className="agents-section__empty">
        <i className="fa-solid fa-users agents-section__empty-icon"></i>
        <h3 className="agents-section__empty-title">Aucun agent associé</h3>
        <p className="agents-section__empty-text">
          Les agents éligibles à cette règle de prime apparaîtront ici avec leurs résultats calculés.
        </p>
      </div>
    </div>
  );
}
