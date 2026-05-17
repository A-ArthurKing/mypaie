import React from 'react'
import Select from 'react-select'
import './KpiHeader.css'

export default function KpiHeader({
  handleOpenAdd,
  handleSyncGold,
  syncing,
  filterText,
  setFilterText,
  filterUnivers,
  setFilterUnivers,
  UNIVERS_LABELS,
  customSelectStyles
}) {
  return (
    <div className="kr-header">
      <div className="kr-header__icon">
        <i className="fa-solid fa-sliders" />
      </div>
      <div className="kr-header__text">
        <h2 className="kr-header__title">Dictionnaire des KPIs</h2>
        <p className="kr-header__desc">
          Base de données applicative des indicateurs découverts par l'ETL.
        </p>
      </div>
      <div className="kr-header__actions">
        <button className="kr-add-btn" onClick={() => handleOpenAdd('VIRTUAL')}>
          <i className="fa-solid fa-plus-circle" style={{ marginRight: '6px' }}></i>
          Nouveau KPI Virtuel
        </button>

        <button className="kr-norm-btn" onClick={() => handleOpenAdd('NATIVE')}>
          <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: '6px' }}></i>
          Normaliser BigQuery
        </button>

        <button className="kr-sync-btn" onClick={handleSyncGold} disabled={syncing}>
          <i className={`fa-solid fa-rotate ${syncing ? 'fa-spin' : ''}`} style={{ marginRight: '6px' }}></i>
          {syncing ? 'Découverte...' : 'Sync BigQuery'}
        </button>
        
        <div className="kr-filter-wrapper">
          <i className="fa-solid fa-magnifying-glass" />
          <input
            className="kr-filter-input"
            type="text"
            placeholder="Filtrer..."
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
          />
        </div>
        
        <Select
          options={[
            { value: 'ALL', label: 'Tous les univers' },
            ...Object.entries(UNIVERS_LABELS).map(([k, v]) => ({ value: k, label: v }))
          ]}
          value={{ value: filterUnivers, label: filterUnivers === 'ALL' ? 'Tous les univers' : UNIVERS_LABELS[filterUnivers] }}
          onChange={opt => setFilterUnivers(opt.value)}
          styles={{
            ...customSelectStyles,
            control: (base, state) => ({
              ...base,
              ...customSelectStyles.control(base, state),
              minHeight: '34px',
              width: '180px',
              borderWidth: '1px'
            })
          }}
          isSearchable={false}
        />
      </div>
    </div>
  )
}
