/*
 * Fichier : StatsBarSection.jsx
 * Rôle    : Barre de statistiques globales du tableau de bord (agents, éligibles, masse de primes)
 * Module  : mypaie / Pages / ReglesPrimes / SubPages / Onglets / TableauDeBordOnglet
 */

import React from 'react';
import './StatsBarSection.css';

export default function StatsBarSection({ stats }) {
  if (!stats) return null;

  const fmtDH = (v) =>
    v.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + '\u00a0DH';

  return (
    <div className="tdb-stats-bar">
      <div className="tdb-stat">
        <i className="fa-solid fa-users"></i>
        <span className="tdb-stat__value">{stats.total}</span>
        <span className="tdb-stat__label">Agents</span>
      </div>

      <div className="tdb-stat tdb-stat--success">
        <i className="fa-solid fa-circle-check"></i>
        <span className="tdb-stat__value">{stats.eligible}</span>
        <span className="tdb-stat__label">Éligibles</span>
      </div>

      <div className="tdb-stat tdb-stat--danger">
        <i className="fa-solid fa-ban"></i>
        <span className="tdb-stat__value">{stats.nonEligible}</span>
        <span className="tdb-stat__label">Non éligibles</span>
      </div>

      <div className="tdb-stat tdb-stat--accent tdb-stat--wide">
        <i className="fa-solid fa-money-bill-wave"></i>
        <span className="tdb-stat__value">{fmtDH(stats.totalMasse)}</span>
        <span className="tdb-stat__label">Masse totale des primes</span>
      </div>

      <div className="tdb-stat tdb-stat--wide">
        <i className="fa-solid fa-chart-line"></i>
        <span className="tdb-stat__value">{fmtDH(stats.avgPrime)}</span>
        <span className="tdb-stat__label">Prime moy. / éligible</span>
      </div>
    </div>
  );
}
