import React from 'react';

export default function HeaderSection() {
  return (
    <div className="gs-header">
      <div className="gs-header__content">
        <div className="gs-header__icon">
          <i className="fa-solid fa-building-user"></i>
        </div>
        <div className="gs-header__text">
          <h1 className="gs-header__title">Gestion de la Structure</h1>
          <p className="gs-header__desc">
            Administrez vos projets, entités opérationnelles et flux de données pour l'ensemble de la plateforme.
          </p>
        </div>
      </div>
    </div>
  );
}
