import React, { useState, useEffect } from 'react';
import { useSocket } from '../../../../../../../../Shared/Contexts/SocketContext';
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
  const [kpiRefs, setKpiRefs] = useState({});
  const socket = useSocket();
  const [data, setData] = useState({
    categories: [],
    indicateurs: [],
    statuts: [],
    paliers: [],
    primes_additionnelles: [] 
  });

  useEffect(() => {
    // Charger les KPIs de référence
    const fetchRefs = () => {
      fetch('/api/parametres/references')
        .then(res => res.json())
        .then(d => setKpiRefs(d.kpis || {}))
        .catch(e => console.error("Erreur chargement refs KPIs", e));
    };

    fetchRefs();

    if (socket) {
      const handleUpdate = () => {
        console.log('[RealTime] Mise à jour des références détectée');
        fetchRefs();
      };
      socket.on('kpi_standards_updated', handleUpdate);
      socket.on('mapping_kpis_updated', handleUpdate);
      return () => {
        socket.off('kpi_standards_updated', handleUpdate);
        socket.off('mapping_kpis_updated', handleUpdate);
      };
    }
  }, [socket]);

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
          primes_additionnelles: initialData.primes_additionnelles || []
        });
      } else {
        // Mode création : paliers par défaut calqués sur l'Excel
        setData({
          categories: [],
          indicateurs: [],
          statuts: [],
          paliers: DEFAULT_PALIERS_MODAL,
          primes_additionnelles: []
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
      statuts: [...prev.statuts, { nom: '', prime_brute: '', montant_sb: '', cibles: {} }]
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
      indicateurs: [...prev.indicateurs, { 
        id, 
        nom: '', 
        categorie: categoryName, 
        type: 'entier', 
        poids: 10, 
        metric_key: '',
        type_ponderation: 'bonus' // Nouveau : bonus, malus, eliminatoire, coefficient
      }]
    }));
  };

  const removeIndicator = (id) => {
    setData(prev => ({
      ...prev,
      indicateurs: prev.indicateurs.filter(ind => ind.id !== id)
    }));
  };

  const updateIndicator = (id, field, value) => {
    setData(prev => {
      const newInds = prev.indicateurs.map(ind => {
        if (ind.id !== id) return ind;
        
        const updated = { ...ind, [field]: value };
        
        // Si on change la clé métrique, on pré-remplit les autres champs
        if (field === 'metric_key' && value) {
          // Rechercher la métrique dans toutes les catégories du référentiel
          let found = null;
          Object.values(kpiRefs).forEach(group => {
            const m = group.find(k => k.tech_key === value);
            if (m) found = m;
          });

          if (found) {
            updated.nom = found.libelle;
            // Mapping des types d'unités vers les types d'affichage
            if (found.unite === '%') updated.type = 'pourcentage';
            else if (found.unite === 'EUR' || found.unite === 'DH') updated.type = 'devise';
            else updated.type = 'entier';
          }
        }
        
        return updated;
      });
      return { ...prev, indicateurs: newInds };
    });
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

  // --- Gestion des Primes Additionnelles ---
  const addExtraPrime = () => {
    const id = `extra_${Date.now()}`;
    setData(prev => ({
      ...prev,
      primes_additionnelles: [...prev.primes_additionnelles, { 
        id, 
        nom: '', 
        type: 'fixe', 
        montant_defaut: 0,
        metric_key: '',
        conditions: [{ seuil: 0, montant: 0 }] 
      }]
    }));
  };

  const addExtraCondition = (primeId) => {
    setData(prev => ({
      ...prev,
      primes_additionnelles: prev.primes_additionnelles.map(p => 
        p.id === primeId ? { ...p, conditions: [...(p.conditions || []), { seuil: 0, montant: 0 }] } : p
      )
    }));
  };

  const updateExtraCondition = (primeId, condIndex, field, value) => {
    setData(prev => ({
      ...prev,
      primes_additionnelles: prev.primes_additionnelles.map(p => {
        if (p.id !== primeId) return p;
        const newConds = [...(p.conditions || [])];
        newConds[condIndex] = { ...newConds[condIndex], [field]: parseFloat(value) || 0 };
        return { ...p, conditions: newConds };
      })
    }));
  };

  const removeExtraCondition = (primeId, condIndex) => {
    setData(prev => ({
      ...prev,
      primes_additionnelles: prev.primes_additionnelles.map(p => 
        p.id === primeId ? { ...p, conditions: p.conditions.filter((_, i) => i !== condIndex) } : p
      )
    }));
  };

  const removeExtraPrime = (id) => {
    setData(prev => ({
      ...prev,
      primes_additionnelles: prev.primes_additionnelles.filter(p => p.id !== id)
    }));
  };

  const updateExtraPrime = (id, field, value) => {
    setData(prev => ({
      ...prev,
      primes_additionnelles: prev.primes_additionnelles.map(p => 
        p.id === id ? { ...p, [field]: value } : p
      )
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
    <div className="gem-overlay" onClick={onClose}>
      <div className="gem-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gem-header">
          <div className="gem-title-row">
            <h2>Personnaliser la Grille d'Objectifs</h2>
            <button className="gem-btn-close" onClick={onClose} title="Fermer">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div className="gem-step-indicator">
            <span className={activeStep === 1 ? 'active' : ''} onClick={() => setActiveStep(1)}>1. Statuts</span>
            <span className={activeStep === 2 ? 'active' : ''} onClick={() => setActiveStep(2)}>2. Indicateurs</span>
            <span className={activeStep === 3 ? 'active' : ''} onClick={() => setActiveStep(3)}>3. Valeurs</span>
            <span className={activeStep === 4 ? 'active' : ''} onClick={() => setActiveStep(4)}>4. Paliers</span>
            <span className={activeStep === 5 ? 'active' : ''} onClick={() => setActiveStep(5)}>5. Tranches & Règles Spéciales</span>
          </div>
        </div>

        <div className="gem-body">
          {activeStep === 1 && (
            <div className="gem-step">
              <p className="gem-step-desc">Définissez les niveaux (ex: Standard, Confirmé) et leurs montants cibles (Prime de base).</p>
              <div className="gem-statuts-list">
                {data.statuts.map((s, i) => (
                  <div key={i} className="gem-row gem-row--statut">
                    <div className="gem-input-group">
                      <label>Libellé Niveau</label>
                      <input 
                        placeholder="Ex: Senior" 
                        value={s.nom} 
                        onChange={(e) => updateStatut(i, 'nom', e.target.value)} 
                      />
                    </div>
                    <div className="gem-input-group" style={{ flex: '0 0 140px' }}>
                      <label>Prime Base</label>
                      <input 
                        type="number"
                        placeholder="Ex: 1200" 
                        value={s.prime_brute} 
                        onChange={(e) => updateStatut(i, 'prime_brute', e.target.value)} 
                      />
                    </div>
                    <div className="gem-input-group" style={{ flex: '0 0 140px' }}>
                      <label>Super Bonus</label>
                      <input 
                        type="number"
                        placeholder="Ex: 500" 
                        value={s.montant_sb} 
                        onChange={(e) => updateStatut(i, 'montant_sb', e.target.value)} 
                      />
                    </div>
                    <button className="gem-btn-icon danger gem-mt-label" onClick={() => removeStatut(i)}>
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                ))}
              </div>
              <button className="btn gem-btn-outline" onClick={addStatut}>+ Ajouter un niveau</button>
            </div>
          )}

          {activeStep === 2 && (
            <div className="gem-step">
              <div className="gem-categories-mgmt">
                <h4 className="gem-mgmt-title">1. Définir les grandes catégories</h4>
                <p className="gem-step-desc">Regroupez vos indicateurs par thématique (ex: Productivité, Qualité).</p>
                
                <div className="gem-cat-add-form">
                  <input 
                    placeholder="Nom de la catégorie..." 
                    value={newCatName} 
                    onChange={(e) => setNewCatName(e.target.value)}
                  />
                  <button className="btn btn-primary gem-btn-sm" onClick={handleAddCategory}>Ajouter</button>
                </div>

                <div className="gem-cat-badges">
                  {data.categories.map(cat => (
                    <span key={cat} className="gem-cat-badge">
                      {cat} 
                      <i className="fa-solid fa-xmark" onClick={() => removeCategory(cat)}></i>
                    </span>
                  ))}
                </div>
              </div>

              <div className="gem-indicators-mgmt">
                <h4 className="gem-mgmt-title">2. Rattacher les indicateurs aux catégories</h4>
                
                {data.categories.length === 0 && (
                  <div className="gem-info-box">Veuillez d'abord créer au moins une catégorie ci-dessus.</div>
                )}

                {data.categories.map(cat => (
                  <div key={cat} className="gem-cat-group-box">
                    <div className="gem-cat-group-header">
                      <i className="fa-solid fa-folder-open"></i> {cat}
                    </div>
                    <div className="gem-cat-group-content">
                      {data.indicateurs.filter(i => i.categorie === cat).map(ind => (
                        <div key={ind.id} className="gem-row">
                          <div className="gem-input-group" style={{ flex: '1 1 300px' }}>
                            <label>Source de donnée (DW) & Nom</label>
                            <select 
                              value={ind.metric_key || ''} 
                              onChange={(e) => updateIndicator(ind.id, 'metric_key', e.target.value)}
                            >
                              <option value="">-- Choisir une métrique --</option>
                              {Object.entries(kpiRefs).map(([univers, list]) => (
                                <optgroup key={univers} label={univers}>
                                  {list.map(k => (
                                    <option key={`${univers}-${k.id || k.tech_key}`} value={k.tech_key}>
                                      {k.mapping_count > 0 ? '🔗 ' : '⚠️ '} 
                                      {k.libelle} 
                                      {k.mapping_count > 0 ? '' : ' (Non lié)'}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </div>

                          <div className="gem-input-group" style={{ flex: '0 0 150px' }}>
                            <label>Comportement</label>
                            <select 
                              value={ind.type_ponderation || 'bonus'} 
                              onChange={(e) => updateIndicator(ind.id, 'type_ponderation', e.target.value)}
                            >
                              <option value="bonus">💰 Bonus (Pts)</option>
                              <option value="malus">📉 Pénalité (Pts)</option>
                              <option value="eliminatoire">🚫 Éliminatoire</option>
                              <option value="coefficient">✖️ Global (%)</option>
                            </select>
                          </div>
                          
                          <div className="gem-input-group" style={{ flex: '0 0 80px' }}>
                            <label>{(ind.type_ponderation === 'eliminatoire' || ind.type_ponderation === 'coefficient') ? 'Impact' : 'Poids'}</label>
                            <input 
                              type="number"
                              placeholder="20" 
                              value={ind.poids} 
                              onChange={(e) => updateIndicator(ind.id, 'poids', e.target.value)} 
                            />
                          </div>

                          <div className="gem-input-group" style={{ flex: '0 0 100px' }}>
                            <label>Format</label>
                            <div className="gem-readonly-val">
                              {ind.type === 'pourcentage' ? '%' : ind.type === 'devise' ? 'DH/€' : 'Nb'}
                            </div>
                          </div>
                          <button className="gem-btn-icon danger gem-mt-label" onClick={() => removeIndicator(ind.id)}>
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      ))}
                      <button className="btn gem-btn-xs gem-btn-outline-alt" onClick={() => addIndicator(cat)}>
                        + Ajouter un indicateur dans {cat}
                      </button>
                    </div>
                  </div>
                ))}

                {/* Indicateurs orphelins */}
                {data.indicateurs.filter(i => !i.categorie || !data.categories.includes(i.categorie)).length > 0 && (
                  <div className="gem-cat-group-box warning">
                    <div className="gem-cat-group-header">Indicateurs sans catégorie</div>
                    <div className="gem-cat-group-content">
                      {data.indicateurs.filter(i => !i.categorie || !data.categories.includes(i.categorie)).map(ind => (
                        <div key={ind.id} className="gem-row">
                          <div className="gem-readonly-val" style={{ flex: 1 }}>{ind.nom || 'Sans nom'}</div>
                          <select 
                            value={ind.categorie} 
                            onChange={(e) => updateIndicator(ind.id, 'categorie', e.target.value)}
                            style={{ flex: 1 }}
                          >
                            <option value="">Rattacher à...</option>
                            {data.categories.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <button className="gem-btn-icon danger" onClick={() => removeIndicator(ind.id)}>
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
            <div className="gem-step overflow-auto">
              <p className="gem-step-desc">Saisissez les valeurs cibles pour chaque statut.</p>
              <table className="gem-preview-table">
                <thead>
                  <tr>
                    <th>Statut</th>
                    {data.indicateurs.map(ind => (
                      <th key={ind.id}>
                        <div className="gem-th-stack">
                          <span className="gem-th-name">{ind.nom}</span>
                          <span className={`gem-th-type tag-${ind.type_ponderation || 'bonus'}`}>
                            {ind.type_ponderation === 'eliminatoire' ? 'BLOQUANT' : 
                             ind.type_ponderation === 'coefficient' ? 'COEFF %' : 
                             ind.type_ponderation === 'malus' ? 'PENALITÉ' : 'BONUS'}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.statuts.map((s, si) => (
                    <tr key={si}>
                      <td className="font-bold">{s.nom || `Statut ${si+1}`}</td>
                      {data.indicateurs.map(ind => (
                        <td key={ind.id}>
                          <div className="gem-cell-wrapper">
                            <input 
                              className="gem-cell-input"
                              placeholder={ind.type_ponderation === 'eliminatoire' ? 'Min' : 'Obj.'}
                              value={s.cibles[ind.id] || ''} 
                              onChange={(e) => updateCible(si, ind.id, e.target.value)}
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
          )}

          {activeStep === 4 && (
            <div className="gem-step">
              <h4 className="gem-mgmt-title">Définir les paliers de versement</h4>
              <div className="gem-info-box gem-info-box--blue" style={{ marginBottom: '20px' }}>
                <i className="fa-solid fa-circle-info"></i>
                <p>
                  Les paliers évaluent la performance globale (la somme pondérée des indicateurs de type Bonus/Malus).<br/>
                  <strong>Si vous souhaitez uniquement déclencher des montants selon des tranches (ex: tranches de CA), laissez ces paliers de côté et passez à l'étape suivante.</strong>
                </p>
              </div>

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
                            <button type="button" className="gem-btn-icon danger" onClick={() => removePalier(p.id)}>
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

              <button className="btn gem-btn-outline" onClick={addPalier} type="button">
                <i className="fa-solid fa-plus"></i> Ajouter un palier
              </button>

              <div className="gem-info-box gem-info-box--blue gem-mt-20">
                <i className="fa-solid fa-circle-info"></i>
                <p>Exemple : un palier à <strong>85%</strong> avec <strong>50%</strong> des points signifie que l'agent obtient la moitié des points prévus pour ce KPI s'il se situe entre 85% et le seuil suivant.</p>
              </div>
            </div>
          )}

          {activeStep === 5 && (
            <div className="gem-step">
              <h4 className="gem-mgmt-title">Configuration des Primes Additionnelles</h4>
              <p className="gem-step-desc">Ajoutez des primes spécifiques (fixes, manuelles ou basées sur l'atteinte d'un indicateur).</p>
              
              <div className="gem-extra-primes-list">
                {data.primes_additionnelles.length === 0 && (
                  <div className="gem-info-box">Aucune prime additionnelle configurée. Cliquez sur le bouton ci-dessous pour en ajouter une.</div>
                )}
                
                {data.primes_additionnelles.map((p) => (
                  <div key={p.id} className="gem-extra-prime-card">
                    <div className="gem-row">
                      <div className="gem-input-group">
                        <label>Nom de la prime</label>
                        <input 
                          placeholder="Ex: Prime Challenge" 
                          value={p.nom} 
                          onChange={(e) => updateExtraPrime(p.id, 'nom', e.target.value)} 
                        />
                      </div>
                      <div className="gem-input-group" style={{ flex: '0 0 220px' }}>
                        <label>Type d'attribution</label>
                        <select value={p.type} onChange={(e) => updateExtraPrime(p.id, 'type', e.target.value)}>
                          <option value="fixe">Fixe (Par défaut)</option>
                          <option value="conditionnelle">Conditionnelle (Calculée)</option>
                          <option value="manuel">Saisie Manuelle (Agent)</option>
                        </select>
                      </div>
                      <button className="gem-btn-icon danger gem-mt-label" onClick={() => removeExtraPrime(p.id)}>
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
                            onChange={(e) => updateExtraPrime(p.id, 'montant_defaut', parseFloat(e.target.value) || 0)} 
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
                          <select 
                            value={p.metric_key || ''} 
                            onChange={(e) => updateExtraPrime(p.id, 'metric_key', e.target.value)}
                          >
                            <option value="">-- Choisir un indicateur --</option>
                            {Object.entries(kpiRefs).map(([univers, list]) => (
                              <optgroup key={univers} label={univers}>
                                {list.map(k => (
                                  <option key={k.tech_key} value={k.tech_key}>{k.libelle}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
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
                                onChange={(e) => updateExtraCondition(p.id, cIdx, 'seuil', e.target.value)}
                              />
                              <span className="gem-cond-txt">alors +</span>
                              <input 
                                type="number" 
                                placeholder="Valeur" 
                                value={c.montant} 
                                style={{ width: '80px' }}
                                onChange={(e) => updateExtraCondition(p.id, cIdx, 'montant', e.target.value)}
                              />
                              <select 
                                value={c.type_montant || 'fixe'} 
                                onChange={(e) => updateExtraCondition(p.id, cIdx, 'type_montant', e.target.value)}
                                style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #3b3b4f', background: '#13131f', color: '#fff' }}
                              >
                                <option value="fixe">DH</option>
                                <option value="pourcentage">% du réel</option>
                              </select>
                              <button className="gem-btn-icon danger btn-xs" onClick={() => removeExtraCondition(p.id, cIdx)}>
                                <i className="fa-solid fa-times"></i>
                              </button>
                            </div>
                          ))}
                          <button className="btn gem-btn-xs gem-btn-outline" onClick={() => addExtraCondition(p.id)}>
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
              
              <button className="btn gem-btn-outline" onClick={addExtraPrime} type="button">
                <i className="fa-solid fa-plus"></i> Ajouter une règle spéciale / tranche
              </button>
            </div>
          )}
        </div>

        <div className="gem-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i> Annuler
          </button>
          {activeStep > 1 && (
            <button className="btn gem-btn-outline" onClick={() => setActiveStep(activeStep - 1)}>
              <i className="fa-solid fa-arrow-left"></i> Précédent
            </button>
          )}
          {activeStep < 5 ? (
            <button className="btn btn-primary" onClick={() => setActiveStep(activeStep + 1)}>
              Suivant <i className="fa-solid fa-arrow-right"></i>
            </button>
          ) : (
            <button className="btn btn-success" onClick={handleFinalSave}>
              <i className="fa-solid fa-check"></i> Enregistrer la grille
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
