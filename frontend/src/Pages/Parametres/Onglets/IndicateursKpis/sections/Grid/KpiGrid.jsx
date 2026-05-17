import React from 'react'
import KpiCard from '../Card/KpiCard'
import './KpiGrid.css'

export default function KpiGrid({ grouped, togglingCode, handleToggle, handleOpenEdit, handleDelete, UNIVERS_LABELS }) {
  if (Object.keys(grouped).length === 0) return null

  return (
    <div className="kr-grid-wrapper">
      {Object.entries(UNIVERS_LABELS).map(([univers, label]) => {
        const items = grouped[univers]
        if (!items?.length) return null

        return (
          <div key={univers} className="kr-univers-section">
            <div className="kr-univers-header">
              <span className={`kr-univers-badge kr-univers-badge--${univers}`}>{univers}</span>
              <h3>{label}</h3>
              <span className="kr-univers-count">{items.length} KPI{items.length > 1 ? 's' : ''}</span>
            </div>
            <div className="kr-kpi-grid">
              {items.map(kpi => (
                <KpiCard
                  key={kpi.code}
                  kpi={kpi}
                  toggling={togglingCode === kpi.code}
                  onToggle={handleToggle}
                  onEdit={handleOpenEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
