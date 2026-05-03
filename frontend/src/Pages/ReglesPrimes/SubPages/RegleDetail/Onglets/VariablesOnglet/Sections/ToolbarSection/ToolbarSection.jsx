import React from 'react';
import './ToolbarSection.css';

export default function ToolbarSection({ searchKpi, setSearchKpi }) {
  return (
    <div className="variables-onglet__toolbar">
      <div className="variables-onglet__search-wrapper">
        <i className="fa-solid fa-magnifying-glass variables-onglet__search-icon"></i>
        <input
          type="text"
          className="variables-onglet__search"
          placeholder="Rechercher un KPI ou un paramètre…"
          value={searchKpi}
          onChange={(e) => setSearchKpi(e.target.value)}
        />
        {searchKpi && (
          <button
            className="variables-onglet__search-clear"
            onClick={() => setSearchKpi('')}
            title="Effacer"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        )}
      </div>
      <button className="variables-onglet__btn-add" disabled title="Fonctionnalité à venir">
        <i className="fa-solid fa-plus"></i> Ajouter un critère
      </button>
    </div>
  );
}
