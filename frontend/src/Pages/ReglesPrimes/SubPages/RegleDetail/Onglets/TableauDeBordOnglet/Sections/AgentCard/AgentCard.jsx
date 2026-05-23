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
  const key = (kpi.metricKey || '').toLowerCase();
  switch (key) {
    case 'dmt':
      return dmtUnit === 'min'
        ? `${Math.floor(kpi.reel / 60)}m\u00a0${String(Math.round(kpi.reel % 60)).padStart(2, '0')}s`
        : `${Math.round(kpi.reel)}s`;
    case 'cvr':
    case 'tx_mea':
    case 'qualite':
      return `${kpi.reel.toFixed(1)}%`;
    case 'avg_ca':
    case 'chiffre_affaire':
      return `${kpi.reel.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}`;
    case 'heures':
      return `${kpi.reel.toFixed(1)}h`;
    default:
      return typeof kpi.reel === 'number' ? kpi.reel.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : String(kpi.reel);
  }
};

const formatKpiObj = (kpi, dmtUnit) => {
  if (kpi.objectif == null) return null;
  const key = (kpi.metricKey || '').toLowerCase();
  switch (key) {
    case 'dmt':
      return dmtUnit === 'min'
        ? `${Math.floor(kpi.objectif / 60)}m\u00a0${String(Math.round(kpi.objectif % 60)).padStart(2, '0')}s`
        : `${Math.round(kpi.objectif)}s`;
    case 'cvr':
    case 'tx_mea':
    case 'qualite':
      return `${kpi.objectif.toFixed(1)}%`;
    case 'avg_ca':
    case 'chiffre_affaire':
      return `${kpi.objectif.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}`;
    default:
      return typeof kpi.objectif === 'number' ? kpi.objectif.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : String(kpi.objectif);
  }
};

const getImpactModalData = (kpi) => {
  const nom = kpi.kpi_libelle || kpi.nom || 'Indicateur';

  if (kpi.mode_prime === 'montant_direct') {
    return {
      title: `Impact : ${nom}`,
      formula: 'Montant_Direct = barème.find(Réel ∈ [seuil_min ; seuil_max]).montant',
      sourceTable: 'Grille JSON (paliers_valeur)',
      description: `Barème par tranches : la valeur réelle de "${nom}" est positionnée dans un barème de paliers.\nChaque tranche correspond à un montant fixe (ou un % du réel) versé directement, sans passer par un calcul de points.\n\nLa valeur affichée ici est le montant de prime brute alloué pour cet indicateur.`,
      metrics: 'seuil_min, seuil_max, montant, type_montant'
    };
  }

  if (kpi.type_ponderation === 'malus') {
    return {
      title: `Impact : ${nom}`,
      formula: 'Malus_pct = conditions.find(Réel ∈ [seuil_min ; seuil_max]).malus_pct',
      sourceTable: 'Grille JSON (malus_conditions)',
      description: `Coefficient de malus : la valeur réelle de "${nom}" détermine un % de réduction appliqué sur le montant total de la prime.\nSi la valeur n'est pas disponible ou si la cible est atteinte, le malus est 0%.`,
      metrics: 'malus_pct, seuil_min, seuil_max'
    };
  }

  if (kpi.type_ponderation === 'eliminatoire') {
    return {
      title: `Impact : ${nom}`,
      formula: 'SI(Réel < Objectif) → Prime totale = 0 DH',
      sourceTable: 'Grille JSON (indicateurs)',
      description: `Indicateur éliminatoire : si "${nom}" n'atteint pas 100% de l'objectif, la prime entière est annulée pour ce mois, quel que soit le résultat des autres indicateurs.`,
      metrics: 'reel, objectif, type_ponderation'
    };
  }

  if (kpi.type_ponderation === 'coefficient') {
    return {
      title: `Impact : ${nom}`,
      formula: 'Multiplicateur_Global *= (1 − poids / 100)  si Réel < Objectif',
      sourceTable: 'Grille JSON (indicateurs)',
      description: `Coefficient global : si "${nom}" n'atteint pas l'objectif, un facteur de réduction de ${kpi.points_max}% est appliqué sur le score total de l'agent.`,
      metrics: `poids (${kpi.points_max}%), taux_atteinte`
    };
  }

  // Défaut : score_global bonus
  return {
    title: `Impact : ${nom}`,
    formula: 'Points = Palier_Pct(Taux_Atteinte) × Poids',
    sourceTable: 'Grille JSON (paliers, indicateurs)',
    description: `Score par paliers : le taux d'atteinte de "${nom}" (Réel ÷ Objectif) détermine le % du poids alloué.\nEx : taux ≥ 100% → 100% des ${kpi.points_max} pts. Les paliers sont configurés dans la grille.`,
    metrics: `poids (${kpi.points_max} pts), taux_atteinte, paliers`
  };
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
  unifiedKpis,
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
            {[a.sous_projet, a.activite].filter(Boolean).join(' · ')}
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
        <div className="agent-card__section-title" style={{ display: 'flex', alignItems: 'center' }}>
          KPI Performance
          {results.hasMissingData && (
            <span style={{ marginLeft: '12px', color: '#ef4444', fontSize: '0.75rem', fontWeight: '600', backgroundColor: '#fef2f2', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fecaca' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '4px' }}></i>
              Données incomplètes (Prime 0)
            </span>
          )}
        </div>
        <div className="agent-card__kpi-header">
          <span className="agent-card__kpi-h-dot"></span>
          <span className="agent-card__kpi-h-name">Indicateur</span>
          <span className="agent-card__kpi-h-reel">Réel</span>
          <span className="agent-card__kpi-h-obj">Obj.</span>
          <span className="agent-card__kpi-h-att">Att.</span>
          <span className="agent-card__kpi-h-pts">
            Impact
            <i
              className="fa-solid fa-circle-info"
              style={{ fontSize: '0.65rem', marginLeft: '4px', cursor: 'pointer', opacity: 0.6 }}
              title="Comprendre la colonne Impact"
              onClick={() => handleShowFormula({
                title: 'Colonne Impact',
                formula: 'Impact = Montant DH | Points | Malus % | Éliminatoire',
                sourceTable: 'Grille JSON (indicateurs)',
                description: 'La colonne Impact indique le résultat calculé pour chaque indicateur selon son mode de calcul :\n\n• Montant Direct (DH) : barème par tranches de valeur réelle\n• Points : % du poids attribué selon le taux d\'atteinte et les paliers\n• Malus (%) : réduction appliquée sur le total de la prime\n• Éliminatoire : annule la prime entière si la cible n\'est pas atteinte\n\nCliquez sur ⓘ en face de chaque indicateur pour le détail de son calcul.',
              })}
            ></i>
          </span>
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
                  <span className="agent-card__kpi-name" title={kpi.nom}>
                    {kpi.nom}
                    {kpi.is_formula && kpi.formula && (
                      <button
                        type="button"
                        className="agent-card__kpi-formula-btn"
                        title="Voir la formule de calcul"
                        onClick={() => handleShowFormula({
                          title:       kpi.kpi_libelle || kpi.nom,
                          formula:     kpi.formula,
                          sourceTable: kpi.source_db || 'BigQuery (Perf)',
                          metrics:     kpi.formula.match(/\.(\w+)/g)?.map(m => m.slice(1)).filter((v,i,a)=>a.indexOf(v)===i).join(', ') || kpi.metricKey,
                        })}
                      >ƒ</button>
                    )}
                  </span>
                  <span className="agent-card__kpi-reel">
                    {anyLoading ? '...' : reelStr ?? '—'}
                  </span>
                  <span className="agent-card__kpi-obj">{objStr ?? '—'}</span>
                  <span className={`agent-card__kpi-att agents-table__qualite--${attPct >= 100 ? 'good' : attPct >= 80 ? 'average' : 'bad'}`}>
                      {attPct != null ? `${attPct}%` : '—'}
                  </span>
                  <span className={`agent-card__kpi-pts ${kpi.type_ponderation !== 'bonus' ? 'is-special' : ''}`}>
                    {kpi.impact_desc || (kpi.points_gagnes ?? 0)}
                    <button
                      type="button"
                      className="agent-card__kpi-impact-info-btn"
                      title="Comprendre cet impact"
                      onClick={() => handleShowFormula(getImpactModalData(kpi))}
                    >
                      <i className="fa-solid fa-circle-info"></i>
                    </button>
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
                <i className={`fa-solid ${icon}`} style={{ color }}></i>
                <span className="agent-card__count-label">{label}</span>
                <span className="agent-card__count-val" style={{ color }}>{data[field] || 0}</span>
              </div>
            ))}
          </div>

          <div className="agent-card__jours-summary">
            <div className="agent-card__jour-stat">
              <span className="agent-card__jour-label">N.T <i className="fa-solid fa-circle-info" onClick={() => handleShowFormula('jours_non_travailles')}></i></span>
              <span className="agent-card__jour-val">{assiduite.jours_non_travailles}</span>
            </div>
            <div className="agent-card__jour-stat">
              <span className="agent-card__jour-label">Trav. <i className="fa-solid fa-circle-info" onClick={() => handleShowFormula('jours_travailles')}></i></span>
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
            <span className="val">{(unifiedKpis?.HEURE_HP || 0).toFixed(1)}h</span>
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
