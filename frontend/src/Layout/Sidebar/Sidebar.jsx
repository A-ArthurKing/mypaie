/*
 * Fichier : Sidebar.jsx
 * Rôle    : Barre de navigation latérale de l'application mypaie.
 *           Affiche le logo, les liens de navigation et le bas de page utilisateur.
 * Module  : mypaie / Layout
 */
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../Shared/Contexts/AuthContext'
import ConfirmationModal from '../../Components/ConfirmationModal/ConfirmationModal'
import './Sidebar.css'

// Définition des entrées de navigation avec rôles autorisés
const NAV_ITEMS = [
  { id: 'heures',      label: 'Heures agents',  icon: 'fa-solid fa-clock',        path: '/heures', roles: ['Super Administrateur', 'Gestionnaire Paie', 'Manager'] },
  { id: 'qualite',     label: 'Notes qualité',  icon: 'fa-solid fa-star',         path: '/qualite', roles: ['Super Administrateur', 'Gestionnaire Paie', 'Manager'] },
  { id: 'performance', label: 'Performance',    icon: 'fa-solid fa-chart-line',   path: '/performance', roles: ['Super Administrateur', 'Gestionnaire Paie', 'Manager', 'Collaborateur'] },
  { id: 'collaborateurs', label: 'Collaborateurs', icon: 'fa-solid fa-users-gear',   path: '/collaborateurs', roles: ['Super Administrateur', 'Gestionnaire Paie', 'Manager'] },
  { id: 'regles',    label: 'Règles Primes',  icon: 'fa-solid fa-calculator',   path: '/regles-primes', roles: ['Super Administrateur', 'Gestionnaire Paie'] },
]

function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogoutClick = () => {
    setIsLogoutModalOpen(true)
  }

  const confirmLogout = () => {
    setIsLogoutModalOpen(false)
    logout()
    navigate('/login')
  }

  // Filtrer la navigation selon le rôle de l'utilisateur
  const userRole = user?.role || 'Collaborateur'
  const filteredNavItems = NAV_ITEMS.filter(item => item.roles.includes(userRole))

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
          {filteredNavItems.map(item => (
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
          {userRole === 'Super Administrateur' && (
            <NavLink
              to="/parametres"
              className={({ isActive }) => `sidebar__nav-item${isActive ? ' sidebar__nav-item--active' : ''}`}
              title={collapsed ? 'Paramètres' : undefined}
            >
              <i className="fa-solid fa-gear sidebar__nav-icon" />
              {!collapsed && <span className="sidebar__nav-label">Paramètres</span>}
            </NavLink>
          )}
        </nav>

        {!collapsed && (
          <div className="sidebar__user">
            <div className="sidebar__user-avatar">
              <i className="fa-solid fa-user" />
            </div>
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">{user?.prenom} {user?.nom}</span>
              <span className="sidebar__user-role">{user?.role}</span>
            </div>
            <button className="sidebar__logout-btn" onClick={handleLogoutClick} title="Se déconnecter">
              <i className="fa-solid fa-right-from-bracket"></i>
            </button>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={confirmLogout}
        title="Déconnexion"
        message="Êtes-vous sûr de vouloir vous déconnecter de votre session ?"
        confirmText="Me déconnecter"
        cancelText="Annuler"
        type="warning"
      />
    </aside>
  )
}

export default Sidebar
