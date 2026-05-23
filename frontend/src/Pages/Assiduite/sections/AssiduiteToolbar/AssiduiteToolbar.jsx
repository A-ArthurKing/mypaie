/*
 * Fichier : AssiduiteToolbar.jsx
 * Rôle    : Barre de contrôle — sélecteur de mois, recherche textuelle, compteur.
 * Dépend  : AssiduiteToolbar.css
 * Module  : mypaie / Pages / Assiduite / sections
 */
import React from 'react';
import './AssiduiteToolbar.css';

// Génère les 12 derniers mois + le mois courant pour le sélecteur
function buildMoisOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
}

const MOIS_OPTIONS = buildMoisOptions();

export default function AssiduiteToolbar({
  selectedMois,
  onMoisChange,
  search,
  onSearchChange,
  total,
  filtered,
}) {
  return (
    <div className="assto-toolbar">

      {/* Sélecteur de mois */}
      <div className="assto-mois">
        <i className="fa-solid fa-calendar-days assto-mois__icon" />
        <select
          className="assto-mois__select"
          value={selectedMois}
          onChange={e => onMoisChange(e.target.value)}
        >
          {MOIS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Recherche */}
      <div className="assto-search">
        <i className="fa-solid fa-magnifying-glass assto-search__icon" />
        <input
          type="text"
          placeholder="Rechercher par matricule, nom, projet…"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="assto-search__input"
        />
        {search && (
          <button
            className="assto-search__clear"
            onClick={() => onSearchChange('')}
            title="Effacer"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        )}
      </div>

      {/* Compteur filtré */}
      <div className="assto-count">
        <span className={filtered < total ? 'assto-count--filtered' : ''}>
          {filtered}
        </span>
        <span className="assto-count__sep">/</span>
        {total}
      </div>

    </div>
  );
}
