/*
 * Fichier : App.jsx
 * Role    : Point d'entree de l'application mypaie — monte le layout principal.
 * Module  : mypaie / src
 */
import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import AppLayout from './Layout/AppLayout/AppLayout'
import { prefetchAll } from './Shared/Utils/prefetchAll'

function App() {
  // Préchauffage du cache LocalStorage dès le démarrage (dropdowns + stats du mois)
  useEffect(() => {
    prefetchAll()
  }, [])

  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}

export default App
