import React, { useState } from 'react';
import './LinkModal.css';

export default function LinkModal({ isOpen, onClose, onLink, type, title, options }) {
  const [selectedId, setSelectedId] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedId) {
      onLink(parseInt(selectedId));
      onClose();
    }
  };

  return (
    <div className="lm-overlay" onClick={onClose}>
      <div className="lm-modal" onClick={e => e.stopPropagation()}>
        <div className="lm-header">
          <h3>{title}</h3>
          <button onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <form onSubmit={handleSubmit} className="lm-body">
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)} required>
            <option value="">-- Sélectionner dans la bibliothèque --</option>
            {options.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.libelle}</option>
            ))}
          </select>
          <div className="lm-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-link">Lier l'élément</button>
          </div>
        </form>
      </div>
    </div>
  );
}
