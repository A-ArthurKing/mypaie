import React from 'react';

export default function HeaderSection() {
  return (
    <div className="mk-header">
      <div className="mk-header__content">
        <div className="mk-header__icon">
          <i className="fa-solid fa-link"></i>
        </div>
        <div className="mk-header__text">
          <h2 className="mk-header__title">Mapping des Indicateurs (KPIs)</h2>
          <p className="mk-header__desc">
            Associez les noms bruts des indicateurs issus des sources de données (BigQuery, MySQL) 
            vers un nom standard unifié (ex: "DMT"). Ce nom standard sera utilisé dans les grilles de primes.
          </p>
        </div>
      </div>
    </div>
  );
}
