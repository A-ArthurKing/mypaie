import React from 'react';
import './AgentsHeader.css';

export default function AgentsHeader({ total, filtered, onAddClick }) {
  return (
    <div className="agh-header">
      <div className="agh-header__info">
        <h1 className="agh-header__title">Gestion des Agents</h1>
        <p className="agh-header__subtitle">
          Attribuez les niveaux (Débutant, Confirmé, Sénior) aux employés du SIRH.
        </p>
        <div className="agh-header__stats">
          <span className="agh-header__stat">
            <i className="fa-solid fa-users"></i>
            {total} agent{total > 1 ? 's' : ''}
          </span>
          {filtered < total && (
            <span className="agh-header__stat agh-header__stat--filtered">
              <i className="fa-solid fa-filter"></i>
              {filtered} affiché{filtered > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      <button className="agh-header__add-btn" onClick={onAddClick}>
        <i className="fa-solid fa-user-plus"></i>
        Ajouter un agent
      </button>
    </div>
  );
}
