/*
 * Fichier : Sidebar.jsx
 * Rôle    : Barre de navigation latérale de l'application mypaie.
 *           Affiche le logo, les liens de navigation et le bas de page utilisateur.
 * Module  : mypaie / Layout
 */
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import './Sidebar.css'

// Définition des entrées de navigation
const NAV_ITEMS = [
  { id: 'heures',      label: 'Heures agents',  icon: 'fa-solid fa-clock',        path: '/heures'      },
  { id: 'qualite',     label: 'Notes qualité',  icon: 'fa-solid fa-star',         path: '/qualite'     },
  { id: 'performance', label: 'Performance',    icon: 'fa-solid fa-chart-line',   path: '/performance' },
  { id: 'agents',      label: 'Gestion agents', icon: 'fa-solid fa-users-gear',   path: '/agents'      },
  { id: 'structure',   label: 'Gestion structure', icon: 'fa-solid fa-building-user', path: '/structure' },
  { id: 'regles',    label: 'Règles Primes',  icon: 'fa-solid fa-calculator',   path: '/regles-primes' },
]

function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>

      {/* ── Logo / en-tête ── */}
      <div className="sidebar__header">
        <div className="sidebar__logo">
          <i className="fa-solid fa-circle-nodes sidebar__logo-icon" />
          {!collapsed && <span className="sidebar__logo-text">myPaie</span>}
        </div>
        {/* Bouton réduire / développer */}
        <button
          className="sidebar__toggle"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Développer' : 'Réduire'}
        >
          <i className={`fa-solid ${collapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`} />
        </button>
      </div>

      {/* ── Navigation principale ── */}
      <nav className="sidebar__nav">
        <ul className="sidebar__nav-list">
          {NAV_ITEMS.map(item => (
            <li key={item.id}>
              <NavLink
                to={item.path}
                className={({ isActive }) => `sidebar__nav-item${isActive ? ' sidebar__nav-item--active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <i className={`${item.icon} sidebar__nav-icon`} />
                {!collapsed && <span className="sidebar__nav-label">{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Pied de sidebar ── */}
      <div className="sidebar__footer">
        <nav className="sidebar__nav-footer">
          <NavLink
            to="/parametres"
            className={({ isActive }) => `sidebar__nav-item${isActive ? ' sidebar__nav-item--active' : ''}`}
            title={collapsed ? 'Paramètres' : undefined}
          >
            <i className="fa-solid fa-gear sidebar__nav-icon" />
            {!collapsed && <span className="sidebar__nav-label">Paramètres</span>}
          </NavLink>
        </nav>

        {!collapsed && (
          <div className="sidebar__user">
            <div className="sidebar__user-avatar">
              <i className="fa-solid fa-user" />
            </div>
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">Administrateur</span>
              <span className="sidebar__user-role">Gestionnaire Paie</span>
            </div>
          </div>
        )}
      </div>

    </aside>
  )
}

export default Sidebar
