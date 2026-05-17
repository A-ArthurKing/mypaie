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
        to="/parametres/structure-projets"
        className={({ isActive }) => `parametres-tab ${isActive ? 'parametres-tab--active' : ''}`}
      >
        <i className="fa-solid fa-sitemap" /> Structure & Projets
      </NavLink>
      <NavLink 
        to="/parametres/indicateurs" 
        className={({ isActive }) => `parametres-tab ${isActive ? 'parametres-tab--active' : ''}`}
      >
        <i className="fa-solid fa-chart-bar" /> Indicateurs & KPIs
      </NavLink>
      <NavLink
        to="/parametres/utilisateurs"
        className={({ isActive }) => `parametres-tab ${isActive ? 'parametres-tab--active' : ''}`}
      >
        <i className="fa-solid fa-users" /> Utilisateurs
      </NavLink>
    </nav>
  );
}
