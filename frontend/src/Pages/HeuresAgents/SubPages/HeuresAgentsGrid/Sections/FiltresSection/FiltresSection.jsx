/*
 * Fichier : FiltresSection.jsx
 * Rôle    : Section de filtrage des heures agents — date début/fin, matricule, équipe.
 *           Émet les filtres au parent via callback onApply.
 * Module  : mypaie / Pages / HeuresAgents / Sections
 */

// #region IMPORTS
import { useState } from 'react'
import Select from 'react-select'
import DateRangePicker from '../../../../../../Components/DateRangePicker/DateRangePicker'
// #endregion

// #region HELPERS
const formatDate = (date) => {
  if (!date) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const parseDate = (str) => str ? new Date(str) : null
// #endregion

// #region STYLES REACT-SELECT
const customSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '38px',
    borderRadius: 'var(--radius-sm)',
    borderColor: state.isFocused ? 'var(--color-accent)' : 'var(--color-border)',
    boxShadow: state.isFocused ? '0 0 0 1px var(--color-accent)' : 'none',
    '&:hover': {
      borderColor: state.isFocused ? 'var(--color-accent)' : 'var(--color-border-subtle)',
    },
    background: 'var(--color-surface)',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-sm)',
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected 
      ? 'var(--color-accent)' 
      : state.isFocused 
        ? 'var(--color-accent-soft)' 
        : 'transparent',
    color: state.isSelected ? '#ffffff' : 'var(--color-text-primary)',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    '&:active': {
      backgroundColor: 'var(--color-accent)',
    }
  }),
  placeholder: (base) => ({
    ...base,
    color: 'var(--color-text-muted)',
  }),
  singleValue: (base) => ({
    ...base,
    color: 'var(--color-text-primary)',
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-md)',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
  })
}
// #endregion

// #region COMPOSANT
/**
 * Section de filtres — permet de sélectionner la plage de dates,
 * l'équipe et le projet avant de lancer la requête API.
 */
function FiltresSection({ equipes = [], projets = [], onApply, loading = false, defaultDateDebut = '', defaultDateFin = '' }) {

  // #region STATE
  const [startDate, setStartDate] = useState(parseDate(defaultDateDebut))
  const [endDate,   setEndDate]   = useState(parseDate(defaultDateFin))
  const [equipe,    setEquipe]    = useState('')
  const [projet,    setProjet]    = useState('')
  // #endregion

  // #region OPTIONS
  const optionsEquipes = [
    { value: '', label: 'Toutes les équipes' },
    ...equipes.map(eq => ({ value: eq, label: eq }))
  ]
  // #endregion

  // #region HANDLERS
  function handleApply(e) {
    if (e) e.preventDefault()
    onApply({ 
      dateDebut: formatDate(startDate), 
      dateFin: formatDate(endDate), 
      equipe, 
      projet 
    })
  }

  function handleReset() {
    setStartDate(parseDate(defaultDateDebut))
    setEndDate(parseDate(defaultDateFin))
    setEquipe('')
    setProjet('')
    onApply({ 
      dateDebut: defaultDateDebut, 
      dateFin: defaultDateFin, 
      equipe: '', 
      projet: '' 
    })
  }

  const handleDateChange = ({ start, end }) => {
    setStartDate(start)
    setEndDate(end)
  }
  // #endregion

  // #region RENDERING
  return (
    <form className="ha-filtres" onSubmit={handleApply} noValidate>

      <div className="ha-filtres__groupe ha-filtres__groupe--range">
        <label className="ha-filtres__label">Période</label>
        <DateRangePicker 
          startDate={startDate}
          endDate={endDate}
          onChange={handleDateChange}
        />
      </div>

      <div className="ha-filtres__groupe">
        <label className="ha-filtres__label">Projet</label>
        <div className="ha-filtres__input-wrapper">
          <input
            type="text"
            className="ha-filtres__input"
            placeholder="Rechercher un projet..."
            value={projet}
            onChange={(e) => setProjet(e.target.value)}
          />
          {projet && (
            <button 
              type="button" 
              className="ha-filtres__clear-btn" 
              onClick={() => setProjet('')}
              title="Effacer la recherche"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>
      </div>

      <div className="ha-filtres__groupe">
        <label className="ha-filtres__label">Équipe</label>
        <Select
          placeholder="Toutes les équipes"
          options={optionsEquipes}
          styles={customSelectStyles}
          value={optionsEquipes.find(opt => opt.value === equipe)}
          onChange={opt => setEquipe(opt ? opt.value : '')}
          isClearable
          className="ha-filtres__react-select"
        />
      </div>

      <div className="ha-filtres__actions">
        <button
          type="submit"
          className="ha-filtres__btn ha-filtres__btn--apply"
          disabled={loading}
        >
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          Appliquer
        </button>
        <button
          type="button"
          className="ha-filtres__btn ha-filtres__btn--reset"
          onClick={handleReset}
          disabled={loading}
        >
          <i className="fa-solid fa-rotate-left" aria-hidden="true" />
          Réinitialiser
        </button>
      </div>

    </form>
  )
  // #endregion
}

export default FiltresSection
