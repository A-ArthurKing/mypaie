/*
 * Fichier : Step4Paliers.jsx
 * Rôle    : Étape 4 du GrilleEditorModal - Définition des paliers de versement.
 */
import React from 'react';
import './Step4Paliers.css';

export default function Step4Paliers({ paliers, colors, onAdd, onRemove, onUpdate }) {
  
  const renderVisualBar = () => {
    const sorted = [...paliers].sort((a, b) => (a.seuil_atteinte ?? 999) - (b.seuil_atteinte ?? 999));
    const segments = sorted.map((p, i) => {
      const min = i === 0 ? 0 : sorted[i - 1].seuil_atteinte;
      const max = p.seuil_atteinte;
      const width = max !== null ? max - min : 15;
      return { ...p, width };
    });
    const total = segments.reduce((acc, s) => acc + s.width, 0);
    return (
      <div className="ps-bar">
        {segments.map(seg => (
          <div
            key={seg.id}
            className="ps-bar__segment"
            style={{ width: `${(seg.width / total) * 100}%`, background: seg.couleur || '#ccc' }}
          >
            <span className="ps-bar__label">{seg.label || '—'}</span>
            <span className="ps-bar__mult">{seg.pourcentage_paiement}%</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="gem-step">
      <h4 className="gem-mgmt-title">Définir les paliers de versement</h4>
      <div className="gem-info-box gem-info-box--blue" style={{ marginBottom: '20px' }}>
        <i className="fa-solid fa-circle-info"></i>
        <p>
          Les paliers évaluent la performance globale (la somme pondérée des indicateurs de type Bonus/Malus).<br/>
          <strong>Si vous souhaitez uniquement déclencher des montants selon des tranches (ex: tranches de CA), laissez ces paliers de côté et passez à l'étape suivante.</strong>
        </p>
      </div>

      {renderVisualBar()}

      <div className="ps-legend">
        <div className="ps-legend__header">
          <span>Palier</span>
          <span>Plage d'atteinte</span>
          <span>Points versés</span>
          <span>Couleur</span>
          <span></span>
        </div>
        {[...paliers]
          .sort((a, b) => (a.seuil_atteinte ?? 999) - (b.seuil_atteinte ?? 999))
          .map((p, index, sorted) => {
            const min = index === 0 ? 0 : sorted[index - 1].seuil_atteinte;
            return (
              <div key={p.id} className={`ps-legend__row ${p.locked ? 'ps-legend__row--locked' : ''}`}>
                <div className="ps-legend__cell">
                  <span className="ps-legend__dot" style={{ background: p.couleur || '#ccc' }}></span>
                  <input
                    type="text"
                    className="ps-input ps-input--label"
                    value={p.label || ''}
                    onChange={(e) => onUpdate(p.id, 'label', e.target.value)}
                    disabled={p.locked}
                  />
                </div>

                <div className="ps-legend__cell ps-legend__cell--range">
                  <span className="ps-range__from">{min}%</span>
                  <span className="ps-range__sep">→</span>
                  {p.seuil_atteinte !== null ? (
                    <input
                      type="number"
                      className="ps-input ps-input--seuil"
                      value={p.seuil_atteinte}
                      onChange={(e) => onUpdate(p.id, 'seuil_atteinte', e.target.value)}
                      min={min + 1}
                      max={99}
                      disabled={p.locked}
                    />
                  ) : (
                    <span className="ps-range__infinity">∞</span>
                  )}
                  {p.seuil_atteinte !== null && <span className="ps-range__unit">%</span>}
                </div>

                <div className="ps-legend__cell ps-legend__cell--mult">
                  <input
                    type="number"
                    className="ps-input ps-input--mult"
                    value={p.pourcentage_paiement}
                    onChange={(e) => onUpdate(p.id, 'pourcentage_paiement', e.target.value)}
                    min={0}
                    max={100}
                    disabled={p.locked}
                  />
                  <span className="ps-range__unit">%</span>
                  <span className="ps-mult__hint">des points</span>
                </div>

                <div className="ps-legend__cell ps-legend__cell--colors">
                  {colors.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`ps-color-dot ${p.couleur === c ? 'ps-color-dot--active' : ''}`}
                      style={{ background: c }}
                      onClick={() => !p.locked && onUpdate(p.id, 'couleur', c)}
                      disabled={p.locked}
                    />
                  ))}
                </div>

                <div className="ps-legend__cell ps-legend__cell--action">
                  {!p.locked ? (
                    <button type="button" className="gem-btn-icon danger" onClick={() => onRemove(p.id)}>
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  ) : (
                    <span className="ps-locked-badge" title="Palier système non modifiable">
                      <i className="fa-solid fa-lock"></i>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        }
      </div>

      <button className="btn gem-btn-outline" onClick={onAdd} type="button">
        <i className="fa-solid fa-plus"></i> Ajouter un palier
      </button>

      <div className="gem-info-box gem-info-box--blue gem-mt-20">
        <i className="fa-solid fa-circle-info"></i>
        <p>Exemple : un palier à <strong>85%</strong> avec <strong>50%</strong> des points signifie que l'agent obtient la moitié des points prévus pour ce KPI s'il se situe entre 85% et le seuil suivant.</p>
      </div>
    </div>
  );
}
