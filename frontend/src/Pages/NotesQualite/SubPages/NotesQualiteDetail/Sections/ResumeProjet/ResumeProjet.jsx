/*
 * Fichier : ResumeProjet.jsx
 * Rôle    : Section affichant la synthèse globale du projet (moyenne + items).
 * Module  : mypaie / Pages / NotesQualite / SubPages / NotesQualiteDetail / Sections
 */

import React from 'react'
import GaugeChart from '../../Components/GaugeChart/GaugeChart'
import './ResumeProjet.css'

function ResumeProjet({ statsSummary }) {
  if (!statsSummary) return null

  const classeNote = (note) => Number(note) >= 80 ? 'nq-note--good' : 'nq-note--bad'

  return (
    <section className="nq-resume-global">
      <div className="nq-resume-card">
        <div className="nq-resume-card__header">
          <i className="fa-solid fa-chart-line" />
          <span>Moyenne Projet</span>
        </div>
        <div className="nq-resume-card__body">
          <GaugeChart score={statsSummary.moyenne_globale} size="large" />
          <span className="nq-resume-card__meta">{statsSummary.nb_total} évaluations</span>
        </div>
      </div>

      <div className="nq-resume-grid">
        {statsSummary.items.map(item => (
          <div key={item.name} className="nq-typologie-box">
            <div className="nq-typologie-box__header">
              <span className="nq-typologie-box__title">{item.name}</span>
              <span className={`nq-note nq-note--sm ${classeNote(item.moyenne)}`}>
                {Number(item.moyenne).toFixed(1)}%
              </span>
            </div>
            <div className="nq-typologie-box__subs">
              {item.sousItems.map(sub => (
                <div key={sub.name} className="nq-sub-row">
                  <span className="nq-sub-row__label">{sub.name}</span>
                  <span className={`nq-sub-row__note ${Number(sub.moyenne) >= 80 ? 'nq-text-good' : 'nq-text-bad'}`}>
                    {Number(sub.moyenne).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default ResumeProjet
