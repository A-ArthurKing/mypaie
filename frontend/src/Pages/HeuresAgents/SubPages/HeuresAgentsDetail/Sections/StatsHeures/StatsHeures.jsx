/*
 * Fichier : StatsHeures.jsx
 * Rôle    : Section statistique comparant le prévisionnel (HT) et le réel (Total).
 * Module  : mypaie / Pages / HeuresAgents / SubPages / HeuresAgentsDetail / Sections
 */

import React, { useMemo } from 'react'
import './StatsHeures.css'

function msToHours(ms) {
  return Math.round(Number(ms || 0) / 3600000 * 10) / 10
}

function StatsHeures({ lignes = [] }) {
  const stats = useMemo(() => {
    let totalHT = 0
    let totalReel = 0
    let totalHF = 0
    const dailyMap = {}

    for (const l of lignes) {
      const ht = Number(l.heure_ht) || 0
      const reel = Number(l.heure_total) || 0
      const hf = Number(l.heure_hf) || 0
      totalHT += ht
      totalReel += reel
      totalHF += hf

      // Agrégation par date pour le graphique
      const d = l.date.split('T')[0]
      if (!dailyMap[d]) dailyMap[d] = { ht: 0, reel: 0, hf: 0 }
      dailyMap[d].ht += ht
      dailyMap[d].reel += reel
      dailyMap[d].hf += hf
    }

    const labels = Object.keys(dailyMap).sort()
    const dataHT = labels.map(l => msToHours(dailyMap[l].ht))
    const dataReel = labels.map(l => msToHours(dailyMap[l].reel))
    const dataHF = labels.map(l => msToHours(dailyMap[l].hf))

    return {
      totalHT: msToHours(totalHT),
      totalReel: msToHours(totalReel),
      totalHF: msToHours(totalHF),
      labels,
      dataHT,
      dataReel,
      dataHF,
      ratio: totalHT > 0 ? Math.round((totalReel / totalHT) * 100) : 0
    }
  }, [lignes])

  if (lignes.length === 0) return null

  // Calcul des hauteurs pour le graphique SVG (max 100px)
  const maxVal = Math.max(...stats.dataHT, ...stats.dataReel, ...stats.dataHF, 1)
  const chartHeight = 120

  return (
    <section className="ha-stats">
      
      {/* ── KPI Cards ── */}
      <div className="ha-stats__cards">
        <div className="ha-stats-card">
          <span className="ha-stats-card__label">Prévisionnel (Théorique)</span>
          <div className="ha-stats-card__value">
            <i className="fa-solid fa-calendar-check" />
            <span>{stats.totalHT.toLocaleString()} h</span>
          </div>
        </div>

        <div className="ha-stats-card ha-stats-card--reel">
          <span className="ha-stats-card__label">Réel (Total réalisé)</span>
          <div className="ha-stats-card__value">
            <i className="fa-solid fa-stopwatch" />
            <span>{stats.totalReel.toLocaleString()} h</span>
          </div>
          <div className="ha-stats-card__progress">
             <div className="ha-stats-card__progress-bar">
                <div className="ha-stats-card__progress-fill" style={{ width: `${Math.min(stats.ratio, 100)}%` }}></div>
             </div>
             <span className="ha-stats-card__ratio">{stats.ratio}% atteint</span>
          </div>
        </div>
      </div>

      {/* ── Graphique de comparaison (SVG simple) ── */}
      <div className="ha-stats__chart-container">
        <header className="ha-stats__chart-header">
           <h4>Comparaison Journalière (Heures)</h4>
           <div className="ha-stats__legend">
              <span className="legend-ht">Prévisionnel</span>
              <span className="legend-reel">Réel</span>
              <span className="legend-hf">Formation</span>
           </div>
        </header>
        
        <div className="ha-stats__chart">
          <div className="ha-stats__bars">
            {stats.labels.map((date, i) => (
              <div key={date} className="ha-stats__bar-group" title={`${date}: HT=${stats.dataHT[i]}h, Réel=${stats.dataReel[i]}h, HF=${stats.dataHF[i]}h`}>
                <div className="ha-stats__bar-set">
                  <div 
                    className="bar bar--ht" 
                    style={{ height: `${(stats.dataHT[i] / maxVal) * chartHeight}px` }} 
                  />
                  <div 
                    className="bar bar--reel" 
                    style={{ height: `${(stats.dataReel[i] / maxVal) * chartHeight}px` }} 
                  />
                  <div 
                    className="bar bar--hf" 
                    style={{ height: `${(stats.dataHF[i] / maxVal) * chartHeight}px` }} 
                  />
                </div>
                <span className="ha-stats__bar-label">{date.split('-').slice(1).reverse().join('/')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </section>
  )
}

export default StatsHeures
