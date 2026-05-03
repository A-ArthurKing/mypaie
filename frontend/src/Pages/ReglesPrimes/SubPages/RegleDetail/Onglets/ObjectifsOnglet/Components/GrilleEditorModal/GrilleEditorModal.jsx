import React, { useState, useEffect } from 'react';
import './GrilleEditorModal.css';
import '../../../VariablesOnglet/Sections/PaliersSection/PaliersSection.css';

// Palette partagée avec PaliersSection
const COULEURS_DISPONIBLES = ['#f87171', '#fb923c', '#f59e0b', '#a3e635', '#38bdf8', '#818cf8', '#22c55e'];

const DEFAULT_PALIERS_MODAL = [
  { id: 1, label: 'Insuffisant', seuil_atteinte: 70,   pourcentage_paiement: 0,   couleur: '#f87171', locked: false },
  { id: 2, label: 'Partiel',     seuil_atteinte: 85,   pourcentage_paiement: 50,  couleur: '#f59e0b', locked: false },
  { id: 3, label: 'Correct',     seuil_atteinte: 100,  pourcentage_paiement: 75,  couleur: '#38bdf8', locked: false },
  { id: 4, label: 'Atteint',     seuil_atteinte: null, pourcentage_paiement: 100, couleur: '#22c55e', locked: false },
];

export default function GrilleEditorModal({ isOpen, onClose, onSave, initialData }) {
  const [activeStep, setActiveStep] = useState(1); // 1: Statuts, 2: Indicateurs, 3: Valeurs, 4: Paliers
  const [newCatName, setNewCatName] = useState('');
  const [data, setData] = useState({
    categories: [],
    indicateurs: [],
    statuts: [],
    paliers: [] // [{id, seuil_atteinte, pourcentage_paiement}]
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Enrichir les paliers existants avec couleur/locked s'ils n'en ont pas
        const enrichedPaliers = (initialData.paliers || []).map((p, i) => ({
          couleur: COULEURS_DISPONIBLES[i % COULEURS_DISPONIBLES.length],
          locked: false,
          ...p,
        }));
        setData({
          categories: initialData.categories || [],
          indicateurs: initialData.indicateurs || [],
          statuts: initialData.statuts || [],
          paliers: enrichedPaliers.length ? enrichedPaliers : DEFAULT_PALIERS_MODAL,
        });
      } else {
        // Mode création : paliers par défaut calqués sur l'Excel
        setData({
          categories: [],
          indicateurs: [],
          statuts: [],
          paliers: DEFAULT_PALIERS_MODAL,
        });
        setActiveStep(1);
      }
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  // --- Gestion des Statuts (Lignes) ---
  const addStatut = () => {
    setData(prev => ({
      ...prev,
      statuts: [...prev.statuts, { nom: '', prime_brute: '', cibles: {} }]
    }));
  };

  const removeStatut = (index) => {
    setData(prev => ({
      ...prev,
      statuts: prev.statuts.filter((_, i) => i !== index)
    }));
  };

  const updateStatut = (index, field, value) => {
    const newStatuts = [...data.statuts];
    newStatuts[index][field] = value;
    setData(prev => ({ ...prev, statuts: newStatuts }));
  };

  // --- Gestion des Indicateurs (Colonnes) ---
  const addIndicator = (categoryName = '') => {
    const id = `kpi_${Date.now()}`;
    setData(prev => ({
      ...prev,
      indicateurs: [...prev.indicateurs, { id, nom: '', categorie: categoryName, type: 'entier' }]
    }));
  };

  const removeIndicator = (id) => {
    setData(prev => ({
      ...prev,
      indicateurs: prev.indicateurs.filter(ind => ind.id !== id)
    }));
  };

  const updateIndicator = (id, field, value) => {
    setData(prev => ({
      ...prev,
      indicateurs: prev.indicateurs.map(ind => ind.id === id ? { ...ind, [field]: value } : ind)
    }));
  };

  // --- Gestion des Catégories ---
  const handleAddCategory = (e) => {
    e.preventDefault();
    if (newCatName.trim() && !data.categories.includes(newCatName.trim())) {
      const cat = newCatName.trim();
      setData(prev => ({ ...prev, categories: [...prev.categories, cat] }));
      setNewCatName('');
    }
  };

  const removeCategory = (cat) => {
    setData(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c !== cat),
      // On reset la catégorie des indicateurs qui y étaient rattachés
      indicateurs: prev.indicateurs.map(ind => ind.categorie === cat ? { ...ind, categorie: '' } : ind)
    }));
  };

  // --- Gestion des Cibles (Valeurs de la grille) ---
  const updateCible = (statutIndex, indicatorId, value) => {
    const newStatuts = [...data.statuts];
    if (!newStatuts[statutIndex].cibles) newStatuts[statutIndex].cibles = {};
    newStatuts[statutIndex].cibles[indicatorId] = value;
    setData(prev => ({ ...prev, statuts: newStatuts }));
  };

  const handleFinalSave = () => {
    onSave(data);
    onClose();
  };

  // --- Gestion des Paliers ---
  const addPalier = () => {
    setData(prev => {
      const sorted = [...prev.paliers].sort((a, b) => (a.seuil_atteinte ?? 999) - (b.seuil_atteinte ?? 999));
      const last = sorted[sorted.length - 1];
      const avantDernier = sorted[sorted.length - 2];
      const newSeuil = avantDernier?.seuil_atteinte ? Math.min(avantDernier.seuil_atteinte + 5, 99) : 90;
      const newPalier = {
        id: Date.now(),
        label: 'Nouveau palier',
        seuil_atteinte: newSeuil,
        pourcentage_paiement: 80,
        couleur: '#818cf8',
        locked: false,
      };
      // Insérer avant le palier "Atteint" verrouillé final
      return {
        ...prev,
        paliers: last?.locked
          ? [...prev.paliers.filter(p => p.id !== last.id), newPalier, last]
          : [...prev.paliers, newPalier],
      };
    });
  };

  const removePalier = (id) => {
    setData(prev => ({
      ...prev,
      paliers: prev.paliers.filter(p => p.id !== id)
    }));
  };

  const updatePalier = (id, field, value) => {
    setData(prev => ({
      ...prev,
      paliers: prev.paliers.map(p => {
        if (p.id !== id) return p;
        // label et couleur sont des strings, les champs seuil/pct sont numériques
        const isString = field === 'label' || field === 'couleur';
        const parsed = isString ? value : (value === '' ? '' : parseFloat(value));
        return { ...p, [field]: parsed };
      })
    }));
  };

  // --- Barre de visualisation des paliers ---
  const renderVisualBar = () => {
    const sorted = [...data.paliers].sort((a, b) => (a.seuil_atteinte ?? 999) - (b.seuil_atteinte ?? 999));
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
    <div className="grille-editor-overlay" onClick={onClose}>
      <div className="grille-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="grille-editor-header">
          <div className="grille-editor-title-row">
            <h2>Personnaliser la Grille d'Objectifs</h2>
            <button className="btn-close-modal" onClick={onClose} title="Fermer">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div className="step-indicator">
            <span className={activeStep === 1 ? 'active' : ''} onClick={() => setActiveStep(1)}>1. Statuts</span>
            <span className={activeStep === 2 ? 'active' : ''} onClick={() => setActiveStep(2)}>2. Indicateurs</span>
            <span className={activeStep === 3 ? 'active' : ''} onClick={() => setActiveStep(3)}>3. Valeurs</span>
            <span className={activeStep === 4 ? 'active' : ''} onClick={() => setActiveStep(4)}>4. Paliers de calcul</span>
          </div>
        </div>

        <div className="grille-editor-body">
          {activeStep === 1 && (
            <div className="editor-step">
              <p className="step-desc">Définissez les différents niveaux d'expérience ou statuts (ex: Débutant, Senior).</p>
              <div className="statuts-list">
                {data.statuts.map((s, i) => (
                  <div key={i} className="editor-row">
                    <input 
                      placeholder="Nom du statut" 
                      value={s.nom} 
                      onChange={(e) => updateStatut(i, 'nom', e.target.value)} 
                    />
                    <input 
                      placeholder="Prime Brute (ex: 1200 MAD)" 
                      value={s.prime_brute} 
                      onChange={(e) => updateStatut(i, 'prime_brute', e.target.value)} 
                    />
                    <button className="btn-icon danger" onClick={() => removeStatut(i)}>
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                ))}
              </div>
              <button className="btn btn-outline" onClick={addStatut}>+ Ajouter un statut</button>
            </div>
          )}

          {activeStep === 2 && (
            <div className="editor-step">
              <div className="categories-management">
                <h4 className="management-title">1. Définir les grandes catégories</h4>
                <p className="step-desc">Regroupez vos indicateurs par thématique (ex: Productivité, Qualité).</p>
                
                <div className="category-add-form">
                  <input 
                    placeholder="Nom de la catégorie..." 
                    value={newCatName} 
                    onChange={(e) => setNewCatName(e.target.value)}
                  />
                  <button className="btn btn-primary btn-sm" onClick={handleAddCategory}>Ajouter</button>
                </div>

                <div className="categories-badges">
                  {data.categories.map(cat => (
                    <span key={cat} className="cat-badge">
                      {cat} 
                      <i className="fa-solid fa-xmark" onClick={() => removeCategory(cat)}></i>
                    </span>
                  ))}
                </div>
              </div>

              <div className="indicators-management">
                <h4 className="management-title">2. Rattacher les indicateurs aux catégories</h4>
                
                {data.categories.length === 0 && (
                  <div className="info-box">Veuillez d'abord créer au moins une catégorie ci-dessus.</div>
                )}

                {data.categories.map(cat => (
                  <div key={cat} className="category-group-box">
                    <div className="category-group-header">
                      <i className="fa-solid fa-folder-open"></i> {cat}
                    </div>
                    <div className="category-group-content">
                      {data.indicateurs.filter(i => i.categorie === cat).map(ind => (
                        <div key={ind.id} className="editor-row">
                          <div className="input-with-label">
                            <label>Nom de l'indicateur</label>
                            <input 
                              placeholder="Ex: DMT, Ventes..." 
                              value={ind.nom} 
                              onChange={(e) => updateIndicator(ind.id, 'nom', e.target.value)} 
                            />
                          </div>
                          <div className="input-with-label" style={{ flex: '0 0 150px' }}>
                            <label>Type de valeur</label>
                            <select value={ind.type} onChange={(e) => updateIndicator(ind.id, 'type', e.target.value)}>
                              <option value="entier">Nombre</option>
                              <option value="pourcentage">Pourcentage (%)</option>
                              <option value="devise">Devise (€/MAD)</option>
                            </select>
                          </div>
                          <button className="btn-icon danger mt-label" onClick={() => removeIndicator(ind.id)}>
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      ))}
                      <button className="btn btn-xs btn-outline-alt" onClick={() => addIndicator(cat)}>
                        + Ajouter un indicateur dans {cat}
                      </button>
                    </div>
                  </div>
                ))}

                {/* Indicateurs orphelins */}
                {data.indicateurs.filter(i => !i.categorie || !data.categories.includes(i.categorie)).length > 0 && (
                  <div className="category-group-box warning">
                    <div className="category-group-header">Indicateurs sans catégorie</div>
                    <div className="category-group-content">
                      {data.indicateurs.filter(i => !i.categorie || !data.categories.includes(i.categorie)).map(ind => (
                        <div key={ind.id} className="editor-row">
                          <input 
                            placeholder="Nom KPI" 
                            value={ind.nom} 
                            onChange={(e) => updateIndicator(ind.id, 'nom', e.target.value)} 
                          />
                          <select 
                            value={ind.categorie} 
                            onChange={(e) => updateIndicator(ind.id, 'categorie', e.target.value)}
                          >
                            <option value="">Choisir une catégorie...</option>
                            {data.categories.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <button className="btn-icon danger" onClick={() => removeIndicator(ind.id)}>
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="editor-step overflow-auto">
              <p className="step-desc">Saisissez les valeurs cibles pour chaque statut.</p>
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>Statut</th>
                    {data.indicateurs.map(ind => <th key={ind.id}>{ind.nom}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.statuts.map((s, si) => (
                    <tr key={si}>
                      <td className="font-bold">{s.nom || `Statut ${si+1}`}</td>
                      {data.indicateurs.map(ind => (
                        <td key={ind.id}>
                          <input 
                            className="cell-input"
                            value={s.cibles[ind.id] || ''} 
                            onChange={(e) => updateCible(si, ind.id, e.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeStep === 4 && (
            <div className="editor-step">
              <h4 className="management-title">Définir les paliers de versement</h4>
              <p className="step-desc">Indiquez le % de points attribués selon le taux d'atteinte de l'objectif.</p>

              {/* Barre visuelle */}
              {renderVisualBar()}

              {/* Tableau des paliers */}
              <div className="ps-legend">
                <div className="ps-legend__header">
                  <span>Palier</span>
                  <span>Plage d'atteinte</span>
                  <span>Points versés</span>
                  <span>Couleur</span>
                  <span></span>
                </div>
                {[...data.paliers]
                  .sort((a, b) => (a.seuil_atteinte ?? 999) - (b.seuil_atteinte ?? 999))
                  .map((p, index, sorted) => {
                    const min = index === 0 ? 0 : sorted[index - 1].seuil_atteinte;
                    return (
                      <div key={p.id} className={`ps-legend__row ${p.locked ? 'ps-legend__row--locked' : ''}`}>

                        {/* Nom du palier */}
                        <div className="ps-legend__cell">
                          <span className="ps-legend__dot" style={{ background: p.couleur || '#ccc' }}></span>
                          <input
                            type="text"
                            className="ps-input ps-input--label"
                            value={p.label || ''}
                            onChange={(e) => updatePalier(p.id, 'label', e.target.value)}
                            disabled={p.locked}
                          />
                        </div>

                        {/* Plage : de X% à Y% */}
                        <div className="ps-legend__cell ps-legend__cell--range">
                          <span className="ps-range__from">{min}%</span>
                          <span className="ps-range__sep">→</span>
                          {p.seuil_atteinte !== null ? (
                            <input
                              type="number"
                              className="ps-input ps-input--seuil"
                              value={p.seuil_atteinte}
                              onChange={(e) => updatePalier(p.id, 'seuil_atteinte', e.target.value)}
                              min={min + 1}
                              max={99}
                              disabled={p.locked}
                            />
                          ) : (
                            <span className="ps-range__infinity">∞</span>
                          )}
                          {p.seuil_atteinte !== null && <span className="ps-range__unit">%</span>}
                        </div>

                        {/* Points versés */}
                        <div className="ps-legend__cell ps-legend__cell--mult">
                          <input
                            type="number"
                            className="ps-input ps-input--mult"
                            value={p.pourcentage_paiement}
                            onChange={(e) => updatePalier(p.id, 'pourcentage_paiement', e.target.value)}
                            min={0}
                            max={100}
                            disabled={p.locked}
                          />
                          <span className="ps-range__unit">%</span>
                          <span className="ps-mult__hint">des points</span>
                        </div>

                        {/* Sélecteur couleur */}
                        <div className="ps-legend__cell ps-legend__cell--colors">
                          {COULEURS_DISPONIBLES.map(c => (
                            <button
                              key={c}
                              type="button"
                              className={`ps-color-dot ${p.couleur === c ? 'ps-color-dot--active' : ''}`}
                              style={{ background: c }}
                              onClick={() => !p.locked && updatePalier(p.id, 'couleur', c)}
                              disabled={p.locked}
                            />
                          ))}
                        </div>

                        {/* Action */}
                        <div className="ps-legend__cell ps-legend__cell--action">
                          {!p.locked ? (
                            <button type="button" className="btn-icon danger" onClick={() => removePalier(p.id)}>
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

              <button className="btn btn-outline" onClick={addPalier} type="button">
                <i className="fa-solid fa-plus"></i> Ajouter un palier
              </button>

              <div className="info-box info-box--blue mt-20">
                <i className="fa-solid fa-circle-info"></i>
                <p>Exemple : un palier à <strong>85%</strong> avec <strong>50%</strong> des points signifie que l'agent obtient la moitié des points prévus pour ce KPI s'il se situe entre 85% et le seuil suivant.</p>
              </div>
            </div>
          )}
        </div>

        <div className="grille-editor-footer">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          {activeStep > 1 && <button className="btn btn-outline" onClick={() => setActiveStep(activeStep - 1)}>Précédent</button>}
          {activeStep < 4 ? (
            <button className="btn btn-primary" onClick={() => setActiveStep(activeStep + 1)}>Suivant</button>
          ) : (
            <button className="btn btn-success" onClick={handleFinalSave}>Enregistrer la grille</button>
          )}
        </div>
      </div>
    </div>
  );
}
