/*
 * Fichier : Step1Statuts.jsx
 * Rôle    : Étape 1 du GrilleEditorModal - Gestion des niveaux (statuts) et primes de base.
 */
import React from 'react';
import './Step1Statuts.css';

export default function Step1Statuts({ statuts, onAdd, onRemove, onUpdate }) {
  return (
    <div className="gem-step">
      <p className="gem-step-desc">Définissez les niveaux (ex: Standard, Confirmé) et leurs montants cibles (Prime de base).</p>
      <div className="gem-statuts-list">
        {statuts.map((s, i) => (
          <div key={i} className="gem-row gem-row--statut">
            <div className="gem-input-group">
              <label>
                <i className="fa-solid fa-layer-group"></i> Libellé Niveau
              </label>
              <input 
                placeholder="Ex: Senior" 
                value={s.nom} 
                onChange={(e) => onUpdate(i, 'nom', e.target.value)} 
              />
            </div>
            <div className="gem-input-group" style={{ flex: '0 0 140px' }}>
              <label>
                <i className="fa-solid fa-money-bill-wave"></i> Prime Base
              </label>
              <input 
                type="number"
                placeholder="Ex: 1200" 
                value={s.prime_brute} 
                onChange={(e) => onUpdate(i, 'prime_brute', e.target.value)} 
              />
            </div>
            <div className="gem-input-group" style={{ flex: '0 0 140px' }}>
              <label>
                <i className="fa-solid fa-star"></i> Super Bonus
              </label>
              <input 
                type="number"
                placeholder="Ex: 500" 
                value={s.montant_sb} 
                onChange={(e) => onUpdate(i, 'montant_sb', e.target.value)} 
              />
            </div>
            <button className="gem-btn-icon danger gem-mt-label" onClick={() => onRemove(i)}>
              <i className="fa-solid fa-trash"></i>
            </button>
          </div>
        ))}
      </div>
      <button className="btn gem-btn-outline" onClick={onAdd}>+ Ajouter un niveau</button>
    </div>
  );
}
