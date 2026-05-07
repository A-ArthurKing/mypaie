/*
 * Fichier : WeightingSection.jsx
 * Rôle    : Configuration des pondérations des indicateurs d'une règle
 *           (poids relatif et type bonus/malus par KPI).
 * Dépend  : WeightingSection.css, /api/regles/:id/weighting
 * Module  : mypaie / Pages / ReglesPrimes / SubPages / RegleDetail / VariablesOnglet
 */
import React, { useState, useEffect } from 'react';
import './WeightingSection.css';

export default function WeightingSection({ regle, onSave }) {
  const [weightConfigs, setWeightConfigs] = useState({}); // { id: { poids: 0, type: 'bonus' } }
  const [isSaving, setIsSaving] = useState(false);

  // Initialisation des poids depuis la règle
  useEffect(() => {
    if (regle?.grille_objectifs?.indicateurs) {
      const initialConfigs = {};
      regle.grille_objectifs.indicateurs.forEach(ind => {
        initialConfigs[ind.id] = {
          poids: ind.poids || 0,
          type: ind.type_ponderation || 'bonus'
        };
      });
      setWeightConfigs(initialConfigs);
    }
  }, [regle]);

  const handleWeightChange = (id, val) => {
    const numVal = parseInt(val);
    if (isNaN(numVal)) return handleUpdate(id, 'poids', 0);

    if (numVal < 0) {
      // Si l'utilisateur tape un chiffre négatif, on bascule en Malus
      setWeightConfigs(prev => ({
        ...prev,
        [id]: { ...prev[id], poids: Math.abs(numVal), type: 'malus' }
      }));
    } else {
      handleUpdate(id, 'poids', numVal);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const newGrille = { ...regle.grille_objectifs };
    newGrille.indicateurs = newGrille.indicateurs.map(ind => {
      const config = weightConfigs[ind.id] || { poids: 0, type: 'bonus' };
      return {
        ...ind,
        poids: config.poids || 0,
        type_ponderation: config.type || 'bonus'
      };
    });

    await onSave(newGrille);
    setIsSaving(false);
  };

  const totalPoints = Object.values(weightConfigs).reduce((acc, curr) => {
    return curr.type === 'bonus' ? acc + (curr.poids || 0) : acc - (curr.poids || 0);
  }, 0);

  if (!regle?.grille_objectifs?.indicateurs) {
    return (
      <div className="weighting-empty">
        <i className="fa-solid fa-circle-info"></i>
        <p>Veuillez d'abord configurer vos indicateurs dans l'onglet <strong>Objectifs</strong>.</p>
      </div>
    );
  }

  return (
    <div className="weighting-section">
      <div className="weighting-header">
        <div className="weighting-title-group">
          <h3 className="weighting-title">Pondération des indicateurs</h3>
          <p className="weighting-subtitle">Définissez le nombre de points attribués à chaque indicateur pour le calcul de la prime.</p>
        </div>
        <div className={`total-points-badge ${totalPoints !== 100 ? 'warning' : 'success'}`}>
          Total : {totalPoints} pts
        </div>
      </div>

      <div className="weighting-grid">
        {regle.grille_objectifs.indicateurs.map(ind => {
          const config = weightConfigs[ind.id] || { poids: 0, type: 'bonus' };
          return (
            <div key={ind.id} className={`weighting-card ${config.type}`}>
              <div className="weighting-card__info">
                <span className="weighting-card__cat">{ind.categorie}</span>
                <span className="weighting-card__name">{ind.nom}</span>
                
                <div className="weighting-type-toggle">
                  <button 
                    className={`type-btn bonus ${config.type === 'bonus' ? 'active' : ''}`}
                    onClick={() => handleUpdate(ind.id, 'type', 'bonus')}
                    title="Bonus (ajoute au score)"
                  >
                    <i className="fa-solid fa-plus-circle"></i> Bonus
                  </button>
                  <button 
                    className={`type-btn malus ${config.type === 'malus' ? 'active' : ''}`}
                    onClick={() => handleUpdate(ind.id, 'type', 'malus')}
                    title="Malus (déduit du score)"
                  >
                    <i className="fa-solid fa-minus-circle"></i> Malus
                  </button>
                </div>
              </div>
              <div className="weighting-card__input-wrapper">
                <input 
                  type="number" 
                  value={config.poids} 
                  onChange={(e) => handleWeightChange(ind.id, e.target.value)}
                  className="weighting-input"
                />
                <span className="weighting-unit">pts</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="weighting-footer">
        <button 
          className="btn btn-primary" 
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Enregistrement...' : 'Enregistrer les pondérations'}
        </button>
      </div>
    </div>
  );
}
