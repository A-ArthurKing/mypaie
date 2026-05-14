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
        to="/parametres/structure"
        className={({ isActive }) => `parametres-tab ${isActive ? 'parametres-tab--active' : ''}`}
      >
        <i className="fa-solid fa-sitemap" /> Structure
      </NavLink>
      <NavLink
        to="/parametres/mapping-projets"
        className={({ isActive }) => `parametres-tab ${isActive ? 'parametres-tab--active' : ''}`}
      >
        <i className="fa-solid fa-code-merge" /> Mapping Projets
      </NavLink>
      <NavLink 
        to="/parametres/mapping-kpis" 
        className={({ isActive }) => `parametres-tab ${isActive ? 'parametres-tab--active' : ''}`}
      >
        <i className="fa-solid fa-chart-bar" /> Mapping KPIs
      </NavLink>
      <NavLink
        to="/parametres/kpi-registry"
        className={({ isActive }) => `parametres-tab ${isActive ? 'parametres-tab--active' : ''}`}
      >
        <i className="fa-solid fa-sliders" /> KPI Registry
      </NavLink>
    </nav>
  );
}
