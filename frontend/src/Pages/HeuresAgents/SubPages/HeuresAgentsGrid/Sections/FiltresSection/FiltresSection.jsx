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
    borderColor: state.isFocused ? 'var(--color-accent)' : 'var(--color-light-border)',
    boxShadow: state.isFocused ? '0 0 0 1px var(--color-accent)' : 'none',
    '&:hover': {
      borderColor: state.isFocused ? 'var(--color-accent)' : 'var(--color-light-border-subtle)',
    },
    background: 'var(--color-light-surface)',
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
    color: state.isSelected ? '#ffffff' : 'var(--color-light-text-primary)',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    '&:active': {
      backgroundColor: 'var(--color-accent)',
    }
  }),
  placeholder: (base) => ({
    ...base,
    color: 'var(--color-light-text-muted)',
  }),
  singleValue: (base) => ({
    ...base,
    color: 'var(--color-light-text-primary)',
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-light-md)',
    background: 'var(--color-light-surface)',
    border: '1px solid var(--color-light-border)',
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

  const optionsProjets = [
    { value: '', label: 'Tous les projets' },
    ...projets.map(p => ({ value: p, label: p }))
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
        <Select
          placeholder="Tous les projets"
          options={optionsProjets}
          styles={customSelectStyles}
          value={optionsProjets.find(opt => opt.value === projet)}
          onChange={opt => setProjet(opt ? opt.value : '')}
          isClearable
          className="ha-filtres__react-select"
        />
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
