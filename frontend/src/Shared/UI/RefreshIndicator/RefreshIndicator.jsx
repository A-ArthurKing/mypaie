/*
 * Fichier : RefreshIndicator.jsx
 * Rôle    : Petit indicateur discret en haut à droite signalant qu'une
 *           revalidation est en cours en arrière-plan. UI non bloquée.
 * Module  : mypaie / Shared / UI
 */

import './RefreshIndicator.css'

export default function RefreshIndicator({ active = false, label = 'Mise à jour…' }) {
  if (!active) return null
  return (
    <div className="refresh-indicator" role="status" aria-live="polite">
      <i className="fa-solid fa-rotate refresh-indicator__icon" aria-hidden="true" />
      <span className="refresh-indicator__label">{label}</span>
    </div>
  )
}
