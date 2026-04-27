import React, { useState } from 'react';
import './CreateRegleModal.css';

export default function CreateRegleModal({ onClose, onCreated }) {
  const [formData, setFormData] = useState({
    nom: '',
    projet: '',
    periodicite: 'mensuelle',
    description: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/regles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la sauvegarde');
      }

      const data = await response.json();
      console.log('Règle sauvegardée avec succès:', data);
      if (onCreated) onCreated();
      else onClose();
    } catch (err) {
      console.error('Erreur API:', err);
      alert('Impossible de sauvegarder la règle pour le moment.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Créer une nouvelle règle</h2>
          <button className="modal-close" onClick={onClose} title="Fermer">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="nom">Nom de la règle *</label>
            <input 
              type="text" 
              id="nom" 
              name="nom" 
              required 
              placeholder="Ex: Prime de productivité" 
              value={formData.nom}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="projet">Projet cible</label>
            <input 
              type="text" 
              id="projet" 
              name="projet" 
              placeholder="Ex: PVCP" 
              value={formData.projet}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="periodicite">Périodicité</label>
            <select id="periodicite" name="periodicite" value={formData.periodicite} onChange={handleChange}>
              <option value="mensuelle">Mensuelle</option>
              <option value="trimestrielle">Trimestrielle</option>
              <option value="annuelle">Annuelle</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea 
              id="description" 
              name="description" 
              rows="3" 
              placeholder="Description et objectifs de la règle..."
              value={formData.description}
              onChange={handleChange}
            ></textarea>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-submit">Créer la règle</button>
          </div>
        </form>
      </div>
    </div>
  );
}
