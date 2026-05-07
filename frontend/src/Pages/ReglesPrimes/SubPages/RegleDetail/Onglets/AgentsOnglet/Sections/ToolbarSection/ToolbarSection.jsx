/*
 * Fichier : ToolbarSection.jsx
 * Rôle    : Barre de recherche et filtre par statut de l'onglet Agents
 *           d'une règle de prime.
 * Dépend  : ToolbarSection.css
 * Module  : mypaie / Pages / ReglesPrimes / SubPages / RegleDetail / AgentsOnglet
 */
import React from 'react';
import './ToolbarSection.css';

export default function ToolbarSection({ searchAgent, setSearchAgent, filterStatut, setFilterStatut }) {
  return (
    <div className="agents-onglet__toolbar">
      <div className="agents-onglet__search-wrapper">
        <i className="fa-solid fa-magnifying-glass agents-onglet__search-icon"></i>
        <input
          type="text"
          className="agents-onglet__search"
          placeholder="Rechercher un agent…"
          value={searchAgent}
          onChange={(e) => setSearchAgent(e.target.value)}
        />
        {searchAgent && (
          <button
            className="agents-onglet__search-clear"
            onClick={() => setSearchAgent('')}
            title="Effacer"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        )}
      </div>

      <div className="agents-onglet__filters">
        {['tous', 'eligible', 'non-eligible'].map((statut) => (
          <button
            key={statut}
            className={`agents-onglet__filter-btn ${filterStatut === statut ? 'agents-onglet__filter-btn--active' : ''}`}
            onClick={() => setFilterStatut(statut)}
          >
            {statut === 'tous' ? 'Tous' : statut === 'eligible' ? 'Éligibles' : 'Non éligibles'}
          </button>
        ))}
      </div>
    </div>
  );
}
