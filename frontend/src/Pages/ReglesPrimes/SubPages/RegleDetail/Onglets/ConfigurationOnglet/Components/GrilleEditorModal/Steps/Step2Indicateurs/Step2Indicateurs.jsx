/*
 * Fichier : Step2Indicateurs.jsx
 * Rôle    : Étape 2 du GrilleEditorModal - Gestion des catégories et indicateurs (KPIs).
 */
import React, { useState, useMemo } from 'react';
import Select from 'react-select';
import './Step2Indicateurs.css';

export default function Step2Indicateurs({ 
  categories, 
  indicateurs, 
  kpiRefs, 
  isLoading,
  totalPoidsBonus,
  onAddCategory,
  onRemoveCategory,
  onAddIndicator,
  onRemoveIndicator,
  onUpdateIndicator,
  onAddPalierValeur,
  onRemovePalierValeur,
  onUpdatePalierValeur,
  openFormulaModal,
  getKpiRef
}) {
  const [newCatName, setNewCatName] = useState('');

  console.log('[Step2Indicateurs] Rendering with kpiRefs keys:', Object.keys(kpiRefs || {}));

  const options = useMemo(() => {
    if (!kpiRefs) return [];
    const groups = [];
    
    try {
      Object.keys(kpiRefs).forEach(univers => {
        const list = kpiRefs[univers];
        if (Array.isArray(list) && list.length > 0) {
          groups.push({
            label: univers.toUpperCase(),
            options: list.map(k => ({
              value: k.tech_key,
              label: k.libelle || k.tech_key,
              univers: univers,
              ...k
            }))
          });
        }
      });
    } catch (e) {
      console.error('[Step2Indicateurs] Error building options:', e);
    }
    
    return groups;
  }, [kpiRefs]);

  const handleAddCatLocal = (e) => {
    e.preventDefault();
    if (newCatName.trim()) {
      onAddCategory(newCatName.trim());
      setNewCatName('');
    }
  };

  return (
    <div className="gem-step">
      {/* ... (rest of the component) */}
      <div className="gem-categories-mgmt">
        <h4 className="gem-mgmt-title">1. Définir les grandes catégories</h4>
        <p className="gem-step-desc">Regroupez vos indicateurs par thématique (ex: Productivité, Qualité).</p>
        
        <div className="gem-cat-add-form">
          <input 
            placeholder="Nom de la catégorie..." 
            value={newCatName} 
            onChange={(e) => setNewCatName(e.target.value)}
          />
          <button className="btn btn-primary gem-btn-sm" onClick={handleAddCatLocal}>Ajouter</button>
        </div>

        <div className="gem-cat-badges">
          {categories.map(cat => (
            <span key={cat} className="gem-cat-badge">
              {cat} 
              <i className="fa-solid fa-xmark" onClick={() => onRemoveCategory(cat)}></i>
            </span>
          ))}
        </div>
      </div>

      <div className="gem-indicators-mgmt">
        <h4 className="gem-mgmt-title">2. Rattacher les indicateurs aux catégories</h4>

        <div className={`gem-weight-counter${totalPoidsBonus > 100 ? ' gem-weight-counter--over' : totalPoidsBonus >= 90 ? ' gem-weight-counter--near' : totalPoidsBonus === 100 ? ' gem-weight-counter--perfect' : ''}`}>
          <div className="gem-weight-counter__info">
            <span className="gem-weight-counter__icon">
              {totalPoidsBonus > 100
                ? <i className="fa-solid fa-triangle-exclamation"></i>
                : totalPoidsBonus === 100
                  ? <i className="fa-solid fa-circle-check"></i>
                  : <i className="fa-solid fa-scale-balanced"></i>}
            </span>
            <span className="gem-weight-counter__text">
              Points Bonus / Malus&nbsp;:&nbsp;
              <strong>{totalPoidsBonus}</strong> / 100
              {totalPoidsBonus > 100 && <span className="gem-weight-counter__hint hint--over"> — Dépassement de {totalPoidsBonus - 100} pt{totalPoidsBonus - 100 > 1 ? 's' : ''} !</span>}
              {totalPoidsBonus === 100 && <span className="gem-weight-counter__hint hint--perfect"> — Parfait ✓</span>}
              {totalPoidsBonus < 100 && totalPoidsBonus > 0 && <span className="gem-weight-counter__hint"> — {100 - totalPoidsBonus} pt{100 - totalPoidsBonus > 1 ? 's' : ''} restant{100 - totalPoidsBonus > 1 ? 's' : ''}</span>}
            </span>
          </div>
          <div className="gem-weight-counter__bar-wrap">
            <div
              className="gem-weight-counter__fill"
              style={{ width: `${Math.min(totalPoidsBonus, 100)}%` }}
            />
          </div>
        </div>
        
        {categories.length === 0 && (
          <div className="gem-info-box">Veuillez d'abord créer au moins une catégorie ci-dessus.</div>
        )}

        {categories.map(cat => (
          <div key={cat} className="gem-cat-group-box">
            <div className="gem-cat-group-header">
              <i className="fa-solid fa-folder-open"></i> {cat}
            </div>
            <div className="gem-cat-group-content">
              {indicateurs.filter(i => i.categorie === cat).map(ind => {
                const kpiRefInd = getKpiRef(ind.metric_key);
                const indIsFormula = kpiRefInd?.is_formula;
                return (
                <div key={ind.id} className="gem-indicator-block">
                <div className="gem-row" style={{ marginBottom: ind.mode_prime === 'montant_direct' ? '0' : undefined }}>
                  <div className="gem-input-group" style={{ flex: '1 1 300px' }}>
                    <label>Source de donnée (DW) & Nom</label>
                    <div className="gem-select-formula-wrap">
                      <div style={{ flex: 1, minWidth: '300px' }}>
                        <Select
                          className="gem-react-select-container"
                          classNamePrefix="gem-react-select"
                          menuPortalTarget={document.body}
                          value={
                            ind.metric_key 
                              ? { value: ind.metric_key, label: ind.nom || ind.metric_key } 
                              : null
                          }
                          onChange={(opt) => onUpdateIndicator(ind.id, 'metric_key', opt?.value)}
                          options={options}
                        isLoading={isLoading}
                        noOptionsMessage={() => isLoading ? "Chargement..." : `Aucun KPI trouvé pour ce projet`}
                        placeholder={isLoading ? "Chargement des KPIs..." : "Rechercher un KPI..."}
                          isClearable
                          isSearchable
                          styles={customSelectStyles}
                        />
                      </div>
                      {indIsFormula && (
                        <button
                          type="button"
                          className="gem-formula-btn gem-formula-btn--inline"
                          onClick={() => openFormulaModal(kpiRefInd)}
                          title="Voir la formule"
                        >
                          ƒ
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="gem-input-group" style={{ flex: '0 0 130px' }}>
                    <label>
                      <i className="fa-solid fa-compass"></i> Sens objectif
                    </label>
                    <select
                      value={ind.direction || 'higher_better'}
                      onChange={(e) => onUpdateIndicator(ind.id, 'direction', e.target.value)}
                    >
                      <option value="higher_better">Plus = Mieux</option>
                      <option value="lower_better">Moins = Mieux</option>
                    </select>
                  </div>

                  <div className="gem-input-group" style={{ flex: '0 0 145px' }}>
                    <label>
                      <i className="fa-solid fa-scale-unbalanced"></i> Comportement
                    </label>
                    <select 
                      value={ind.type_ponderation || 'bonus'} 
                      onChange={(e) => onUpdateIndicator(ind.id, 'type_ponderation', e.target.value)}
                    >
                      <option value="bonus">Bonus (Pts)</option>
                      <option value="malus">Pénalité (Pts)</option>
                      <option value="eliminatoire">Éliminatoire</option>
                      <option value="coefficient">Global (%)</option>
                    </select>
                  </div>

                  <div className="gem-input-group" style={{ flex: '0 0 155px' }}>
                    <label>
                      <i className="fa-solid fa-calculator"></i> Mode prime
                    </label>
                    <select
                      value={ind.mode_prime || 'score_global'}
                      onChange={(e) => onUpdateIndicator(ind.id, 'mode_prime', e.target.value)}
                    >
                      <option value="score_global">Score global</option>
                      <option value="montant_direct">Tranches de valeur</option>
                      <option value="pourcentage_valeur">% de la valeur</option>
                    </select>
                  </div>
                  
                  <div className="gem-input-group" style={{ flex: '0 0 70px' }}>
                    <label>{(ind.type_ponderation === 'eliminatoire' || ind.type_ponderation === 'coefficient') ? 'Impact' : 'Poids'}</label>
                    <input 
                      type="number"
                      placeholder="20" 
                      value={ind.poids} 
                      onChange={(e) => onUpdateIndicator(ind.id, 'poids', e.target.value)} 
                    />
                  </div>

                  <div className="gem-input-group" style={{ flex: '0 0 100px' }}>
                    <label>Format</label>
                    <div className="gem-readonly-val">
                      {ind.type === 'pourcentage' ? '%' : ind.type === 'devise' ? 'DH/€' : 'Nb'}
                    </div>
                  </div>
                  <button className="gem-btn-icon danger gem-mt-label" onClick={() => onRemoveIndicator(ind.id)}>
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>

                {ind.mode_prime === 'montant_direct' && (
                  <div className="gem-pv-section">
                    <div className="gem-pv-header">
                      <i className="fa-solid fa-layer-group"></i>
                      <span>Tranches de valeur — le montant de prime est déclenché directement selon la valeur du KPI</span>
                    </div>
                    <table className="gem-pv-table">
                      <thead>
                        <tr>
                          <th>Seuil min</th>
                          <th>Seuil max</th>
                          <th>Montant</th>
                          <th>Type</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(ind.paliers_valeur || []).map((p, pIdx) => (
                          <tr key={pIdx}>
                            <td>
                              <input
                                type="number"
                                className="gem-cell-input"
                                value={p.seuil_min ?? ''}
                                onChange={(e) => onUpdatePalierValeur(ind.id, pIdx, 'seuil_min', e.target.value)}
                                placeholder="0"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="gem-cell-input"
                                value={p.seuil_max ?? ''}
                                onChange={(e) => onUpdatePalierValeur(ind.id, pIdx, 'seuil_max', e.target.value)}
                                placeholder="∞ (illimité)"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="gem-cell-input"
                                value={p.montant ?? ''}
                                onChange={(e) => onUpdatePalierValeur(ind.id, pIdx, 'montant', e.target.value)}
                                placeholder="0"
                              />
                            </td>
                            <td>
                              <select
                                value={p.type_montant || 'fixe'}
                                onChange={(e) => onUpdatePalierValeur(ind.id, pIdx, 'type_montant', e.target.value)}
                                className="gem-pv-type-select"
                              >
                                <option value="fixe">MAD fixe</option>
                                <option value="pourcentage_kpi">% du KPI</option>
                              </select>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="gem-btn-icon danger"
                                onClick={() => onRemovePalierValeur(ind.id, pIdx)}
                              >
                                <i className="fa-solid fa-times"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button
                      type="button"
                      className="btn gem-btn-xs gem-btn-outline"
                      onClick={() => onAddPalierValeur(ind.id)}
                    >
                      <i className="fa-solid fa-plus"></i> Ajouter une tranche
                    </button>
                  </div>
                )}
                </div>
                );
              })}

              <button className="btn gem-btn-xs gem-btn-outline-alt" onClick={() => onAddIndicator(cat)}>
                + Ajouter un indicateur dans {cat}
              </button>
            </div>
          </div>
        ))}

        {/* Indicateurs orphelins */}
        {indicateurs.filter(i => !i.categorie || !categories.includes(i.categorie)).length > 0 && (
          <div className="gem-cat-group-box warning">
            <div className="gem-cat-group-header">Indicateurs sans catégorie</div>
            <div className="gem-cat-group-content">
              {indicateurs.filter(i => !i.categorie || !categories.includes(i.categorie)).map(ind => (
                <div key={ind.id} className="gem-row">
                  <div className="gem-readonly-val" style={{ flex: 1 }}>{ind.nom || 'Sans nom'}</div>
                  <select 
                    value={ind.categorie} 
                    onChange={(e) => onUpdateIndicator(ind.id, 'categorie', e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">Rattacher à...</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button className="gem-btn-icon danger" onClick={() => onRemoveIndicator(ind.id)}>
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const customSelectStyles = {
  control: (base, state) => ({
    ...base,
    background: 'var(--color-surface)',
    borderColor: state.isFocused ? 'var(--color-accent)' : 'var(--color-border)',
    color: 'var(--color-text-primary)',
    minHeight: '42px',
    borderRadius: 'var(--radius-md)',
    boxShadow: state.isFocused ? '0 0 0 3px var(--color-accent-soft)' : 'none',
    '&:hover': {
      borderColor: 'var(--color-accent)'
    }
  }),
  menu: (base) => ({
    ...base,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-lg)',
    zIndex: 9999,
    minWidth: '450px',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden'
  }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  option: (base, { isFocused, isSelected }) => ({
    ...base,
    background: isSelected ? 'var(--color-accent)' : (isFocused ? 'var(--color-surface-hover)' : 'transparent'),
    color: isSelected ? '#fff' : 'var(--color-text-primary)',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    padding: '10px 14px',
    whiteSpace: 'nowrap'
  }),
  singleValue: (base) => ({
    ...base,
    color: 'var(--color-text-primary)',
    fontSize: 'var(--text-sm)'
  }),
  input: (base) => ({
    ...base,
    color: 'var(--color-text-primary)'
  }),
  placeholder: (base) => ({
    ...base,
    color: 'var(--color-text-muted)',
    fontSize: 'var(--text-sm)'
  }),
  groupHeading: (base) => ({
    ...base,
    color: 'var(--color-text-muted)',
    fontWeight: 'var(--weight-bold)',
    textTransform: 'uppercase',
    fontSize: '0.65rem',
    background: 'var(--color-bg-app)',
    padding: '8px 12px',
    borderBottom: '1px solid var(--color-border-subtle)',
    letterSpacing: '0.05em'
  })
};
