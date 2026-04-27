/*
 * Fichier : ReglesGridSection.jsx
 * Rôle    : Grille des cartes règles de primes — états loading, vide et liste.
 * Module  : mypaie / Pages / ReglesPrimes / Sections
 */

import React from 'react';
import './ReglesGridSection.css';

const PERIODICITE_LABELS = {
  mensuelle: 'Mensuelle',
  trimestrielle: 'Trimestrielle',
  semestrielle: 'Semestrielle',
  annuelle: 'Annuelle',
};

function RegleCard({ regle, onClick }) {
  return (
    <div
      className={`regle-card ${regle.actif ? '' : 'regle-card--inactive'}`}
      onClick={() => onClick(regle.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick(regle.id)}
    >
      <div className="regle-card__header">
        <span className="regle-card__projet">{regle.projet || '—'}</span>
        <span className={`regle-card__badge regle-card__badge--${regle.actif ? 'actif' : 'inactif'}`}>
          {regle.actif ? 'Actif' : 'Inactif'}
        </span>
      </div>
      <h3 className="regle-card__nom">{regle.nom}</h3>
      {regle.description && (
        <p className="regle-card__description">{regle.description}</p>
      )}
      <div className="regle-card__footer">
        <span className="regle-card__periodicite">
          <i className="fa-regular fa-calendar"></i>{' '}
          {PERIODICITE_LABELS[regle.periodicite] ?? regle.periodicite}
        </span>
        <span className="regle-card__code">{regle.code}</span>
      </div>
    </div>
  );
}

export default function ReglesGridSection({ regles, loading, onCardClick }) {
  if (loading) {
    return (
      <div className="regles-grid-section__empty">
        <i className="fa-solid fa-spinner fa-spin regles-grid-section__empty-icon"></i>
        <p className="regles-grid-section__empty-text">Chargement…</p>
      </div>
    );
  }

  if (regles.length === 0) {
    return (
      <div className="regles-grid-section__empty">
        <i className="fa-solid fa-calculator regles-grid-section__empty-icon"></i>
        <h2 className="regles-grid-section__empty-text">Aucune règle configurée</h2>
        <p className="regles-grid-section__empty-subtext">
          Cliquez sur "Nouvelle Règle" pour définir vos premières règles de primes.
        </p>
      </div>
    );
  }

  return (
    <div className="regles-grid-section__grid">
      {regles.map((regle) => (
        <RegleCard key={regle.id} regle={regle} onClick={onCardClick} />
      ))}
    </div>
  );
}
