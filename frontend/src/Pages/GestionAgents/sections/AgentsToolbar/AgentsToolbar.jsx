/*
 * Fichier : AgentsToolbar.jsx
 * Rôle    : Barre de filtres de la liste des agents — filtre par projet,
 *           BU, niveau et recherche textuelle libre.
 * Dépend  : AgentsToolbar.css
 * Module  : mypaie / Pages / GestionAgents / sections
 */
import React from 'react';
import './AgentsToolbar.css';

function FilterSelect({ icon, label, value, onChange, options, placeholder = 'Tous' }) {
  return (
    <div className="agtb-filter">
      <i className={`fa-solid ${icon} agtb-filter__icon`}></i>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`agtb-filter__select${value ? ' agtb-filter__select--active' : ''}`}
        title={label}
      >
        <option value="">{placeholder}</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {value && (
        <button className="agtb-filter__clear" onClick={() => onChange('')} title={`Retirer filtre ${label}`}>
          <i className="fa-solid fa-xmark"></i>
        </button>
      )}
    </div>
  );
}

export default function AgentsToolbar({
  search, onSearchChange,
  projetFilter, onProjetFilterChange, projets,
  operationFilter, onOperationFilterChange, operations,
  sous_projetFilter, onSous_projetFilterChange, sous_projets,
  activiteFilter, onActiviteFilterChange, activites,
  statutFilter, onStatutFilterChange, statutRefs,
  total, filtered,
}) {
  const hasActiveFilters = projetFilter || operationFilter || sous_projetFilter || activiteFilter || statutFilter;

  const clearAll = () => {
    onProjetFilterChange('');
    onOperationFilterChange('');
    onSous_projetFilterChange('');
    onActiviteFilterChange('');
    onStatutFilterChange('');
  };

  return (
    <div className="agtb-toolbar">
      {/* Ligne 1 : Recherche */}
      <div className="agtb-toolbar__row agtb-toolbar__row--search">
        <div className="agtb-toolbar__search-wrapper">
          <i className="fa-solid fa-magnifying-glass agtb-toolbar__search-icon"></i>
          <input
            type="text"
            placeholder="Rechercher par matricule, nom, projet, opération..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="agtb-toolbar__search"
          />
          {search && (
            <button className="agtb-toolbar__clear-btn" onClick={() => onSearchChange('')}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>
        <div className="agtb-toolbar__count">
          <span className={filtered < total ? 'agtb-count--filtered' : ''}>{filtered}</span>
          <span className="agtb-count__sep">/</span>
          {total}
        </div>
      </div>

      {/* Ligne 2 : Filtres */}
      <div className="agtb-toolbar__row agtb-toolbar__row--filters">
        <div className="agtb-toolbar__filters-label">
          <i className="fa-solid fa-filter"></i>
          Filtres :
        </div>

        <FilterSelect
          icon="fa-folder-open"
          label="Projet"
          value={projetFilter}
          onChange={onProjetFilterChange}
          options={projets}
          placeholder="Tous les projets"
        />
        <FilterSelect
          icon="fa-gears"
          label="Opération"
          value={operationFilter}
          onChange={onOperationFilterChange}
          options={operations}
          placeholder="Toutes les opérations"
        />
        <FilterSelect
          icon="fa-file-lines"
          label="Sous-projet"
          value={sous_projetFilter}
          onChange={onSous_projetFilterChange}
          options={sous_projets}
          placeholder="Tous les sous-projets"
        />
        <FilterSelect
          icon="fa-tag"
          label="Activité"
          value={activiteFilter}
          onChange={onActiviteFilterChange}
          options={activites}
          placeholder="Toutes les activités"
        />
        <FilterSelect
          icon="fa-layer-group"
          label="Niveau"
          value={statutFilter}
          onChange={onStatutFilterChange}
          options={(statutRefs || []).map(s => s.libelle)}
          placeholder="Tous les niveaux"
        />

        {hasActiveFilters && (
          <button className="agtb-toolbar__reset-btn" onClick={clearAll}>
            <i className="fa-solid fa-rotate-left"></i>
            Réinitialiser
          </button>
        )}
      </div>
    </div>
  );
}
