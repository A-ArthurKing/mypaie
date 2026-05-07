/*
 * Fichier : ToastContainer.jsx
 * Rôle    : Conteneur de notifications toast — affiche les messages
 *           succès / erreur / warning / info avec icônes et auto-disparition.
 * Dépend  : Toast.css
 * Module  : mypaie / Shared / Components
 */
import React from 'react';
import './Toast.css';

const ICONS = {
  success: 'fa-solid fa-circle-check',
  error:   'fa-solid fa-circle-xmark',
  warning: 'fa-solid fa-triangle-exclamation',
  info:    'fa-solid fa-circle-info',
};

export default function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map(({ id, message, type, exiting }) => (
        <div
          key={id}
          className={`toast-item toast-item--${type}${exiting ? ' toast-exiting' : ''}`}
          role="alert"
          aria-live="polite"
        >
          <i className={`toast-icon ${ICONS[type] || ICONS.info}`} aria-hidden="true" />
          <div className="toast-body">
            <p className="toast-message">{message}</p>
          </div>
          <button
            className="toast-close"
            onClick={() => onRemove(id)}
            aria-label="Fermer la notification"
            title="Fermer"
          >
            <i className="fa-solid fa-xmark" />
          </button>
          <span className="toast-progress" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
