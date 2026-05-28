/*
 * Fichier : SaveVersionModal.jsx
 * Rôle    : Modal de sauvegarde d'une version de configuration d'objectifs
 *           avec libellé personnalisé et pré-remplissage dynamique.
 * Dépend  : SaveVersionModal.css
 * Module  : mypaie / Pages / ReglesPrimes / SubPages / RegleDetail / ObjectifsOnglet
 */
import React, { useState, useEffect } from 'react';
import './SaveVersionModal.css';

export default function SaveVersionModal({ isOpen, onClose, onConfirm, initialValue, isNewGrille }) {
  const [libelle, setLibelle] = useState(initialValue || '');
  const [grilleNom, setGrilleNom] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLibelle(initialValue || `Version du ${new Date().toLocaleDateString()}`);
      if (isNewGrille) setGrilleNom('');
    }
  }, [isOpen, initialValue, isNewGrille]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (libelle.trim() && (!isNewGrille || grilleNom.trim())) {
      onConfirm(libelle, isNewGrille ? grilleNom : null);
      onClose();
    }
  };

  return (
    <div className="save-version-modal-overlay" onClick={onClose}>
      <div className="save-version-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="save-version-modal-header">
          <div className="save-version-modal-title-wrapper">
            <i className="fa-solid fa-file-signature save-version-modal-icon"></i>
            <h2>{isNewGrille ? 'Créer une nouvelle grille' : 'Enregistrer une version'}</h2>
          </div>
          <button className="save-version-modal-close" onClick={onClose} title="Fermer">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="save-version-modal-body">
            {isNewGrille && (
              <div className="save-version-modal-input-group" style={{ marginBottom: '20px' }}>
                <label htmlFor="grille-name">Nom de la nouvelle Grille</label>
                <input
                  id="grille-name"
                  type="text"
                  placeholder="ex: Grille Standard PVCP"
                  value={grilleNom}
                  onChange={(e) => setGrilleNom(e.target.value)}
                  className="save-version-modal-input"
                  required
                />
              </div>
            )}
            
            <div className="save-version-modal-input-group">
              <label htmlFor="version-name">Nom de cette version</label>
              <input
                id="version-name"
                type="text"
                placeholder="ex: V1 - Initialisation"
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                className="save-version-modal-input"
                required
              />
            </div>
          </div>

          <div className="save-version-modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              <i className="fa-solid fa-xmark"></i> Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={!libelle.trim() || (isNewGrille && !grilleNom.trim())}>
              <i className={`fa-solid ${isNewGrille ? 'fa-plus' : 'fa-floppy-disk'}`}></i>
              {isNewGrille ? 'Créer la grille' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
