import React from 'react';
import './EmptyStateSection.css';

export default function EmptyStateSection() {
  return (
    <div className="agents-onglet__empty">
      <i className="fa-solid fa-users agents-onglet__empty-icon"></i>
      <h3 className="agents-onglet__empty-title">Aucun agent associé</h3>
      <p className="agents-onglet__empty-text">
        Les agents éligibles à cette règle de prime apparaîtront ici avec leurs résultats calculés.
      </p>
    </div>
  );
}
