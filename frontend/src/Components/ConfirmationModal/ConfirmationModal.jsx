import React from 'react';
import './ConfirmationModal.css';

export default function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirmer", cancelText = "Annuler", type = "danger" }) {
  if (!isOpen) return null;

  return (
    <div className="confirmation-modal-overlay" onClick={onClose}>
      <div className="confirmation-modal-content" onClick={(e) => e.stopPropagation()}>
        
        <div className="confirmation-modal-header">
          <div className="confirmation-modal-title-wrapper">
            <i className={`fa-solid fa-triangle-exclamation confirmation-modal-icon--${type}`}></i>
            <h2>{title}</h2>
          </div>
          <button className="confirmation-modal-close" onClick={onClose} title="Fermer">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="confirmation-modal-body">
          <p className="confirmation-modal-message">{message}</p>
        </div>

        <div className="confirmation-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            {cancelText}
          </button>
          <button className={`btn btn--${type}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>

      </div>
    </div>
  );
}
