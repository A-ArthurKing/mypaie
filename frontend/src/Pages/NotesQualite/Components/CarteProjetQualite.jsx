/*
 * Fichier : CarteProjetQualite.jsx
 * Rôle    : Carte KPI affichant la moyenne qualité d'un projet.
 * Module  : mypaie / Pages / NotesQualite / Components
 */

import './CarteProjetQualite.css'

function CarteProjetQualite({ projet, moyenne, nbEvaluations, onClick }) {
  const score = Math.round(moyenne)
  const isGood = score >= 80

  // Paramètres du cercle SVG (Jauge semi-circulaire)
  const radius = 45
  const circumference = Math.PI * radius // Semi-circonférence
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="carte-qualite" onClick={onClick}>
      <div className="carte-qualite__header">
        <h3 className="carte-qualite__title" title={projet}>{projet}</h3>
        <i className="fa-solid fa-arrow-right-to-bracket carte-qualite__arrow" />
      </div>

      <div className="carte-qualite__body">
        <div className="carte-qualite__gauge-container">
          <svg className="carte-qualite__gauge" viewBox="0 0 100 60">
            {/* Fond de la jauge (gris) */}
            <path
              className="gauge-bg"
              d="M 5,55 A 45,45 0 0 1 95,55"
              fill="none"
              strokeWidth="10"
            />
            {/* Valeur de la jauge (couleur) */}
            <path
              className={`gauge-value ${isGood ? 'good' : 'bad'}`}
              d="M 5,55 A 45,45 0 0 1 95,55"
              fill="none"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="carte-qualite__score-center">
            <span className="carte-qualite__score-number">{score}%</span>
          </div>
        </div>
      </div>

      <div className="carte-qualite__footer">
        <div className="carte-qualite__stat">
          <i className="fa-solid fa-clipboard-list" />
          <span><strong>{nbEvaluations}</strong> évaluations</span>
        </div>
      </div>
    </div>
  )
}

export default CarteProjetQualite
