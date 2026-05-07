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
