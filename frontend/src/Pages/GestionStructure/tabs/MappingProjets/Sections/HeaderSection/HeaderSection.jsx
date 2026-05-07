import React from 'react';

export default function HeaderSection() {
  return (
    <div className="mp-header">
      <div className="mp-header__content">
        <div className="mp-header__icon">
          <i className="fa-solid fa-code-merge"></i>
        </div>
        <div className="mp-header__text">
          <h2 className="mp-header__title">Mapping des Projets</h2>
          <p className="mp-header__desc">
            Associez les noms bruts issus de BigQuery (ex: "PV_SE", "PVSE") à un nom standard unifié (ex: "PV SE").
            Cela permet de consolider les données dans le module de Performance.
          </p>
        </div>
      </div>
    </div>
  );
}
