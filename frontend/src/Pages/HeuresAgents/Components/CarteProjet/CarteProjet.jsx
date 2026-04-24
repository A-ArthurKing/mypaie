/*
 * Fichier : CarteProjet.jsx
 * Rôle    : Carte résumé d'un projet — stats clés uniquement.
 *           Un clic sur la carte navigue vers le détail du projet.
 * Module  : mypaie / Pages / HeuresAgents / Components
 */

// #region IMPORTS
import { memo } from 'react'
import './CarteProjet.css'
// #endregion

// #region HELPERS
// Conversion des millisecondes en "Xh YYm"
function msEnHeures(ms) {
  if (!ms && ms !== 0) return '—'
  const totalMin = Math.round(Number(ms) / 60000)
  if (isNaN(totalMin)) return '—'
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}
// #endregion

// #region COMPOSANT
const CarteProjet = memo(function CarteProjet({ projet, agents, totalHt, totalHp, totalHeures, onSelect }) {
  return (
    <button className="carte-projet" onClick={() => onSelect(projet)} type="button">

      {/* ── En-tête ── */}
      <div className="carte-projet__header">
        <div className="carte-projet__header-left">
          <i className="fa-solid fa-folder-open carte-projet__icon" aria-hidden="true" />
          <span className="carte-projet__nom">{projet}</span>
        </div>
        <div className="carte-projet__header-right">
          <span className="carte-projet__badge">
            <i className="fa-solid fa-users" aria-hidden="true" />
            {agents.length}
          </span>
          <i className="fa-solid fa-chevron-right carte-projet__arrow" aria-hidden="true" />
        </div>
      </div>

      {/* ── Stats clés (Dashboard KPI Style) ── */}
      <div className="carte-projet__body">
        <div className="carte-projet__main-stats">
          <div className="carte-projet__kpi">
            <span className="carte-projet__kpi-label">Prévues</span>
            <span className="carte-projet__kpi-value">{msEnHeures(totalHt)}</span>
          </div>
          <div className="carte-projet__kpi-sep" />
          <div className="carte-projet__kpi">
            <span className="carte-projet__kpi-label">Travaillées</span>
            <span className="carte-projet__kpi-value">{msEnHeures(totalHp)}</span>
          </div>
        </div>

        <div className="carte-projet__footer-stat">
          <div className="carte-projet__total-pill">
            <span className="carte-projet__total-label">Total projet</span>
            <span className="carte-projet__total-value">{msEnHeures(totalHeures)}</span>
          </div>
        </div>
      </div>

    </button>
  )
})
// #endregion

export default CarteProjet
