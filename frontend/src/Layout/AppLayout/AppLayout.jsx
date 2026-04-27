/*
 * Fichier : AppLayout.jsx
 * RÃ´le    : Conteneur principal de l'application â€” assemble la Sidebar
 *           et la zone de contenu (MainContainer) qui charge les pages.
 * Module  : mypaie / Layout
 */
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from '../Sidebar/Sidebar'
import HeuresAgents from '../../Pages/HeuresAgents/HeuresAgents'
import NotesQualite from '../../Pages/NotesQualite/NotesQualite'
import Performance from '../../Pages/Performance/Performance'
import ReglesPrimes from '../../Pages/ReglesPrimes/ReglesPrimes'
import Parametres from '../../Pages/Parametres/Parametres'
import './AppLayout.css'

function AppLayout() {
  return (
    <div className="app-layout">

      {/* â”€â”€ Barre latÃ©rale â”€â”€ */}
      <Sidebar />

      {/* â”€â”€ Zone de contenu principale â”€â”€ */}
      <main className="app-layout__main">
        <Routes>
          <Route path="/heures/*" element={<HeuresAgents />} />
          <Route path="/qualite/*" element={<NotesQualite />} />
          <Route path="/performance/*" element={<Performance />} />
          <Route path="/regles-primes/*" element={<ReglesPrimes />} />
          <Route path="/parametres/*" element={<Parametres />} />
          {/* Redirection par dÃ©faut vers les heures */}
          <Route path="*" element={<Navigate to="/heures" replace />} />
        </Routes>
      </main>

    </div>
  )
}

export default AppLayout
