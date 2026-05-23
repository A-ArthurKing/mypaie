/*
 * Fichier : MobileMenu.jsx
 * Rôle    : Barre de navigation inférieure pour les appareils mobiles.
 * Module  : mypaie / Layout
 */
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../Shared/Contexts/AuthContext';
import './MobileMenu.css';

// Groupement par catégories
const NAV_GROUPS = [
  {
    title: 'Mon Espace',
    items: [
      { id: 'performance', label: 'Performance', icon: 'fa-solid fa-chart-line', path: '/performance', roles: ['Super Administrateur', 'Gestionnaire Paie', 'Manager', 'Collaborateur'] },
    ]
  },
  {
    title: 'Management',
    items: [
      { id: 'heures',      label: 'Heures',      icon: 'fa-solid fa-clock',      path: '/heures', roles: ['Super Administrateur', 'Gestionnaire Paie', 'Manager'] },
      { id: 'qualite',     label: 'Qualité',     icon: 'fa-solid fa-star',       path: '/qualite', roles: ['Super Administrateur', 'Gestionnaire Paie', 'Manager'] },
    ]
  },
  {
    title: 'Administration RH',
    items: [
      { id: 'collaborateurs', label: 'Collaborateurs', icon: 'fa-solid fa-users-gear', path: '/collaborateurs', roles: ['Super Administrateur', 'Gestionnaire Paie'] },
      { id: 'assiduite',   label: 'Assiduité',   icon: 'fa-solid fa-calendar-check', path: '/assiduite', roles: ['Super Administrateur', 'Gestionnaire Paie'] },
      { id: 'regles',      label: 'Règles',      icon: 'fa-solid fa-calculator', path: '/regles-primes', roles: ['Super Administrateur', 'Gestionnaire Paie'] },
      { id: 'params',      label: 'Paramètres',  icon: 'fa-solid fa-gear',       path: '/parametres', roles: ['Super Administrateur'] }
    ]
  }
];

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  
  const userRole = user?.role || 'Collaborateur';
  
  // Flatten allowed items for the quick bar
  const allowedItems = NAV_GROUPS.flatMap(g => g.items).filter(item => item.roles.includes(userRole));
  
  // Articles affichés directement dans la barre (2 à gauche, 2 à droite)
  // On prend les 4 premiers disponibles
  const barItems = allowedItems.slice(0, 4);

  // Groupes filtrés pour le menu burger
  const filteredGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => item.roles.includes(userRole))
  })).filter(group => group.items.length > 0);

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
          {filteredGroups.map((group, gIdx) => (
            <div key={gIdx} className="mobile-drawer__group">
              <h4 className="mobile-drawer__group-title">{group.title}</h4>
              {group.items.map(item => (
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
          ))}
        </div>
      </div>
    </>
  );
}
