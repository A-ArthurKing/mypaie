/*
 * Fichier     : AccordionSection.jsx
 * Rôle        : Wrapper accordion réutilisable pour les sections de l'onglet Variables.
 *               Affiche un en-tête cliquable (titre, icône, badge statut) et masque/révèle
 *               le contenu enfant. Le premier accordéon est ouvert par défaut.
 * Dépendances : Aucune
 * Module      : mypaie / Pages / ReglesPrimes / SubPages / Onglets / VariablesOnglet / Components
 */

import React, { useState } from 'react';
import './AccordionSection.css';

// #region COMPOSANT
export default function AccordionSection({
  icon,
  title,
  subtitle,
  statusLabel,
  statusType = 'neutral', // 'success' | 'warning' | 'neutral'
  defaultOpen = false,
  children,
}) {
  // Contrôle l'état ouvert/fermé du panneau
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`acc-section ${isOpen ? 'acc-section--open' : ''}`}>

      {/* ── En-tête cliquable ── */}
      <button
        className="acc-section__header"
        onClick={() => setIsOpen(prev => !prev)}
        aria-expanded={isOpen}
        type="button"
      >
        {/* Icône + titre + sous-titre */}
        <div className="acc-section__header-left">
          <div className="acc-section__icon-wrap">
            <i className={icon}></i>
          </div>
          <div className="acc-section__title-group">
            <span className="acc-section__title">{title}</span>
            {subtitle && <span className="acc-section__subtitle">{subtitle}</span>}
          </div>
        </div>

        {/* Badge statut + chevron */}
        <div className="acc-section__header-right">
          {statusLabel && (
            <span className={`acc-section__badge acc-section__badge--${statusType}`}>
              {statusLabel}
            </span>
          )}
          <i className={`fa-solid fa-chevron-down acc-section__chevron`}></i>
        </div>
      </button>

      {/* ── Corps dépliable ── */}
      <div className="acc-section__body">
        <div className="acc-section__body-inner">
          {children}
        </div>
      </div>

    </div>
  );
}
// #endregion
