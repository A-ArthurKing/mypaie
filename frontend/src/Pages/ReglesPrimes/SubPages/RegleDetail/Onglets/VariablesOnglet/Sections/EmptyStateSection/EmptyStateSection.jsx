import React from 'react';
import './EmptyStateSection.css';

export default function EmptyStateSection() {
  return (
    <div className="variables-onglet__empty">
      <i className="fa-solid fa-sliders variables-onglet__empty-icon"></i>
      <h3 className="variables-onglet__empty-title">Aucun critère configuré</h3>
      <p className="variables-onglet__empty-text">
        Les param�tres et indicateurs de calcul de cette règle seront définis ici.
      </p>
    </div>
  );
}
