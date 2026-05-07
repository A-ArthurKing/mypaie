/*
 * Fichier : TabsSection.jsx
 * Rôle    : Navigation par onglets de la page Paramètres
 *           (liens actifs vers les sous-pages de configuration).
 * Dépend  : TabsSection.css, react-router-dom NavLink
 * Module  : mypaie / Pages / Parametres / Sections
 */
import React from 'react';
import { NavLink } from 'react-router-dom';
import './TabsSection.css';

export default function TabsSection() {
  return (
    <nav className="parametres-tabs">
      <NavLink 
        to="/parametres/mapping-kpis" 
        className={({ isActive }) => `parametres-tab ${isActive ? 'parametres-tab--active' : ''}`}
      >
        <i className="fa-solid fa-chart-bar" /> Mapping Indicateurs (KPIs)
      </NavLink>
    </nav>
  );
}
