/*
 * Fichier : DateRangePicker.jsx
 * Rôle    : Composant global de sélection de plage de dates.
 *           Combine un calendrier double et des champs de saisie manuelle.
 * Module  : mypaie / Components / DateRangePicker
 */

import { useState, useEffect } from 'react'
import DatePicker, { registerLocale } from 'react-datepicker'
import fr from 'date-fns/locale/fr'
import 'react-datepicker/dist/react-datepicker.css'
import './DateRangePicker.css'

registerLocale('fr', fr)

/**
 * @param {Date} startDate - Date de début
 * @param {Date} endDate - Date de fin
 * @param {Function} onChange - Callback ( { start, end } )
 * @param {string} placeholder - Texte de remplacement pour l'input
 */
function DateRangePicker({ startDate, endDate, onChange, placeholder = "Sélectionner une période" }) {
  
  const [internalStart, setInternalStart] = useState(startDate)
  const [internalEnd, setInternalEnd] = useState(endDate)

  // Synchronisation avec les props
  useEffect(() => {
    setInternalStart(startDate)
    setInternalEnd(endDate)
  }, [startDate, endDate])

  const handleCalendarChange = (dates) => {
    const [start, end] = dates
    setInternalStart(start)
    setInternalEnd(end)
    if (onChange) onChange({ start, end })
  }

  const handleManualChange = (type, value) => {
    const date = value ? new Date(value) : null
    if (isNaN(date?.getTime()) && value !== '') return

    let newStart = internalStart
    let newEnd = internalEnd

    if (type === 'start') newStart = date
    else newEnd = date

    setInternalStart(newStart)
    setInternalEnd(newEnd)
    if (onChange) onChange({ start: newStart, end: newEnd })
  }

  const formatDateForInput = (date) => {
    if (!date) return ''
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return (
    <div className="dr-picker">
      <DatePicker
        selected={internalStart}
        onChange={handleCalendarChange}
        startDate={internalStart}
        endDate={internalEnd}
        selectsRange
        monthsShown={2}
        locale="fr"
        dateFormat="dd/MM/yyyy"
        placeholderText={placeholder}
        className="dr-picker__input"
        isClearable
        maxDate={new Date()}
        portalId="root-portal"
        formatWeekDay={nameOfDay => nameOfDay.substr(0, 2).toUpperCase()}
      >
        {/* Zone de saisie manuelle en bas du calendrier */}
        <div className="dr-picker__footer">
          <div className="dr-picker__manual">
            <div className="dr-picker__manual-field">
              <span>DU</span>
              <input 
                type="date" 
                value={formatDateForInput(internalStart)}
                onChange={(e) => handleManualChange('start', e.target.value)}
              />
            </div>
            <span className="dr-picker__manual-sep">→</span>
            <div className="dr-picker__manual-field">
              <span>AU</span>
              <input 
                type="date" 
                value={formatDateForInput(internalEnd)}
                onChange={(e) => handleManualChange('end', e.target.value)}
              />
            </div>
          </div>
        </div>
      </DatePicker>
      <i className="fa-solid fa-calendar-days dr-picker__icon" />
    </div>
  )
}

export default DateRangePicker
