import React, { useState, useEffect, useMemo } from 'react'
import Select from 'react-select'
import './KpiModal.css'

export default function KpiModal({
  showModal,
  setShowModal,
  editingKpi,
  activeTab,
  setActiveTab,
  formData,
  setFormData,
  handleSubmit,
  submitting,
  rawBqCodes,
  modalUniversFilter,
  setModalUniversFilter,
  isAiSuggesting,
  fetchAiSuggestion,
  aiLastSuggestion,
  setAiLastSuggestion,
  insertTag,
  kpis,
  UNIVERS_LABELS,
  customSelectStyles,
  aliases = [],
  aliasFormData = {},
  setAliasFormData,
  handleAliasSubmit,
  handleAliasDelete,
  unmappedCodes = [],
  editInitialBuilderState = null
}) {
  const [virtualMode, setVirtualMode] = useState('ASSISTED');
  const [builderProject, setBuilderProject] = useState('');
  const [builderSelected, setBuilderSelected] = useState([]);
  const [builderMaxScore, setBuilderMaxScore] = useState('');

  const [builderUnivers, setBuilderUnivers] = useState('');
  const [builderSearch, setBuilderSearch] = useState('');
  const [builderOperation, setBuilderOperation] = useState('SUM');
  const [helpSearch, setHelpSearch] = useState('');

  // Initialize builder state when opening modal
  useEffect(() => {
    if (showModal) {
      if (editInitialBuilderState) {
        setVirtualMode(editInitialBuilderState.virtualMode || 'ASSISTED');
        setBuilderSelected(editInitialBuilderState.builderSelected || []);
        setBuilderMaxScore(editInitialBuilderState.builderMaxScore || '');
        setBuilderOperation(editInitialBuilderState.builderOperation || 'SUM');
        
        // Try to guess the universe/project based on the first KPI
        if (editInitialBuilderState.builderSelected && editInitialBuilderState.builderSelected.length > 0) {
           const firstKpi = editInitialBuilderState.builderSelected[0];
           const matchInfo = rawBqCodes?.find(r => r.kpi_code === firstKpi);
           if (matchInfo) {
              setBuilderUnivers(matchInfo.univers);
              setBuilderProject(`proj:${matchInfo.projet}|${matchInfo.univers}`);
           } else {
              setBuilderUnivers('');
              setBuilderProject('');
           }
        } else {
           setBuilderUnivers('');
           setBuilderProject('');
        }
      } else {
        setVirtualMode('ASSISTED');
        setBuilderUnivers('');
        setBuilderProject('');
        setBuilderSelected([]);
        setBuilderMaxScore('');
        setBuilderOperation('SUM');
        setBuilderSearch('');
        setHelpSearch('');
      }
    }
  }, [showModal, editInitialBuilderState, rawBqCodes]);

  const uniqueProjectsByUnivers = useMemo(() => {
    if (!rawBqCodes) return {};
    const grouped = {};
    rawBqCodes.forEach(r => {
      if (!r.univers || !r.projet) return;
      if (!grouped[r.univers]) grouped[r.univers] = new Set();
      grouped[r.univers].add(r.projet);
    });
    return grouped;
  }, [rawBqCodes]);

  const universOptions = useMemo(() => {
    return Object.keys(uniqueProjectsByUnivers).sort().map(u => ({
      value: u, label: UNIVERS_LABELS[u] || u
    }));
  }, [uniqueProjectsByUnivers, UNIVERS_LABELS]);

  const projectOptions = useMemo(() => {
    if (!builderUnivers || !uniqueProjectsByUnivers[builderUnivers]) return [];
    return Array.from(uniqueProjectsByUnivers[builderUnivers]).sort().map(p => ({
      value: p, label: p
    }));
  }, [builderUnivers, uniqueProjectsByUnivers]);

  const availableKpisForProject = useMemo(() => {
    if (!builderUnivers || !rawBqCodes) return [];
    let filtered = rawBqCodes.filter(r => r.univers === builderUnivers);
    if (builderProject) {
      filtered = filtered.filter(r => r.projet === builderProject);
    }
    return Array.from(new Set(filtered.map(r => r.kpi_code))).sort();
  }, [rawBqCodes, builderUnivers, builderProject]);

  useEffect(() => {
    if (activeTab === 'VIRTUAL' && virtualMode === 'ASSISTED') {
      if (builderSelected.length === 0) {
        setFormData(prev => ({ ...prev, formule: '' }));
        return;
      }
      const sumStr = builderSelected.map(code => `[${code}]`).join(' + ');
      let baseFormula = sumStr;

      if (builderOperation === 'AVG') {
        baseFormula = `(${sumStr}) / ${builderSelected.length}`;
      }

      let formula = baseFormula;
      const max = parseFloat(builderMaxScore);
      if (!isNaN(max) && max > 0) {
        // Ajouter la conversion sur la baseFormula
        formula = `((${baseFormula}) / ${max}) * 100`;
      }
      setFormData(prev => ({ ...prev, formule: formula }));
    }
  }, [builderSelected, builderMaxScore, builderOperation, activeTab, virtualMode, setFormData]);

  const toggleBuilderKpi = (code) => {
    setBuilderSelected(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  if (!showModal) return null

  const officialOptions = kpis.map(k => ({
    value: k.code,
    label: `${k.libelle} (${k.code})`
  }));

  const unmappedOptions = unmappedCodes.map(u => ({
    value: u.code,
    label: `${u.code} (Projet: ${u.projet})`,
    projet: u.projet
  }));

  return (
    <div className="kr-modal-overlay" onClick={() => setShowModal(false)}>
      <div className="kr-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: activeTab === 'ALIAS' ? '700px' : undefined }}>
        <div className="kr-modal-header">
          <h3>{editingKpi ? `Modifier ${editingKpi.code}` : (activeTab === 'VIRTUAL' ? 'Nouveau KPI Virtuel' : activeTab === 'ALIAS' ? 'Rattachement / Alias MDM' : 'Normaliser un indicateur BigQuery')}</h3>
          <button className="kr-modal-close" onClick={() => setShowModal(false)}>&times;</button>
        </div>

        <div className="kr-modal-tabs">
          <button 
            className={`kr-tab-btn ${activeTab === 'NORMALIZATION' ? 'active' : ''}`}
            onClick={() => { setActiveTab('NORMALIZATION'); setFormData({...formData, type: 'NATIVE', formule: ''}) }}
            disabled={!!editingKpi && editingKpi.type === 'VIRTUAL'}
          >
            <i className="fa-solid fa-database" /> Normalisation BigQuery
          </button>
          <button 
            className={`kr-tab-btn ${activeTab === 'VIRTUAL' ? 'active' : ''}`}
            onClick={() => { setActiveTab('VIRTUAL'); setFormData({...formData, type: 'VIRTUAL'}) }}
            disabled={!!editingKpi && editingKpi.type === 'NATIVE'}
          >
            <i className="fa-solid fa-calculator" /> Création Virtuelle
          </button>
          <button 
            className={`kr-tab-btn ${activeTab === 'ALIAS' ? 'active' : ''}`}
            onClick={() => setActiveTab('ALIAS')}
            disabled={!!editingKpi}
          >
            <i className="fa-solid fa-code-merge" /> Rattachement
          </button>
        </div>
        
        <div className="kr-modal-body">
          {activeTab !== 'ALIAS' ? (
            <form onSubmit={handleSubmit} className="kr-modal-form">
            
            {activeTab === 'NORMALIZATION' && (
              <>
                <div className="kr-form-group">
                  <label>Filtrer par Univers BigQuery</label>
                  <Select
                    options={[
                      { value: 'ALL', label: 'Tous les univers' },
                      ...Object.entries(UNIVERS_LABELS).map(([k, v]) => ({ value: k, label: v }))
                    ]}
                    value={{ value: modalUniversFilter, label: modalUniversFilter === 'ALL' ? 'Tous les univers' : UNIVERS_LABELS[modalUniversFilter] }}
                    onChange={opt => setModalUniversFilter(opt.value)}
                    styles={customSelectStyles}
                    isSearchable={false}
                    isDisabled={!!editingKpi}
                  />
                </div>

                <div className="kr-form-group">
                  <label>Code Technique (Source BigQuery)</label>
                  <Select
                    options={Array.from(new Map(rawBqCodes
                      .filter(c => modalUniversFilter === 'ALL' || c.univers === modalUniversFilter)
                      .map(c => [c.kpi_code, {
                        value: c.kpi_code,
                        label: `${c.kpi_code} (${c.univers})`,
                        ...c
                      }])
                    ).values())}
                    value={formData.code ? { value: formData.code, label: formData.code } : null}
                    onChange={opt => {
                      setFormData({
                        ...formData,
                        code: opt.value,
                        univers: opt.univers,
                        libelle: 'Analyse IA en cours...'
                      })
                      fetchAiSuggestion(opt.value, opt.univers)
                    }}
                    styles={customSelectStyles}
                    placeholder={modalUniversFilter === 'ALL' ? "Sélectionnez d'abord un univers..." : "Rechercher un code technique..."}
                    isDisabled={!!editingKpi}
                    noOptionsMessage={() => "Aucun code trouvé dans cet univers"}
                  />
                </div>

                <div className="kr-form-group">
                  <label>
                    Codes BigQuery acceptés
                    <span className="kr-form-badge">Pipeline de données</span>
                  </label>
                  <input
                    type="text"
                    value={Array.isArray(formData.bq_kpi_codes) ? formData.bq_kpi_codes.join(', ') : (formData.bq_kpi_codes || '')}
                    onChange={e => {
                      const raw = e.target.value
                      const arr = raw.split(',').map(s => s.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')).filter(Boolean)
                      setFormData({ ...formData, bq_kpi_codes: arr })
                    }}
                    placeholder="ex: booking_nbr, nb_ventes, reservation_nbr"
                  />
                  <small className="kr-form-help">
                    <i className="fa-solid fa-circle-info" /> Codes <code>kpi_code</code> tels qu'ils existent dans BigQuery, séparés par des virgules. Ce KPI sera automatiquement inclus dans le pivot SQL.
                  </small>
                </div>

                <div className="kr-form-group">
                  <label>Agrégation BigQuery</label>
                  <div className="kr-radio-group">
                    <label className="kr-radio-option">
                      <input
                        type="radio"
                        name="bq_aggregation"
                        value="SUM"
                        checked={(formData.bq_aggregation || 'SUM') === 'SUM'}
                        onChange={() => setFormData({ ...formData, bq_aggregation: 'SUM' })}
                      />
                      <span><strong>SUM</strong> — Somme des valeurs sur la période</span>
                    </label>
                    <label className="kr-radio-option">
                      <input
                        type="radio"
                        name="bq_aggregation"
                        value="AVG"
                        checked={formData.bq_aggregation === 'AVG'}
                        onChange={() => setFormData({ ...formData, bq_aggregation: 'AVG' })}
                      />
                      <span><strong>AVG</strong> — Moyenne sur la période</span>
                    </label>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'VIRTUAL' && (
              <div className="kr-form-group">
                <label>Code Identifiant (Unique)</label>
                <input 
                  type="text" 
                  value={formData.code} 
                  onChange={e => setFormData({...formData, code: e.target.value.toUpperCase().replace(/\s/g, '_')})}
                  disabled={!!editingKpi}
                  placeholder="EX: SCORE_FINAL"
                  required
                />
              </div>
            )}

            <div className="kr-form-group">
              <label>
                Libellé Métier
                {isAiSuggesting && <span className="kr-ai-tag"><i className="fa-solid fa-wand-magic-sparkles fa-spin" /> IA</span>}
              </label>
              <input 
                type="text" 
                value={formData.libelle} 
                onChange={e => {
                  setFormData({...formData, libelle: e.target.value})
                  if (aiLastSuggestion && e.target.value !== aiLastSuggestion) {
                    setAiLastSuggestion(null)
                  }
                }}
                placeholder="EX: Taux de Conversion Global"
                disabled={isAiSuggesting}
                required
              />
              {!isAiSuggesting && activeTab === 'NORMALIZATION' && formData.code && aiLastSuggestion === formData.libelle && (
                <small className="kr-form-help">
                  <i className="fa-solid fa-check-circle" style={{ color: 'var(--color-success)' }} /> Nom optimisé par l'IA
                </small>
              )}
            </div>

            <div className="kr-form-group">
              <label>Description (Optionnel)</label>
              <textarea 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Brève description de l'indicateur..."
                rows={2}
              />
            </div>

            <div className="kr-form-group">
              <label>Univers</label>
              <Select
                options={Object.entries(UNIVERS_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                value={Object.entries(UNIVERS_LABELS).map(([k, v]) => ({ value: k, label: v })).find(o => o.value === formData.univers)}
                onChange={opt => setFormData({...formData, univers: opt.value})}
                styles={customSelectStyles}
                isSearchable={false}
              />
            </div>
            
            {activeTab === 'VIRTUAL' && (
              <div className="kr-virtual-modes">
                <div className="kr-virtual-subtabs">
                  <button 
                    type="button" 
                    className={`kr-subtab-btn ${virtualMode === 'ASSISTED' ? 'active' : ''}`} 
                    onClick={() => setVirtualMode('ASSISTED')}
                  >
                    <i className="fa-solid fa-wand-magic-sparkles"></i> Assisté (Cases à cocher)
                  </button>
                  <button 
                    type="button" 
                    className={`kr-subtab-btn ${virtualMode === 'MANUAL' ? 'active' : ''}`} 
                    onClick={() => setVirtualMode('MANUAL')}
                  >
                    <i className="fa-solid fa-keyboard"></i> Avancé (Formule libre)
                  </button>
                </div>

                {virtualMode === 'ASSISTED' ? (
                  <div className="kr-builder-panel">
                    <div className="kr-form-group">
                      <label>1. Filtrer par Univers (Obligatoire)</label>
                      <Select
                        options={universOptions}
                        value={universOptions.find(o => o.value === builderUnivers)}
                        onChange={opt => {
                          setBuilderUnivers(opt ? opt.value : '');
                          setBuilderProject('');
                          setBuilderSelected([]);
                        }}
                        placeholder="-- Sélectionner un Univers --"
                        styles={customSelectStyles}
                        isClearable
                      />
                    </div>

                    {builderUnivers && (
                      <div className="kr-form-group">
                        <label>2. Filtrer par Projet (Optionnel)</label>
                        <Select
                          options={projectOptions}
                          value={projectOptions.find(o => o.value === builderProject)}
                          onChange={opt => {
                            setBuilderProject(opt ? opt.value : '');
                            setBuilderSelected([]);
                          }}
                          placeholder="Tous les projets de cet univers..."
                          styles={customSelectStyles}
                          isClearable
                        />
                      </div>
                    )}
                    
                    {builderUnivers && (
                      <>
                        <div className="kr-form-group">
                          <label>3. Mode de calcul entre les critères</label>
                          <Select
                            options={[
                              { value: 'SUM', label: 'Additionner les critères (A + B)' },
                              { value: 'AVG', label: 'Faire la moyenne des critères ((A + B) / nb)' }
                            ]}
                            value={builderOperation === 'SUM' ? { value: 'SUM', label: 'Additionner les critères (A + B)' } : { value: 'AVG', label: 'Faire la moyenne des critères ((A + B) / nb)' }}
                            onChange={opt => setBuilderOperation(opt.value)}
                            styles={customSelectStyles}
                            isSearchable={false}
                          />
                        </div>

                        <div className="kr-form-group">
                          <label>4. Sélectionner les critères</label>
                          <div className="kr-builder-search-wrapper">
                            <i className="fa-solid fa-magnifying-glass"></i>
                            <input 
                              type="text" 
                              className="kr-input kr-builder-search"
                              placeholder="Rechercher un critère..."
                              value={builderSearch}
                              onChange={e => setBuilderSearch(e.target.value)}
                            />
                            {builderSearch && (
                              <button className="kr-builder-search-clear" type="button" onClick={() => setBuilderSearch('')}>
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            )}
                          </div>
                          <div className="kr-builder-checkboxes">
                            {availableKpisForProject
                              .filter(code => code.toLowerCase().includes(builderSearch.toLowerCase()))
                              .map(code => (
                              <label key={code} className="kr-builder-checkbox">
                                <input 
                                  type="checkbox" 
                                  checked={builderSelected.includes(code)}
                                  onChange={() => toggleBuilderKpi(code)}
                                />
                                {code}
                              </label>
                            ))}
                            {availableKpisForProject.length === 0 && (
                              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', gridColumn: '1 / -1' }}>Aucun critère trouvé.</span>
                            )}
                            {availableKpisForProject.length > 0 && availableKpisForProject.filter(code => code.toLowerCase().includes(builderSearch.toLowerCase())).length === 0 && (
                              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', gridColumn: '1 / -1' }}>Aucun critère ne correspond à "{builderSearch}".</span>
                            )}
                          </div>
                        </div>

                        <div className="kr-form-group">
                          <label>5. Score maximum (Optionnel - Pour conversion en %)</label>
                          <input 
                            type="number" 
                            className="kr-input"
                            value={builderMaxScore}
                            onChange={e => setBuilderMaxScore(e.target.value)}
                            placeholder="Ex: 25, 100"
                          />
                        </div>
                      </>
                    )}

                    <div className="kr-form-group">
                      <label>Formule générée automatiquement</label>
                      <textarea 
                        value={formData.formule} 
                        readOnly 
                        className="kr-readonly-formula"
                        placeholder="La formule apparaîtra ici..."
                        rows={3}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="kr-form-group">
                    <label>Formule de calcul (Briques normalisées)</label>
                    <div className="kr-formula-editor">
                      <textarea 
                        value={formData.formule} 
                        readOnly
                        placeholder="Cliquez sur les briques à droite et les opérateurs pour construire la formule"
                        rows={4}
                      />
                    </div>
                    <small className="kr-form-help">
                      Utilisez les indicateurs à droite et les opérateurs ci-dessous pour construire votre formule. Saisie directe désactivée pour éviter les erreurs.
                    </small>
                  </div>
                )}
              </div>
            )}

            <div className="kr-modal-footer">
              <button type="button" className="kr-btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
              <button type="submit" className="kr-btn-primary" disabled={submitting}>
                {submitting ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
          ) : (
            <form onSubmit={handleAliasSubmit} className="kr-modal-form">
              <div style={{ marginBottom: '15px', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                Associez un code brut détecté dans BigQuery à un KPI officiel pour centraliser les calculs.
              </div>

              <div className="kr-form-group">
                <label>1. Code brut non reconnu (BigQuery) <span className="kr-req">*</span></label>
                <Select
                  options={unmappedOptions}
                  value={unmappedOptions.find(o => o.value === aliasFormData.code_brut_source)}
                  onChange={opt => setAliasFormData(prev => ({ 
                    ...prev, 
                    code_brut_source: opt ? opt.value : '',
                    projet: opt ? opt.projet : 'INCONNU'
                  }))}
                  placeholder="-- Choisir l'anomalie --"
                  styles={customSelectStyles}
                  isClearable
                  isSearchable
                />
              </div>

              <div className="kr-form-group" style={{ marginTop: '10px' }}>
                <label>2. Cible : KPI Officiel (Dictionnaire) <span className="kr-req">*</span></label>
                <Select
                  options={officialOptions}
                  value={officialOptions.find(o => o.value === aliasFormData.code_kpi_officiel)}
                  onChange={opt => setAliasFormData(prev => ({ ...prev, code_kpi_officiel: opt ? opt.value : '' }))}
                  placeholder="-- Choisir le KPI officiel --"
                  styles={customSelectStyles}
                  isClearable
                  isSearchable
                />
              </div>

              <div className="kr-modal-footer" style={{ marginTop: 'auto', paddingTop: '20px' }}>
                <button 
                  type="submit" 
                  className="kr-btn-primary" 
                  disabled={submitting || !aliasFormData.code_brut_source || !aliasFormData.code_kpi_officiel}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <i className="fa-solid fa-link" /> {submitting ? 'Rattachement...' : 'Confirmer le rattachement'}
                </button>
              </div>
            </form>
          )}

          {activeTab !== 'ALIAS' ? (
            <div className="kr-formula-help-panel" style={{ display: (activeTab === 'VIRTUAL' && virtualMode === 'ASSISTED') ? 'none' : 'flex' }}>
              <div className="kr-help-header">
                <i className="fa-solid fa-layer-group" />
                <span>{activeTab === 'VIRTUAL' ? 'Briques Disponibles' : 'Indicateurs existants'}</span>
              </div>
              <div className="kr-help-search-wrapper">
                <i className="fa-solid fa-magnifying-glass"></i>
                <input 
                  type="text" 
                  className="kr-input kr-help-search"
                  placeholder="Rechercher..."
                  value={helpSearch}
                  onChange={e => setHelpSearch(e.target.value)}
                />
                {helpSearch && (
                  <button className="kr-help-search-clear" type="button" onClick={() => setHelpSearch('')}>
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </div>
              <div className="kr-help-list">
                {Object.entries(UNIVERS_LABELS).map(([univ, label]) => {
                  // Mêler KPIs normalisés et codes bruts BQ de cet univers
                  const officialItems = kpis.filter(k => k.univers === univ && k.code !== formData.code);
                  
                  // Extraire les codes BQ uniques de cet univers qui ne sont pas déjà dans la liste des KPIs officiels
                  const officialCodeSet = new Set(officialItems.map(k => k.code.toLowerCase()));
                  const rawItems = (rawBqCodes || [])
                    .filter(r => r.univers === univ)
                    .map(r => r.kpi_code)
                    .filter(code => !officialCodeSet.has(code.toLowerCase()))
                    .filter((value, index, self) => self.indexOf(value) === index) // deduplicate
                    .map(code => ({ code, libelle: `Source BQ brute (${univ})`, type: 'RAW' }));
                  
                  const items = [...officialItems, ...rawItems]
                    .sort((a, b) => a.code.localeCompare(b.code))
                    .filter(item => 
                       item.code.toLowerCase().includes(helpSearch.toLowerCase()) || 
                       item.libelle.toLowerCase().includes(helpSearch.toLowerCase())
                    );

                  if (items.length === 0) return null;
                  return (
                    <React.Fragment key={univ}>
                      <div className="kr-help-section-title">{label}</div>
                      {items.map(k => (
                        <button 
                          key={k.code} 
                          className={`kr-help-item kr-help-item--${k.type}`}
                          onClick={() => activeTab === 'VIRTUAL' && insertTag(k.code)}
                          style={{ cursor: activeTab === 'VIRTUAL' ? 'pointer' : 'default' }}
                          title={k.libelle}
                          type="button"
                        >
                          <span className="kr-help-item__code">{k.code}</span>
                          <span className="kr-help-item__type">{k.type === 'VIRTUAL' ? 'V' : k.type === 'RAW' ? 'BQ' : 'N'}</span>
                        </button>
                      ))}
                    </React.Fragment>
                  )
                })}
              </div>
              {activeTab === 'VIRTUAL' && virtualMode === 'MANUAL' && (
                <div className="kr-help-operators">
                  <label>Opérateurs</label>
                  <div className="kr-operator-grid">
                    {['+', '-', '*', '/', '(', ')'].map(op => (
                      <button key={op} type="button" onClick={() => setFormData(p => ({...p, formule: (p.formule || '') + op}))}>
                        {op}
                      </button>
                    ))}
                    <button 
                      type="button" 
                      onClick={() => setFormData(p => {
                        const f = p.formule || '';
                        if (f.endsWith(']')) {
                           const lastOpenIndex = f.lastIndexOf('[');
                           if (lastOpenIndex !== -1) {
                              return {...p, formule: f.slice(0, lastOpenIndex)};
                           }
                        }
                        return {...p, formule: f.slice(0, -1)};
                      })}
                      title="Effacer le dernier élément"
                      className="kr-op-backspace"
                    >
                      <i className="fa-solid fa-delete-left"></i>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="kr-formula-help-panel" style={{ backgroundColor: 'var(--color-bg-app)' }}>
              <div className="kr-help-header" style={{ color: 'var(--color-success)' }}>
                <i className="fa-solid fa-link" />
                <span>Alias Actifs ({aliases.length})</span>
              </div>
              <div className="kr-help-list">
                {aliases.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    Aucun alias configuré.
                  </div>
                ) : (
                  aliases.map(alias => (
                    <div key={alias.id} className="kr-help-item" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'monospace', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{alias.code_brut_source}</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--color-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}><i className="fa-solid fa-arrow-turn-down fa-rotate-270" style={{marginRight:'4px'}}></i>{alias.code_kpi_officiel}</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => handleAliasDelete(alias.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-error)', cursor: 'pointer', padding: '4px' }}
                        title="Supprimer"
                      >
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
