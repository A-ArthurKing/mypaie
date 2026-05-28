/*
 * Fichier : Step3Valeurs.jsx
 * Rôle    : Étape 3 du GrilleEditorModal - Saisie des valeurs cibles par statut.
 */
import React from 'react';
import './Step3Valeurs.css';

export default function Step3Valeurs({ statuts, indicateurs, getKpiRef, openFormulaModal, onUpdateCible }) {
  return (
    <div className="gem-step overflow-auto">
      <p className="gem-step-desc">Saisissez les valeurs cibles pour chaque statut.</p>
      <table className="gem-preview-table">
        <thead>
          <tr>
            <th>Statut</th>
            {indicateurs.map(ind => {
              const kpiRef = getKpiRef(ind.metric_key);
              const isFormula = kpiRef?.is_formula;
              return (
                <th key={ind.id}>
                  <div className="gem-th-stack">
                    <div className="gem-th-name-row">
                      <span className="gem-th-name">{ind.nom}</span>
                      {isFormula && (
                        <button
                          type="button"
                          className="gem-formula-btn"
                          onClick={() => openFormulaModal(kpiRef)}
                          title="Voir la formule"
                        >
                          ƒ
                        </button>
                      )}
                    </div>
                    <span className={`gem-th-type tag-${ind.type_ponderation || 'bonus'}`}>
                      {ind.type_ponderation === 'eliminatoire' ? 'BLOQUANT' : 
                       ind.type_ponderation === 'coefficient' ? 'COEFF %' : 
                       ind.type_ponderation === 'malus' ? 'PENALITÉ' : 'BONUS'}
                    </span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {statuts.map((s, si) => (
            <tr key={si}>
              <td className="font-bold">{s.nom || `Statut ${si+1}`}</td>
              {indicateurs.map(ind => (
                <td key={ind.id}>
                  <div className="gem-cell-wrapper">
                    <input 
                      className="gem-cell-input"
                      placeholder={ind.type_ponderation === 'eliminatoire' ? 'Min' : 'Obj.'}
                      value={s.cibles ? (s.cibles[ind.id] || '') : ''} 
                      onChange={(e) => onUpdateCible(si, ind.id, e.target.value)}
                    />
                    <span className="gem-cell-unit">
                      {ind.type === 'pourcentage' ? '%' : ind.type === 'devise' ? 'DH' : ''}
                    </span>
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
