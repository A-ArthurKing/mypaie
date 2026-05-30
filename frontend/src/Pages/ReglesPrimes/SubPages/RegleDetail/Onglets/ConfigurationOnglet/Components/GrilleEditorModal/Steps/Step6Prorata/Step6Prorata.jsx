/*
 * Fichier : Step6Prorata.jsx
 * Rôle    : Étape 6 du GrilleEditorModal - Configuration du prorata, de la présence et des règles de malus d'assiduité.
 */
import React from 'react';
import './Step6Prorata.css';

const MODES_PRORATA = [
  { value: 'jours',  label: 'Jours travaillés', icon: 'fa-solid fa-calendar-days' },
  { value: 'heures', label: 'Heures réelles',    icon: 'fa-solid fa-clock' },
  { value: 'aucun',  label: 'Pas de prorata',    icon: 'fa-solid fa-ban' },
];
const BASES_HORAIRES = [169, 176, 191];

const KPI_ASSIDUITE = [
  { value: 'abs_injustifie', label: 'Absences injustifiées', icon: '🚫' },
  { value: 'abs_justifie',   label: 'Absences justifiées',   icon: '📋' },
  { value: 'retard',         label: 'Retards',               icon: '⏰' },
  { value: 'cp_css',         label: 'Congés payés (CNSS)',   icon: '🏖️' },
];

const OPERATORS = [
  { value: '>=', label: '≥ (supérieur ou égal à)' },
  { value: '>',  label: '> (strictement supérieur à)' },
  { value: '=',  label: '= (exactement)' },
];

export default function Step6Prorata({ config, onUpdate }) {
  const malusAssiduite = config.malus_assiduite || [];

  const addMalus = () => {
    onUpdate({
      ...config,
      malus_assiduite: [
        ...malusAssiduite,
        { id: `malus_${Date.now()}`, kpi: 'abs_injustifie', operateur: '>=', seuil: 1, malus_pct: 50, type: 'partiel' }
      ]
    });
  };

  const removeMalus = (id) => {
    onUpdate({ ...config, malus_assiduite: malusAssiduite.filter(m => m.id !== id) });
  };

  const updateMalus = (id, field, value) => {
    onUpdate({
      ...config,
      malus_assiduite: malusAssiduite.map(m => m.id === id ? { ...m, [field]: value } : m)
    });
  };

  return (
    <div className="gem-step">
      <h4 className="gem-mgmt-title">Prorata &amp; Présence</h4>
      <p className="gem-step-desc">
        Définissez comment la prime est ajustée selon le temps de présence de l'agent.
      </p>

      <div className="gem-ct-section">
        <label className="gem-ct-label">1. Choisir le mode de calcul</label>
        <div className="gem-ct-modes">
          {MODES_PRORATA.map(m => (
            <button
              key={m.value}
              type="button"
              className={`gem-ct-mode-btn${config.mode_prorata === m.value ? ' active' : ''}`}
              onClick={() => onUpdate({ ...config, mode_prorata: m.value })}
            >
              <div className="gem-ct-mode-icon">
                <i className={m.icon}></i>
              </div>
              <div className="gem-ct-mode-info">
                <span className="gem-ct-mode-title">{m.label}</span>
                <span className="gem-ct-mode-desc">
                  {m.value === 'jours' ? 'Prorata selon présence réelle (déduction faite des absences/congés)' : 
                   m.value === 'heures' ? 'Basé sur le pointage réel des heures' : 'Montant plein garanti (pas de prorata)'}
                </span>
              </div>
              {config.mode_prorata === m.value && <i className="fa-solid fa-circle-check gem-ct-active-tick"></i>}
            </button>
          ))}
        </div>
      </div>

      {config.mode_prorata !== 'aucun' && (
        <div className="gem-ct-config-card">
          <h4 className="gem-mgmt-title" style={{ marginTop: 0 }}>2. Paramètres du prorata</h4>
          <div className="gem-row gem-row--config" style={{ gap: '24px' }}>
            {config.mode_prorata === 'jours' && (
              <div className="gem-input-group">
                <label>Jours ouvrés mensuels</label>
                <div className="gem-input-with-unit">
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={config.jours_ouvres}
                    onChange={(e) => onUpdate({ ...config, jours_ouvres: parseInt(e.target.value) || 22 })}
                  />
                  <span className="gem-input-unit">jours</span>
                </div>
                <small className="gem-input-hint">Valeur par défaut : 22j</small>
              </div>
            )}

            {config.mode_prorata === 'heures' && (
              <div className="gem-input-group">
                <label>Base horaire mensuelle</label>
                <div className="gem-ct-bases">
                  {BASES_HORAIRES.map(b => (
                    <button
                      key={b}
                      type="button"
                      className={`gem-ct-base-btn${config.base_horaire === b ? ' active' : ''}`}
                      onClick={() => onUpdate({ ...config, base_horaire: b })}
                    >
                      {b}h
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="gem-input-group">
              <label>Seuil minimum de présence</label>
              <div className="gem-input-with-unit">
                <input
                  type="number"
                  min={0}
                  placeholder="Ex: 15"
                  value={config.seuil_minimum_jours ?? ''}
                  onChange={(e) => onUpdate({
                    ...config,
                    seuil_minimum_jours: e.target.value === '' ? null : parseInt(e.target.value)
                  })}
                />
                <span className="gem-input-unit">{config.mode_prorata === 'heures' ? 'heures' : 'jours'}</span>
              </div>
              <small className="gem-input-hint">Zéro versement sous ce seuil</small>
            </div>
          </div>
        </div>
      )}

      {config.mode_prorata !== 'aucun' && (
        <div className="gem-info-box gem-info-box--blue" style={{ marginTop: '20px' }}>
          <i className="fa-solid fa-circle-info"></i>
          <p>
            {config.mode_prorata === 'jours'
              ? <>La prime sera calculée au prorata des jours travaillés sur{' '}<strong>{config.jours_ouvres} jours</strong> ouvrés.</>
              : <>La prime sera calculée au prorata des heures réelles sur une base de{' '}<strong>{config.base_horaire}h</strong> mensuelles.</>
            }
            {config.seuil_minimum_jours ? (
              <> En dessous de{' '}<strong>{config.seuil_minimum_jours}{config.mode_prorata === 'heures' ? 'h' : ' jours'}</strong>,{' '}aucune prime n'est versée.</>
            ) : null}
          </p>
        </div>
      )}

      {config.mode_prorata === 'aucun' && (
        <div className="gem-info-box" style={{ marginTop: '20px' }}>
          <i className="fa-solid fa-circle-check"></i>
          <p>La prime sera versée en totalité, indépendamment du temps de présence.</p>
        </div>
      )}

      {/* ── Section 3 : Règles de Malus sur Assiduité ── */}
      <div className="gem-ct-section" style={{ marginTop: '32px' }}>
        <div className="gem-malus-header">
          <div>
            <label className="gem-ct-label">3. Règles de Malus — Absences &amp; Retards</label>
            <p className="gem-step-desc" style={{ margin: '4px 0 0' }}>
              Définissez les conditions automatiques de réduction ou suppression de la prime basées sur les données d'assiduité.
            </p>
          </div>
          <button type="button" className="btn gem-btn-add-malus" onClick={addMalus}>
            <i className="fa-solid fa-plus"></i> Ajouter une règle
          </button>
        </div>

        {malusAssiduite.length === 0 ? (
          <div className="gem-malus-empty">
            <i className="fa-solid fa-shield-halved"></i>
            <span>Aucune règle de malus configurée. La prime n'est pas impactée par l'assiduité.</span>
          </div>
        ) : (
          <div className="gem-malus-list">
            {malusAssiduite.map((rule, idx) => {
              const kpiDef = KPI_ASSIDUITE.find(k => k.value === rule.kpi);
              return (
                <div key={rule.id} className="gem-malus-rule">
                  <div className="gem-malus-rule__badge">Règle {idx + 1}</div>

                  <div className="gem-malus-rule__fields">
                    <div className="gem-input-group">
                      <label>Indicateur d'assiduité</label>
                      <select value={rule.kpi} onChange={(e) => updateMalus(rule.id, 'kpi', e.target.value)}>
                        {KPI_ASSIDUITE.map(k => (
                          <option key={k.value} value={k.value}>{k.icon} {k.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="gem-input-group" style={{ flex: '0 0 180px' }}>
                      <label>Condition</label>
                      <select value={rule.operateur} onChange={(e) => updateMalus(rule.id, 'operateur', e.target.value)}>
                        {OPERATORS.map(op => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="gem-input-group" style={{ flex: '0 0 90px' }}>
                      <label>Valeur seuil</label>
                      <input
                        type="number"
                        min={0}
                        value={rule.seuil}
                        onChange={(e) => updateMalus(rule.id, 'seuil', parseInt(e.target.value) || 0)}
                      />
                    </div>

                    <div className="gem-input-group" style={{ flex: '0 0 120px' }}>
                      <label>Type de malus</label>
                      <select value={rule.type} onChange={(e) => updateMalus(rule.id, 'type', e.target.value)}>
                        <option value="partiel">Partiel (%)</option>
                        <option value="total">Total (100%)</option>
                      </select>
                    </div>

                    {rule.type !== 'total' && (
                      <div className="gem-input-group" style={{ flex: '0 0 100px' }}>
                        <label>Malus %</label>
                        <div className="gem-input-with-unit">
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={rule.malus_pct}
                            onChange={(e) => updateMalus(rule.id, 'malus_pct', parseInt(e.target.value) || 0)}
                          />
                          <span className="gem-input-unit">%</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="gem-malus-rule__summary">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    Si <strong>{kpiDef?.label || rule.kpi}</strong> {rule.operateur} <strong>{rule.seuil}</strong>
                    {' → '}
                    {rule.type === 'total'
                      ? <span className="gem-malus-tag gem-malus-tag--total">Prime supprimée (100%)</span>
                      : <span className="gem-malus-tag gem-malus-tag--partial">Prime réduite de {rule.malus_pct}%</span>
                    }
                  </div>

                  <button type="button" className="gem-btn-icon danger gem-malus-rule__delete" onClick={() => removeMalus(rule.id)} title="Supprimer cette règle">
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {malusAssiduite.length > 0 && (
          <div className="gem-info-box gem-info-box--orange" style={{ marginTop: '16px' }}>
            <i className="fa-solid fa-triangle-exclamation"></i>
            <p>Les règles sont appliquées dans l'ordre. Si plusieurs règles se déclenchent, le <strong>malus le plus élevé</strong> est retenu.</p>
          </div>
        )}
      </div>
    </div>
  );
}



