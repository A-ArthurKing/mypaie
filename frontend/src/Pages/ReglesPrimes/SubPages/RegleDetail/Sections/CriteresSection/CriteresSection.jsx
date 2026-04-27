/*
 * Fichier : CriteresSection.jsx
 * Rôle    : Onglet "Critères" du détail d'une règle de prime.
 *           Affichera les paliers, KPIs et conditions de calcul.
 * Module  : mypaie / Pages / ReglesPrimes / SubPages / Sections
 */

import React, { useState } from 'react';
import './CriteresSection.css';

export default function CriteresSection({ regle }) {
  const [searchKpi, setSearchKpi] = useState('');

  return (
    <div className="criteres-section">
      <div className="criteres-section__toolbar">
        <div className="criteres-section__search-wrapper">
          <i className="fa-solid fa-magnifying-glass criteres-section__search-icon"></i>
          <input
            type="text"
            className="criteres-section__search"
            placeholder="Rechercher un KPI ou un palier…"
            value={searchKpi}
            onChange={(e) => setSearchKpi(e.target.value)}
          />
          {searchKpi && (
            <button
              className="criteres-section__search-clear"
              onClick={() => setSearchKpi('')}
              title="Effacer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>
        <button className="criteres-section__btn-add" disabled title="Fonctionnalité à venir">
          <i className="fa-solid fa-plus"></i> Ajouter un critère
        </button>
      </div>

      <div className="criteres-section__empty">
        <i className="fa-solid fa-sliders criteres-section__empty-icon"></i>
        <h3 className="criteres-section__empty-title">Aucun critère configuré</h3>
        <p className="criteres-section__empty-text">
          Les paliers et indicateurs de calcul de cette règle seront définis ici.
        </p>
      </div>
    </div>
  );
}
