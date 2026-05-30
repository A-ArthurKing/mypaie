/*
 * Fichier : Step7Recapitulatif.jsx
 * Rôle    : Étape 7 du GrilleEditorModal - Récapitulatif auto-généré de la grille.
 *           Synthèse de toute la configuration en :
 *             - Formule algorithmique (pseudo-code)
 *             - Explication en langage naturel
 */
import React, { useMemo, useState } from 'react';
import './Step7Recapitulatif.css';
import { buildFormuleAlgo, buildFormuleHumain } from './FormulaGenerator';

// ── Composant principal ─────────────────────────────────────────────────────
export default function Step7Recapitulatif({ data, configTemps }) {
  const [activeTab, setActiveTab] = useState('algo');

  const lignesAlgo   = useMemo(() => buildFormuleAlgo(data, configTemps),   [data, configTemps]);
  const partiesHumain = useMemo(() => buildFormuleHumain(data, configTemps), [data, configTemps]);

  const totalPoids = (data.indicateurs || []).reduce((s, i) => s + (parseFloat(i.poids) || 0), 0);

  const stats = [
    { value: data.statuts?.length || 0,                 label: 'Niveau(x)',       icon: 'fa-solid fa-layer-group' },
    { value: data.indicateurs?.length || 0,             label: 'Indicateur(s)',   icon: 'fa-solid fa-chart-bar' },
    { value: totalPoids,                                 label: 'Points total',    icon: 'fa-solid fa-star' },
    { value: data.paliers?.length || 0,                 label: 'Palier(s)',       icon: 'fa-solid fa-stairs' },
    { value: configTemps?.malus_assiduite?.length || 0, label: 'Règle(s) présence', icon: 'fa-solid fa-shield-halved' },
    { value: data.primes_additionnelles?.length || 0,   label: 'Bonus additionnel(s)', icon: 'fa-solid fa-gift' },
  ];

  const renderLine = (line, idx) => {
    if (line.type === 'blank') return <div key={idx} className="gr-line gr-line--blank" />;
    const cls = {
      comment: 'gr-line--comment',
      keyword: 'gr-line--keyword',
      assign:  'gr-line--assign',
      danger:  'gr-line--danger',
      warn:    'gr-line--warn',
      result:  'gr-line--result',
      plain:   '',
    }[line.type] || '';

    return (
      <div key={idx} className={`gr-line ${cls}`}>
        {line.text}
      </div>
    );
  };

  return (
    <div className="gr-wrap">
      <div className="gr-stats">
        {stats.map(s => (
          <div key={s.label} className="gr-stat">
            <i className={s.icon}></i>
            <span className="gr-stat__value">{s.value}</span>
            <span className="gr-stat__label">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="gr-tabs">
        <button 
          className={`gr-tab ${activeTab === 'algo' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('algo')}
        >Algorithme de calcul</button>
        <button 
          className={`gr-tab ${activeTab === 'human' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('human')}
        >Explication naturelle</button>
      </div>

      <div className="gr-content">
        {activeTab === 'algo' ? (
          <div className="gr-code-block">
            <div className="gr-code-header">
              <span className="gr-code-dot" style={{ background: '#ff5f56' }}></span>
              <span className="gr-code-dot" style={{ background: '#ffbd2e' }}></span>
              <span className="gr-code-dot" style={{ background: '#27c93f' }}></span>
              <span className="gr-code-title">engine_v2_payout.py</span>
            </div>
            <div className="gr-code-body">
              {lignesAlgo.map((l, i) => renderLine(l, i))}
            </div>
          </div>
        ) : (
          <div className="gr-prose">
            {partiesHumain.map((p, idx) => (
              <div key={idx} className="gr-prose__item">
                <div className="gr-prose__header">
                  <span className="gr-prose__step">{idx + 1}</span>
                  <h4 className="gr-prose__title">{p.title}</h4>
                </div>
                <div 
                  className="gr-prose__text"
                  dangerouslySetInnerHTML={{ 
                    __html: p.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
