/*
 * Fichier : main.jsx
 * Rôle    : Point d'entrée React — monte l'arbre de composants dans le DOM
 *           et enveloppe l'app des providers globaux (Socket, Toast).
 * Dépend  : App, SocketProvider, ToastProvider
 * Module  : mypaie / root
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './root.css'
import './index.css'
import App from './App.jsx'
import { SocketProvider } from './Shared/Contexts/SocketContext'
import { ToastProvider } from './Shared/Contexts/ToastContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SocketProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </SocketProvider>
  </StrictMode>,
)
