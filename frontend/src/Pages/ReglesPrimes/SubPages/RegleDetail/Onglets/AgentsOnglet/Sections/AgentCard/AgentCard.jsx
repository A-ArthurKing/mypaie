/*
 * Fichier : AgentCard.jsx
 * Rôle    : Composant d'affichage d'un agent individuel dans le dashboard
 * Module  : mypaie / Pages / ReglesPrimes / SubPages / Onglets / Sections / AgentCard
 */

import React from 'react';
import './AgentCard.css';

const KPI_COLORS = {
  qualite: '#22c55e',
  dmt:     '#38bdf8',
  cvr:     '#f97316',
  tx_mea:  '#818cf8',
  avg_ca:  '#ec4899',
  heures:  '#94a3b8',
};

const formatKpiReel = (kpi, dmtUnit) => {
  if (kpi.reel == null) return null;
  switch (kpi.metricKey) {
    case 'dmt':
      return dmtUnit === 'min'
        ? `${Math.floor(kpi.reel / 60)}m\u00a0${String(Math.round(kpi.reel % 60)).padStart(2, '0')}s`
        : `${Math.round(kpi.reel)}s`;
    case 'cvr':
    case 'tx_mea':
    case 'qualite':
      return `${kpi.reel.toFixed(1)}%`;
    case 'avg_ca':
      return `${kpi.reel.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`;
    case 'heures':
      return `${kpi.reel.toFixed(1)}h`;
    default:
      return String(kpi.reel);
  }
};

const formatKpiObj = (kpi, dmtUnit) => {
  if (kpi.objectif == null) return null;
  switch (kpi.metricKey) {
    case 'dmt':
      return dmtUnit === 'min'
        ? `${Math.floor(kpi.objectif / 60)}m\u00a0${String(Math.round(kpi.objectif % 60)).padStart(2, '0')}s`
        : `${Math.round(kpi.objectif)}s`;
    case 'cvr':
    case 'tx_mea':
    case 'qualite':
      return `${kpi.objectif.toFixed(1)}%`;
    case 'avg_ca':
      return `${kpi.objectif.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`;
    default:
      return String(kpi.objectif);
  }
};

const AgentCard = ({
  agent,
  data,
  kpiResults,
  assiduite,
  results,
  montantFinal,
  calcSB,
  extraPrimes,
  totalPrime,
  ptsFinal,
  anyLoading,
  dmtUnit,
  heuresMap,
  handleUpdateLocalData,
  handleShowFormula
}) => {
  const a = agent;

  return (
    <div className="agent-card">
      {/* ─── 1. Profil & État ─── */}
      <div className="agent-card__profil">
        <div className="agent-card__identity">
          <span className="agent-card__matricule">{a.matricule}</span>
          <span className="agent-card__name">
            <strong>{a.nom}</strong> {a.prenom}
          </span>
        </div>
        
        <div className="agent-card__projet">
          <span className="agent-card__operation">{a.operation || '—'}</span>
          <span className="agent-card__meta">
            {[a.file, a.activite].filter(Boolean).join(' · ')}
          </span>
        </div>

        <div className="agent-card__controls">
          <div className="agent-card__status-item">
            <span className="agent-card__status-label">Discipline</span>
            <button
              type="button"
              className={`agent-card__sanction-toggle ${data.sanction === 'Oui' ? 'is-sanctioned' : 'is-ok'}`}
              onClick={() => handleUpdateLocalData(a.matricule, 'sanction', data.sanction === 'Oui' ? 'Non' : 'Oui')}
              title={data.sanction === 'Oui' ? "Lever la sanction" : "Appliquer une sanction"}
            >
              <i className={`fa-solid ${data.sanction === 'Oui' ? 'fa-circle-xmark' : 'fa-circle-check'}`}></i>
              {data.sanction === 'Oui' ? 'Sanctionné' : 'En règle'}
            </button>
          </div>

          <div className="agent-card__status-item">
            <span className="agent-card__status-label">Niveau</span>
            <div className="agent-card__statut-display">
              <i className="fa-solid fa-graduation-cap"></i>
              {data.statut || 'Confirmé'}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. Performance KPI ─── */}
      <div className="agent-card__kpis">
        <div className="agent-card__section-title">KPI Performance</div>
        <div className="agent-card__kpi-header">
          <span className="agent-card__kpi-h-dot"></span>
          <span className="agent-card__kpi-h-name">Indicateur</span>
          <span className="agent-card__kpi-h-reel">Réel</span>
          <span className="agent-card__kpi-h-obj">Obj.</span>
          <span className="agent-card__kpi-h-att">Att.</span>
          <span className="agent-card__kpi-h-pts">Pts</span>
        </div>
        <div className="agent-card__kpi-list">
          {data.sanction === 'Oui' ? (
            <div className="agent-card__sanction-overlay">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <div className="agent-card__sanction-text">
                <strong>Prime Suspendue</strong>
                <span>Scoring désactivé suite à une sanction disciplinaire sur ce mois.</span>
              </div>
            </div>
          ) : results.isEliminated ? (
            <div className="agent-card__sanction-overlay is-eliminated">
              <i className="fa-solid fa-ban"></i>
              <div className="agent-card__sanction-text">
                <strong>Critère Éliminatoire</strong>
                <span>Un seuil bloquant n'a pas été atteint ce mois-ci. Prime annulée.</span>
              </div>
            </div>
          ) : kpiResults.kpis.length === 0 ? (
            <span className="agent-card__kpi-na">Aucun indicateur configuré</span>
          ) : (
            kpiResults.kpis.map(kpi => {
              const color   = KPI_COLORS[kpi.metricKey] || '#94a3b8';
              const reelStr = anyLoading ? null : formatKpiReel(kpi, dmtUnit);
              const objStr  = formatKpiObj(kpi, dmtUnit);
              const attPct  = kpi.taux_atteinte != null ? Math.round(kpi.taux_atteinte * 100) : null;
              
              return (
                <div key={kpi.id} className="agent-card__kpi-row">
                  <span className="agent-card__kpi-dot" style={{ background: color }}></span>
                  <span className="agent-card__kpi-name" title={kpi.nom}>{kpi.nom}</span>
                  <span className="agent-card__kpi-reel">
                    {anyLoading ? '...' : reelStr ?? '—'}
                  </span>
                  <span className="agent-card__kpi-obj">{objStr ?? '—'}</span>
                  <span className={`agent-card__kpi-att agents-table__qualite--${attPct >= 100 ? 'good' : attPct >= 80 ? 'average' : 'bad'}`}>
                      {attPct != null ? `${attPct}%` : '—'}
                  </span>
                  <span className={`agent-card__kpi-pts ${kpi.type_ponderation !== 'bonus' ? 'is-special' : ''}`}>
                    {kpi.impact_desc || (kpi.points_gagnes ?? 0)}
                  </span>
                </div>
              );
            })
          )}
        </div>
        {data.sanction !== 'Oui' && (
          <div className="agent-card__pts-total">
            <span>Score Final</span>
            <span className="agent-card__pts-total-val">{kpiResults.total_points.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* ─── 3. Assiduité ─── */}
      <div className="agent-card__assiduite">
        <div className="agent-card__section-title">Assiduité</div>
        
        <div className="agent-card__assiduite-main">
          <div className="agent-card__counts-grid">
            {[
              { field: 'abs_injust', label: 'Abs. I', color: 'var(--color-error)', icon: 'fa-user-xmark' },
              { field: 'retards',    label: 'Retard', color: 'var(--color-warning)', icon: 'fa-clock' },
              { field: 'abs_just',   label: 'Abs. J', color: 'var(--color-info)', icon: 'fa-file-medical' },
              { field: 'cp_css',     label: 'CP/CSS', color: 'var(--color-success)', icon: 'fa-umbrella-beach' },
            ].map(({ field, label, color, icon }) => (
              <div key={field} className="agent-card__count-item">
                <i className={`fa-solid ${icon}`} style={{ color: color }}></i>
                <div className="agent-card__count-stack">
                  <span className="label">{label}</span>
                  <span className="val" style={{ color }}>{data[field] || 0}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="agent-card__jours-summary">
            <div className="agent-card__jour-stat">
              <span className="agent-card__jour-label">
                N.T <i className="fa-solid fa-circle-info" onClick={() => handleShowFormula('jours_non_travailles')}></i>
              </span>
              <span className="agent-card__jour-val">{assiduite.jours_non_travailles}</span>
            </div>
            <div className="agent-card__jour-stat">
              <span className="agent-card__jour-label">
                Trav. <i className="fa-solid fa-circle-info" onClick={() => handleShowFormula('jours_travailles')}></i>
              </span>
              <span className="agent-card__jour-val highlight">{assiduite.jours_travailles}</span>
            </div>
            <div className="agent-card__jour-stat">
              <span className="agent-card__jour-label">Ouv.</span>
              <span className="agent-card__jour-val">{assiduite.jours_ouvres}</span>
            </div>
          </div>
        </div>

        <div className="agent-card__assiduite-footer">
          <div className={`agent-card__malus-indicator status-${assiduite.facteur === 0 ? 'bad' : assiduite.malus_pct < -0.01 ? 'average' : 'good'}`}>
            <span className="label">Malus</span>
            <strong className="val">{(assiduite.malus_pct * 100).toFixed(1)}%</strong>
            <i className="fa-solid fa-circle-info" onClick={() => handleShowFormula('malus_assiduite')}></i>
          </div>
          <div className="agent-card__prod-hours">
            <span className="label">Heures Prod.</span>
            <span className="val">{(heuresMap[String(a.matricule)]?.hp / 3600000 || 0).toFixed(1)}h</span>
          </div>
        </div>
      </div>

      {/* ─── 4. Résultat Paie ─── */}
      <div className="agent-card__result">
        <div className="agent-card__section-title">Paie</div>
        
        <div className="agent-card__prime-details">
          <div className="agent-card__prime-row">
            <span className="agent-card__prime-label">
              Prime Brute <i className="fa-solid fa-circle-info agents-table__info-icon" onClick={() => handleShowFormula('prime_brute')}></i>
            </span>
            {assiduite.facteur === 0 || data.sanction === 'Oui' ? (
              <span className="agent-card__prime-zero">0 DH</span>
            ) : (
              <span className="agent-card__prime-value">
                {montantFinal > 0 ? montantFinal.toLocaleString('fr-FR') : '0'}
                <span className="agent-card__prime-unit"> DH</span>
              </span>
            )}
          </div>

          <div className="agent-card__prime-row">
            <span className="agent-card__prime-label">
              Super Bonus <i className="fa-solid fa-circle-info agents-table__info-icon" onClick={() => handleShowFormula('total_sb')}></i>
            </span>
            <span className={`agent-card__sb-value ${calcSB > 0 ? 'has-bonus' : ''}`}>
              {calcSB > 0 ? `+${calcSB.toLocaleString('fr-FR')} DH` : '0 DH'}
            </span>
          </div>

          {/* Primes Additionnelles (Extra) */}
          {extraPrimes && extraPrimes.length > 0 && (
            <div className="agent-card__extra-primes">
              {extraPrimes.map((p, idx) => (
                <div key={p.id || idx} className="agent-card__prime-row agent-card__prime-row--extra">
                  <span className="agent-card__prime-label">
                    {p.nom} 
                    {p.type === 'manuel' && <i className="fa-solid fa-pen-to-square" style={{ fontSize: '9px', opacity: 0.6, marginLeft: '5px' }} title="Saisie manuelle"></i>}
                    {p.type === 'conditionnelle' && <i className="fa-solid fa-wand-magic-sparkles" style={{ fontSize: '9px', opacity: 0.6, marginLeft: '5px' }} title="Calculé automatiquement"></i>}
                  </span>
                  <span className={`agent-card__sb-value ${p.montant > 0 ? 'has-bonus' : ''}`}>
                    {p.montant > 0 ? `+${p.montant.toLocaleString('fr-FR')} DH` : '0 DH'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="agent-card__pts-summary">
          <span className="agent-card__pts-label">Score final :</span>
          <strong className="agent-card__pts-val">
            {ptsFinal} <i className="fa-solid fa-circle-info agents-table__info-icon" onClick={() => handleShowFormula('points_final')}></i>
          </strong>
        </div>

        <div className="agent-card__total-prime">
          <div className="agent-card__total-label">
            Total Prime <i className="fa-solid fa-circle-info agents-table__info-icon" onClick={() => handleShowFormula('total_prime')}></i>
          </div>
          <div className="agent-card__total-value">
            {totalPrime.toLocaleString('fr-FR')} <span>DH</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentCard;
