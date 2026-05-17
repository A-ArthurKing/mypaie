import React from 'react'
import './KpiStats.css'

export default function KpiStats({ stats, loading }) {
  if (loading) return null

  return (
    <div className="kr-stats">
      <div className="kr-stat">
        <span className="kr-stat__value">{stats.total}</span>
        <span className="kr-stat__label">Total KPIs</span>
      </div>
      <div className="kr-stat kr-stat--active">
        <span className="kr-stat__value">{stats.actifs}</span>
        <span className="kr-stat__label">Actifs (Visibles UI)</span>
      </div>
      <div className="kr-stat kr-stat--inactive">
        <span className="kr-stat__value">{stats.inactifs}</span>
        <span className="kr-stat__label">Cachés</span>
      </div>
    </div>
  )
}
