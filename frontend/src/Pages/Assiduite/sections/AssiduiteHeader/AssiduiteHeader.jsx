/*
 * Fichier : AssiduiteHeader.jsx
 * Rôle    : En-tête de la page Assiduité — titre, sous-titre et compteur global.
 * Dépend  : AssiduiteHeader.css
 * Module  : mypaie / Pages / Assiduite / sections
 */
import React from 'react';
import './AssiduiteHeader.css';

// Formate un mois YYYY-MM en label lisible (ex: "mai 2026")
function formatMoisLabel(mois) {
  if (!mois) return '';
  const [year, month] = mois.split('-').map(Number);
  return new Date(year, month - 1, 1)
    .toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
}

export default function AssiduiteHeader({ total, mois }) {
  return (
    <header className="assid-header">
      <div className="assid-header__left">
        <div className="assid-header__icon-wrap">
          <i className="fa-solid fa-calendar-check assid-header__icon" />
        </div>
        <div>
          <h1 className="assid-header__title">Assiduité</h1>
          <p className="assid-header__subtitle">
            Suivi mensuel des absences et congés — {formatMoisLabel(mois)}
          </p>
        </div>
      </div>
      <div className="assid-header__badge">
        <i className="fa-solid fa-users" />
        <span>{total} collaborateur{total !== 1 ? 's' : ''}</span>
      </div>
    </header>
  );
}
