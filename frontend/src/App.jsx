/*
 * Fichier : App.jsx
 * Role    : Point d'entree de l'application mypaie — monte le layout principal.
 * Module  : mypaie / src
 */
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './Layout/AppLayout/AppLayout'
import LoginPage from './Pages/Login/LoginPage'
import { AuthProvider, useAuth } from './Shared/Contexts/AuthContext'
import { prefetchAll } from './Shared/Utils/prefetchAll'

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  // Préchauffage du cache LocalStorage dès le démarrage (dropdowns + stats du mois)
  useEffect(() => {
    prefetchAll()
  }, [])

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
