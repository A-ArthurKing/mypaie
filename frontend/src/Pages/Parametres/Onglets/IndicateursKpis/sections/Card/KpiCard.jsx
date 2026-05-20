import React from 'react'
import './KpiCard.css'

export default function KpiCard({ kpi, toggling, onToggle, onEdit, onDelete }) {
  const isActive = Boolean(kpi.actif)
  const isVirtual = kpi.type === 'VIRTUAL'

  return (
    <div className={`kr-kpi-card ${!isActive ? 'kr-kpi-card--inactive' : ''} ${isVirtual ? 'kr-kpi-card--virtual' : ''}`}>
      <div className="kr-kpi-card__header">
        <div className="kr-kpi-card__badges">
          <span className="kr-badge-code">{kpi.code}</span>
          <span className={`kr-badge-type kr-badge-type--${kpi.type}`}>
            {isVirtual ? <i className="fa-solid fa-calculator" /> : <i className="fa-solid fa-database" />}
            {isVirtual ? 'Virtuel' : 'Natif'}
          </span>
        </div>
        <div className="kr-kpi-card__actions">
          <button className="kr-action-btn" onClick={() => onEdit(kpi)} title="Modifier">
            <i className="fa-solid fa-pen-to-square" />
          </button>
          {isVirtual && (
            <button className="kr-action-btn kr-action-btn--danger" onClick={() => onDelete(kpi.code)} title="Supprimer">
              <i className="fa-solid fa-trash-can" />
            </button>
          )}
        </div>
      </div>

      <div className="kr-kpi-card__body">
        <h4 className="kr-kpi-card__title">{kpi.libelle}</h4>
        {kpi.description && (
          <p className="kr-kpi-card__desc">{kpi.description}</p>
        )}
      </div>


      <div className="kr-kpi-card__info">
        {isVirtual ? (
          <div className="kr-formula-tag">
            <i className="fa-solid fa-calculator" />
            <div className="kr-formula-content">
              {kpi.formule && kpi.formule.startsWith('((') && kpi.formule.includes('/ ') && kpi.formule.includes(') * 100') ? (
                <span className="kr-formula-hint"><i className="fa-solid fa-percent" /> Converti en %</span>
              ) : kpi.formule && kpi.formule.includes(' / ') && !kpi.formule.includes('* 100') ? (
                <span className="kr-formula-hint"><i className="fa-solid fa-divide" /> Moyenne</span>
              ) : kpi.formule && kpi.formule.includes(' + ') && !kpi.formule.includes(' / ') ? (
                <span className="kr-formula-hint"><i className="fa-solid fa-plus" /> Somme</span>
              ) : kpi.formule && kpi.formule.startsWith('((') && kpi.formule.includes(') / ') && kpi.formule.includes(') / 100) * 100') ? (
                <span className="kr-formula-hint"><i className="fa-solid fa-divide" /> Moyenne & Conversion en %</span>
              ) : kpi.formule && kpi.formule.includes(') / ') && kpi.formule.includes(') * 100') ? (
                <span className="kr-formula-hint"><i className="fa-solid fa-divide" /> Moyenne & Conversion en %</span>
              ) : null}
              <code>{kpi.formule || 'N/A'}</code>
            </div>
          </div>
        ) : (
          <div className="kr-source-tag">
            <i className="fa-solid fa-database" />
            <span>Source BigQuery Gold</span>
          </div>
        )}
      </div>

      <div className="kr-kpi-card__footer">
        <div className="kr-visibility-control">
          <span className="kr-visibility-label">Visibilité UI</span>
          <label className={`kr-switch ${toggling ? 'is-loading' : ''}`}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={() => !toggling && onToggle(kpi.code)}
              disabled={toggling}
            />
            <span className="kr-switch__slider"></span>
            <span className="kr-switch__text">{isActive ? 'Actif' : 'Masqué'}</span>
          </label>
        </div>
      </div>
    </div>
  )
}
