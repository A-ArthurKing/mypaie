/*
 * Fichier : HeaderSection.jsx
 * Rôle    : En-tête de la page Règles de Primes — titre, sous-titre et action principale.
 * Module  : mypaie / Pages / ReglesPrimes / Sections
 */

import React from 'react';
import './HeaderSection.css';

export default function HeaderSection({ onCreateClick }) {
  return (
    <header className="header-section">
      <div className="header-section__text">
        <h1 className="header-section__title">Générateur de Règles</h1>
        <p className="header-section__subtitle">
          Configurez les règles de calcul des primes (KPIs, paliers, statuts)
        </p>
      </div>
      <div className="header-section__actions">
        <button className="header-section__btn-create" onClick={onCreateClick}>
          <i className="fa-solid fa-plus"></i> Nouvelle Règle
        </button>
      </div>
    </header>
  );
}
