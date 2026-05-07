/*
 * Fichier : DescriptionSection.jsx
 * Rôle    : Affiche la description textuelle d'une règle de prime
 *           dans l'onglet Objectifs (masqué si vide).
 * Dépend  : DescriptionSection.css
 * Module  : mypaie / Pages / ReglesPrimes / SubPages / RegleDetail / ObjectifsOnglet
 */
import React from 'react';
import './DescriptionSection.css';

export default function DescriptionSection({ description }) {
  if (description) {
    return (
      <div className="objectifs-onglet__description">
        <h3 className="objectifs-onglet__description-title">
          <i className="fa-regular fa-file-lines"></i> Description
        </h3>
        <p className="objectifs-onglet__description-text">{description}</p>
      </div>
    );
  }

  return (
    <div className="objectifs-onglet__description objectifs-onglet__description--empty">
      <i className="fa-regular fa-file-lines"></i>
      <span>Aucune description renseignée.</span>
    </div>
  );
}
