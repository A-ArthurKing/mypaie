/*
 * Fichier : Step5ReglesSpeciales.jsx
 * Rôle    : Étape 5 du GrilleEditorModal - Configuration des primes additionnelles et règles spéciales.
 */
import React from 'react';
import Select from 'react-select';
import './Step5ReglesSpeciales.css';

export default function Step5ReglesSpeciales({ 
  primes, 
  kpiRefs, 
  onAdd, 
  onRemove, 
  onUpdate, 
  onAddCondition, 
  onRemoveCondition, 
  onUpdateCondition 
}) {
  return (
    <div className="gem-step">
      <h4 className="gem-mgmt-title">Configuration des Primes Additionnelles</h4>
      <p className="gem-step-desc">Ajoutez des primes spécifiques (fixes, manuelles ou basées sur l'atteinte d'un indicateur).</p>
      
      <div className="gem-extra-primes-list">
        {primes.length === 0 && (
          <div className="gem-info-box">Aucune prime additionnelle configurée. Cliquez sur le bouton ci-dessous pour en ajouter une.</div>
        )}
        
        {primes.map((p) => (
          <div key={p.id} className="gem-extra-prime-card">
            <div className="gem-row">
              <div className="gem-input-group">
                <label>
                  <i className="fa-solid fa-tag"></i> Nom de la prime
                </label>
                <input 
                  placeholder="Ex: Prime Challenge" 
                  value={p.nom} 
                  onChange={(e) => onUpdate(p.id, 'nom', e.target.value)} 
                />
              </div>
              <div className="gem-input-group" style={{ flex: '0 0 220px' }}>
                <label>
                  <i className="fa-solid fa-hand-holding-dollar"></i> Type d'attribution
                </label>
                <select value={p.type} onChange={(e) => onUpdate(p.id, 'type', e.target.value)}>
                  <option value="fixe">Fixe (Par défaut)</option>
                  <option value="conditionnelle">Conditionnelle (Calculée)</option>
                  <option value="manuel">Saisie Manuelle (Agent)</option>
                </select>
              </div>
              <button className="gem-btn-icon danger gem-mt-label" onClick={() => onRemove(p.id)}>
                <i className="fa-solid fa-trash"></i>
              </button>
            </div>

            {p.type === 'fixe' && (
              <div className="gem-extra-details">
                <div className="gem-input-group" style={{ maxWidth: '200px' }}>
                  <label>Montant (DH)</label>
                  <input 
                    type="number"
                    value={p.montant_defaut} 
                    onChange={(e) => onUpdate(p.id, 'montant_defaut', parseFloat(e.target.value) || 0)} 
                  />
                </div>
              </div>
            )}

            {p.type === 'conditionnelle' && (
              <div className="gem-extra-details gem-extra-details--cond">
                <div className="gem-info-box gem-info-box--blue" style={{ marginBottom: '16px', marginTop: 0 }}>
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  <p>Cette prime sera calculée automatiquement selon le résultat de l'agent sur l'indicateur choisi.</p>
                </div>
                <div className="gem-input-group" style={{ marginBottom: '12px' }}>
                  <label>Basé sur l'indicateur</label>
                  <Select
                    className="gem-react-select-container"
                    classNamePrefix="gem-react-select"
                    menuPortalTarget={document.body}
                    value={
                      p.metric_key 
                        ? { value: p.metric_key, label: p.metric_key } 
                        : null
                    }
                    onChange={(opt) => onUpdate(p.id, 'metric_key', opt?.value)}
                    options={Object.entries(kpiRefs).map(([univers, list]) => ({
                      label: univers,
                      options: list.map(k => ({
                        value: k.tech_key,
                        label: k.libelle,
                        ...k
                      }))
                    }))}
                    placeholder="Rechercher un KPI..."
                    isClearable
                    isSearchable
                    styles={customSelectStyles}
                  />
                </div>
                
                <div className="gem-cond-rules">
                  <label className="gem-sub-label">Règles de paliers :</label>
                  {(p.conditions || []).map((c, cIdx) => (
                    <div key={cIdx} className="gem-cond-row">
                      <span className="gem-cond-txt">Si réel &ge;</span>
                      <input 
                        type="number" 
                        placeholder="Seuil" 
                        value={c.seuil} 
                        style={{ width: '80px' }}
                        onChange={(e) => onUpdateCondition(p.id, cIdx, 'seuil', e.target.value)}
                      />
                      <span className="gem-cond-txt">alors +</span>
                      <input 
                        type="number" 
                        placeholder="Valeur" 
                        value={c.montant} 
                        style={{ width: '80px' }}
                        onChange={(e) => onUpdateCondition(p.id, cIdx, 'montant', e.target.value)}
                      />
                      <select 
                        value={c.type_montant || 'fixe'} 
                        onChange={(e) => onUpdateCondition(p.id, cIdx, 'type_montant', e.target.value)}
                        style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #3b3b4f', background: '#13131f', color: '#fff' }}
                      >
                        <option value="fixe">DH</option>
                        <option value="pourcentage">% du réel</option>
                      </select>
                      <button className="gem-btn-icon danger btn-xs" onClick={() => onRemoveCondition(p.id, cIdx)}>
                        <i className="fa-solid fa-times"></i>
                      </button>
                    </div>
                  ))}
                  <button className="btn gem-btn-xs gem-btn-outline" onClick={() => onAddCondition(p.id)}>
                    <i className="fa-solid fa-plus"></i> Ajouter un palier
                  </button>
                </div>
              </div>
            )}

            {p.type === 'manuel' && (
              <div className="gem-extra-details">
                <p className="gem-info-txt">
                  <i className="fa-solid fa-circle-info"></i> Cette prime sera saisie manuellement pour chaque agent dans l'onglet "Objectifs".
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
      
      <button className="btn gem-btn-outline" onClick={onAdd} type="button">
        <i className="fa-solid fa-plus"></i> Ajouter une règle spéciale / tranche
      </button>
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
