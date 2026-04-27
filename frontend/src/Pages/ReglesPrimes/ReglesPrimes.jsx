/*
 * Fichier : ReglesPrimes.jsx
 * Rôle    : Page principale du générateur de règles de primes
 * Module  : mypaie / Pages / ReglesPrimes
 */

import React from 'react';
import './ReglesPrimes.css';

export default function ReglesPrimes() {
  return (
    <div className="regles-primes">
      <header className="regles-primes__header">
        <div>
          <h1 className="regles-primes__title">Générateur de Règles</h1>
          <p className="regles-primes__subtitle">
            Configurez les règles de calcul des primes (KPIs, paliers, statuts)
          </p>
        </div>
        <div className="regles-primes__actions">
          <button className="btn-create-regle">
            <i className="fa-solid fa-plus"></i> Nouvelle Règle
          </button>
        </div>
      </header>

      {/* État vide temporaire avant implémentation de la grille */}
      <div className="regles-primes__empty">
        <i className="fa-solid fa-calculator regles-primes__empty-icon"></i>
        <h2 className="regles-primes__empty-text">Aucune règle configurée</h2>
        <p className="regles-primes__empty-subtext">
          Cliquez sur "Nouvelle Règle" pour définir vos premières règles de primes.
        </p>
      </div>
    </div>
  );
}
