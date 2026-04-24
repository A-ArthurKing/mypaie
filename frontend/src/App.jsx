/*
 * Fichier : App.jsx
 * Role    : Point d'entree de l'application mypaie — monte le layout principal.
 * Module  : mypaie / src
 */
import { BrowserRouter } from 'react-router-dom'
import AppLayout from './Layout/AppLayout/AppLayout'

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}

export default App
