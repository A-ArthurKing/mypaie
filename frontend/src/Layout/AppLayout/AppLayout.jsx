/*
 * Fichier : AppLayout.jsx
 * Rôle    : Conteneur principal de l'application — assemble la Sidebar
 *           et la zone de contenu (MainContainer) qui charge les pages.
 * Module  : mypaie / Layout
 */
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from '../Sidebar/Sidebar'
import HeuresAgents from '../../Pages/HeuresAgents/HeuresAgents'
import NotesQualite from '../../Pages/NotesQualite/NotesQualite'
import './AppLayout.css'

function AppLayout() {
  return (
    <div className="app-layout">

      {/* ── Barre latérale ── */}
      <Sidebar />

      {/* ── Zone de contenu principale ── */}
      <main className="app-layout__main">
        <Routes>
          <Route path="/heures/*" element={<HeuresAgents />} />
          <Route path="/qualite/*" element={<NotesQualite />} />
          {/* Redirection par défaut vers les heures */}
          <Route path="*" element={<Navigate to="/heures" replace />} />
        </Routes>
      </main>

    </div>
  )
}

export default AppLayout
