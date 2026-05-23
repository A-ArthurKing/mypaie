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

// Groupement par catégories
const NAV_GROUPS = [
  {
    title: 'Mon Espace',
    items: [
      { id: 'performance', label: 'Performance',    icon: 'fa-solid fa-chart-line',   path: '/performance', roles: ['Super Administrateur', 'Gestionnaire Paie', 'Manager', 'Collaborateur'] },
    ]
  },
  {
    title: 'Management',
    items: [
      { id: 'heures',      label: 'Heures agents',  icon: 'fa-solid fa-clock',        path: '/heures', roles: ['Super Administrateur', 'Gestionnaire Paie', 'Manager'] },
      { id: 'qualite',     label: 'Notes qualité',  icon: 'fa-solid fa-star',         path: '/qualite', roles: ['Super Administrateur', 'Gestionnaire Paie', 'Manager'] },
    ]
  },
  {
    title: 'Administration RH',
    items: [
      { id: 'collaborateurs', label: 'Collaborateurs', icon: 'fa-solid fa-users-gear',   path: '/collaborateurs', roles: ['Super Administrateur', 'Gestionnaire Paie'] },
      { id: 'assiduite',      label: 'Assiduité',        icon: 'fa-solid fa-calendar-check', path: '/assiduite',      roles: ['Super Administrateur', 'Gestionnaire Paie'] },
      { id: 'regles',    label: 'Règles Primes',  icon: 'fa-solid fa-calculator',   path: '/regles-primes', roles: ['Super Administrateur', 'Gestionnaire Paie'] },
      { id: 'parametres', label: 'Paramètres',    icon: 'fa-solid fa-gear',         path: '/parametres', roles: ['Super Administrateur'] }
    ]
  }
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
  
  const filteredGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => item.roles.includes(userRole))
  })).filter(group => group.items.length > 0)

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
        {filteredGroups.map((group, gIdx) => (
          <div key={gIdx} className="sidebar__group">
            {!collapsed && <h4 className="sidebar__group-title">{group.title}</h4>}
            {collapsed && <div className="sidebar__group-divider" title={group.title}></div>}
            
            <ul className="sidebar__nav-list">
              {group.items.map(item => (
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
          </div>
        ))}
      </nav>

      {/* ── Pied de sidebar ── */}
      <div className="sidebar__footer">
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
