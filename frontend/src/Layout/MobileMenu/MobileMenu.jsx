/*
 * Fichier : MobileMenu.jsx
 * Rôle    : Barre de navigation inférieure pour les appareils mobiles.
 * Module  : mypaie / Layout
 */
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './MobileMenu.css';

const NAV_ITEMS = [
  { id: 'heures',      label: 'Heures',      icon: 'fa-solid fa-clock',        path: '/heures'      },
  { id: 'qualite',     label: 'Qualité',     icon: 'fa-solid fa-star',         path: '/qualite'     },
  { id: 'performance', label: 'Performance', icon: 'fa-solid fa-chart-line',   path: '/performance' },
  { id: 'agents',      label: 'Agents',      icon: 'fa-solid fa-users-gear',   path: '/agents'      },
  { id: 'structure',   label: 'Structure',   icon: 'fa-solid fa-building-user', path: '/structure'  },
  { id: 'regles',      label: 'Règles',      icon: 'fa-solid fa-calculator',   path: '/regles-primes' },
  { id: 'params',      label: 'Paramètres',  icon: 'fa-solid fa-gear',         path: '/parametres'    },
];

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  // Articles affichés directement dans la barre (2 à gauche, 2 à droite)
  const barItems = [NAV_ITEMS[0], NAV_ITEMS[1], NAV_ITEMS[3], NAV_ITEMS[4]];

  return (
    <>
      <nav className="mobile-menu">
        <ul className="mobile-menu__list">
          {/* 2 premiers items */}
          {barItems.slice(0, 2).map(item => (
            <li key={item.id} className="mobile-menu__item">
              <NavLink to={item.path} className={({ isActive }) => `mobile-menu__link ${isActive ? 'active' : ''}`}>
                <i className={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}

          {/* Bouton Central Menu */}
          <li className="mobile-menu__item mobile-menu__item--center">
            <button className={`mobile-menu__center-btn ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(!isOpen)}>
              <i className="fa-solid fa-bars" />
            </button>
          </li>

          {/* 2 derniers items */}
          {barItems.slice(2, 4).map(item => (
            <li key={item.id} className="mobile-menu__item">
              <NavLink to={item.path} className={({ isActive }) => `mobile-menu__link ${isActive ? 'active' : ''}`}>
                <i className={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Overlay & Panel */}
      <div className={`mobile-drawer-overlay ${isOpen ? 'show' : ''}`} onClick={() => setIsOpen(false)} />
      <div className={`mobile-drawer ${isOpen ? 'show' : ''}`}>
        <div className="mobile-drawer__header">
          <div className="mobile-drawer__handle" />
          <h3>Menu Principal</h3>
        </div>
        <div className="mobile-drawer__content">
          {NAV_ITEMS.map(item => (
            <NavLink 
              key={item.id} 
              to={item.path} 
              className="mobile-drawer__item"
              onClick={() => setIsOpen(false)}
            >
              <i className={`${item.icon} mobile-drawer__icon`} />
              <span className="mobile-drawer__label">{item.label}</span>
              <i className="fa-solid fa-chevron-right mobile-drawer__arrow" />
            </NavLink>
          ))}
        </div>
      </div>
    </>
  );
}
