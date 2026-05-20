/*
 * Fichier : AppLayout.jsx
 * RÃ´le    : Conteneur principal de l'application â€” assemble la Sidebar
 *           et la zone de contenu (MainContainer) qui charge les pages.
 * Module  : mypaie / Layout
 */
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../../Shared/Contexts/AuthContext'
import Sidebar from '../Sidebar/Sidebar'
import MobileMenu from '../MobileMenu/MobileMenu'
import HeuresAgents from '../../Pages/HeuresAgents/HeuresAgents'
import NotesQualite from '../../Pages/NotesQualite/NotesQualite'
import Performance from '../../Pages/Performance/Performance'
import Collaborateurs from '../../Pages/GestionCollaborateurs/GestionCollaborateurs'
import ReglesPrimes from '../../Pages/ReglesPrimes/ReglesPrimes'
import Parametres from '../../Pages/Parametres/Parametres'
import './AppLayout.css'

// Composant pour protéger les routes selon le rôle
const RoleRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  const userRole = user?.role || 'Collaborateur';
  
  if (!allowedRoles.includes(userRole)) {
    return <Navigate to="/performance" replace />;
  }
  return children;
};

function AppLayout() {
  return (
    <div className="app-layout">

      {/* ── Barre latérale ── */}
      <Sidebar />
      <MobileMenu />

      {/* ── Zone de contenu principale ── */}
      <main className="app-layout__main">
        <Routes>
          <Route path="/heures/*" element={
            <RoleRoute allowedRoles={['Super Administrateur', 'Gestionnaire Paie', 'Manager']}>
              <HeuresAgents />
            </RoleRoute>
          } />
          <Route path="/qualite/*" element={
            <RoleRoute allowedRoles={['Super Administrateur', 'Gestionnaire Paie', 'Manager']}>
              <NotesQualite />
            </RoleRoute>
          } />
          <Route path="/performance/*" element={
            <RoleRoute allowedRoles={['Super Administrateur', 'Gestionnaire Paie', 'Manager', 'Collaborateur']}>
              <Performance />
            </RoleRoute>
          } />
          <Route path="/collaborateurs/*" element={
            <RoleRoute allowedRoles={['Super Administrateur', 'Gestionnaire Paie', 'Manager']}>
              <Collaborateurs />
            </RoleRoute>
          } />
          <Route path="/regles-primes/*" element={
            <RoleRoute allowedRoles={['Super Administrateur', 'Gestionnaire Paie']}>
              <ReglesPrimes />
            </RoleRoute>
          } />
          <Route path="/parametres/*" element={
            <RoleRoute allowedRoles={['Super Administrateur']}>
              <Parametres />
            </RoleRoute>
          } />
          {/* Redirection par défaut */}
          <Route path="*" element={<Navigate to="/performance" replace />} />
        </Routes>
      </main>

    </div>
  )
}

export default AppLayout
