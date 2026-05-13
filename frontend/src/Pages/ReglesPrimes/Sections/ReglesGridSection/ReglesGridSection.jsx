/*
 * Fichier : ReglesGridSection.jsx
 * Rôle    : Grille des cartes règles de primes — états loading, vide et liste.
 * Module  : mypaie / Pages / ReglesPrimes / Sections
 */

import React from 'react';
import './ReglesGridSection.css';

const PERIODICITE_LABELS = {
  mensuelle: 'Mensuelle',
  trimestrielle: 'Trimestrielle',
  semestrielle: 'Semestrielle',
  annuelle: 'Annuelle',
};

function RegleCard({ regle, onClick, onEdit, onDelete, onDuplicate }) {
  const structureTags = [
    regle.libelle_projet    && { key: 'projet',    label: regle.libelle_projet,    icon: 'fa-folder' },
    regle.libelle_operation && { key: 'operation', label: regle.libelle_operation, icon: 'fa-network-wired' },
    regle.libelle_file      && { key: 'file',      label: regle.libelle_file,      icon: 'fa-layer-group' },
    regle.libelle_activite  && { key: 'activite',  label: regle.libelle_activite,  icon: 'fa-tag' },
  ].filter(Boolean);

  return (
    <div
      className={`regle-card${regle.actif ? '' : ' regle-card--inactive'}`}
      onClick={() => onClick(regle.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick(regle.id)}
    >
      {/* Boutons d'action */}
      <div className="regle-card__actions" onClick={e => e.stopPropagation()}>
        <button
          className="regle-card__action-btn regle-card__action-btn--duplicate"
          title="Dupliquer"
          onClick={(e) => { e.stopPropagation(); onDuplicate(regle.id); }}
        >
          <i className="fa-solid fa-copy"></i>
        </button>
        <button
          className="regle-card__action-btn regle-card__action-btn--edit"
          title="Modifier"
          onClick={(e) => { e.stopPropagation(); onEdit(regle.id); }}
        >
          <i className="fa-solid fa-pencil"></i>
        </button>
        <button
          className="regle-card__action-btn regle-card__action-btn--delete"
          title="Supprimer"
          onClick={(e) => { e.stopPropagation(); onDelete(regle); }}
        >
          <i className="fa-solid fa-trash"></i>
        </button>
      </div>

      {/* Titre + badge sur la même ligne */}
      <div className="regle-card__title-row">
        <h3 className="regle-card__nom">{regle.nom}</h3>
        <span className={`regle-card__badge regle-card__badge--${regle.actif ? 'actif' : 'inactif'}`}>
          {regle.actif ? 'Actif' : 'Inactif'}
        </span>
      </div>

      {structureTags.length > 0 && (
        <div className="regle-card__structure-tags">
          {structureTags.map(tag => (
            <span key={tag.key} className={`regle-card__tag regle-card__tag--${tag.key}`}>
              <i className={`fa-solid ${tag.icon}`}></i>
              {tag.label}
            </span>
          ))}
        </div>
      )}

      {regle.description && (
        <p className="regle-card__description">{regle.description}</p>
      )}

      <div className="regle-card__footer">
        <span className="regle-card__periodicite">
          <i className="fa-regular fa-calendar"></i>
          {PERIODICITE_LABELS[regle.periodicite] ?? regle.periodicite}
        </span>
        <span className="regle-card__code">{regle.code}</span>
      </div>
    </div>
  );
}

export default function ReglesGridSection({ regles, loading, onCardClick, onEdit, onDelete, onDuplicate }) {
  if (loading) {
    return (
      <div className="regles-grid-section__empty">
        <i className="fa-solid fa-spinner fa-spin regles-grid-section__empty-icon"></i>
        <p className="regles-grid-section__empty-text">Chargement…</p>
      </div>
    );
  }

  if (!regles || regles.length === 0) {
    return (
      <div className="regles-grid-section__empty">
        <i className="fa-solid fa-calculator regles-grid-section__empty-icon"></i>
        <h2 className="regles-grid-section__empty-text">Aucune règle configurée</h2>
        <p className="regles-grid-section__empty-subtext">
          Cliquez sur "Nouvelle Règle" pour définir vos premières règles de primes.
        </p>
      </div>
    );
  }

  return (
    <div className="regles-grid-section__grid">
      {regles.map((regle) => (
        <RegleCard 
          key={regle.id} 
          regle={regle} 
          onClick={onCardClick} 
          onEdit={onEdit} 
          onDelete={onDelete} 
          onDuplicate={onDuplicate}
        />
      ))}
    </div>
  );
}
