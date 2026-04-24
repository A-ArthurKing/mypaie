/*
 * Fichier : GaugeChart.jsx
 * Rôle    : Composant graphique de jauge semi-circulaire.
 * Module  : mypaie / Pages / NotesQualite / SubPages / NotesQualiteDetail / Components
 */

import React from 'react'
import './GaugeChart.css'

function GaugeChart({ score, size = "large" }) {
  const roundedScore = Math.round(score)
  const isGood = roundedScore >= 80

  // Paramètres du cercle SVG (Jauge semi-circulaire)
  const radius = 45
  const circumference = Math.PI * radius
  const offset = circumference - (roundedScore / 100) * circumference

  return (
    <div className={`nq-gauge nq-gauge--${size}`}>
      <div className="nq-gauge__container">
        <svg className="nq-gauge__svg" viewBox="0 0 100 60">
          <path
            className="nq-gauge__bg"
            d="M 5,55 A 45,45 0 0 1 95,55"
            fill="none"
          />
          <path
            className={`nq-gauge__value ${isGood ? 'good' : 'bad'}`}
            d="M 5,55 A 45,45 0 0 1 95,55"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="nq-gauge__center">
          <span className="nq-gauge__number">{roundedScore}%</span>
        </div>
      </div>
    </div>
  )
}

export default GaugeChart
