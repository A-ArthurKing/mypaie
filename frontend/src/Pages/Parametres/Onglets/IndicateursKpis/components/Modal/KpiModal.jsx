import React from 'react'
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
  customSelectStyles
}) {
  if (!showModal) return null

  return (
    <div className="kr-modal-overlay" onClick={() => setShowModal(false)}>
      <div className="kr-modal" onClick={e => e.stopPropagation()}>
        <div className="kr-modal-header">
          <h3>{editingKpi ? `Modifier ${editingKpi.code}` : (activeTab === 'VIRTUAL' ? 'Nouveau KPI Virtuel' : 'Normaliser un indicateur BigQuery')}</h3>
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
        </div>
        
        <div className="kr-modal-body">
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
                    options={rawBqCodes
                      .filter(c => modalUniversFilter === 'ALL' || c.univers === modalUniversFilter)
                      .map(c => ({
                        value: c.kpi_code,
                        label: `${c.kpi_code} (${c.univers})`,
                        ...c
                      }))}
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
              <div className="kr-form-group">
                <label>Formule de calcul (Briques normalisées)</label>
                <div className="kr-formula-editor">
                  <textarea 
                    value={formData.formule} 
                    onChange={e => setFormData({...formData, formule: e.target.value})}
                    placeholder="Ex: [NB_VENTES] / [NB_APPELS]"
                    rows={4}
                  />
                </div>
                <small className="kr-form-help">
                  Utilisez les indicateurs à droite pour construire votre formule.
                </small>
              </div>
            )}

            <div className="kr-modal-footer">
              <button type="button" className="kr-btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
              <button type="submit" className="kr-btn-primary" disabled={submitting}>
                {submitting ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>

          <div className="kr-formula-help-panel">
            <div className="kr-help-header">
              <i className="fa-solid fa-layer-group" />
              <span>{activeTab === 'VIRTUAL' ? 'Briques Disponibles' : 'Indicateurs existants'}</span>
            </div>
            <div className="kr-help-list">
              {Object.entries(UNIVERS_LABELS).map(([univ, label]) => {
                const items = kpis.filter(k => k.univers === univ && k.code !== formData.code);
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
                        <span className="kr-help-item__type">{k.type === 'VIRTUAL' ? 'V' : 'N'}</span>
                      </button>
                    ))}
                  </React.Fragment>
                );
              })}
            </div>
            {activeTab === 'VIRTUAL' && (
              <div className="kr-help-operators">
                <label>Opérateurs</label>
                <div className="kr-operator-grid">
                  {['+', '-', '*', '/', '(', ')'].map(op => (
                    <button key={op} type="button" onClick={() => setFormData(p => ({...p, formule: (p.formule || '') + op}))}>
                      {op}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
