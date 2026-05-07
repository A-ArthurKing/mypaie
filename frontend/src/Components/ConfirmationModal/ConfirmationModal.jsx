import React from 'react';
import './ConfirmationModal.css';

export default function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirmer", cancelText = "Annuler", type = "danger" }) {
  if (!isOpen) return null;

  return (
    <div className="cm-overlay" onClick={onClose}>
      <div className="cm-content" onClick={(e) => e.stopPropagation()}>
        
        <div className="cm-header">
          <div className="cm-title-wrapper">
            <i className={`fa-solid fa-triangle-exclamation cm-icon--${type}`}></i>
            <h2>{title}</h2>
          </div>
          <button className="cm-btn-close" onClick={onClose} title="Fermer">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="cm-body">
          <p className="cm-message">{message}</p>
        </div>

        <div className="cm-footer">
          <button className="cm-btn cm-btn-secondary" onClick={onClose}>
            {cancelText}
          </button>
          <button className={`cm-btn cm-btn--${type}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>

      </div>
    </div>
  );
}
