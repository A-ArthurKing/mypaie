/*
 * Fichier : TriggerRulesSection.jsx
 * Rôle    : Configuration des déclencheurs de perte de prime.
 *           Supporte deux types :
 *             - "event"  : Dès N [événement] → impact  (ex. Réclamation client)
 *             - "kpi"    : Si [KPI] [opérateur] [valeur] → impact  (seuil KPI)
 * Dépend  : TriggerRulesSection.css, /api/regles/:id/grille
 * Module  : mypaie / Pages / ReglesPrimes / SubPages / RegleDetail / CadrePresenceOnglet
 */
import React, { useState, useEffect, useMemo } from 'react';
import './TriggerRulesSection.css';

const OPERATORS = [
  { value: '<',  symbol: '<'  },
  { value: '<=', symbol: '≤'  },
  { value: '=',  symbol: '='  },
  { value: '>=', symbol: '≥'  },
  { value: '>',  symbol: '>'  },
];

const DEFAULT_TRIGGERS = [
  { id: 1, type: 'event', label: 'Réclamation client', count: 1, impact: 'Toute la prime est perdue' },
];

export default function TriggerRulesSection({ regle, onSave }) {
  const [triggers, setTriggers] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // KPIs configurés pour cette règle (issues de toutes les grilles)
  const kpiOptions = useMemo(() => {
    const grille = regle?.grille_objectifs;
    const all = grille?.indicateurs || [];
    // dédoublonnage par id
    const seen = new Set();
    return all.filter(k => {
      if (seen.has(k.id)) return false;
      seen.add(k.id);
      return true;
    }).map(k => ({ value: k.id, label: k.nom || k.label || k.id }));
  }, [regle]);

  useEffect(() => {
    if (regle?.grille_objectifs?.declencheurs?.length) {
      // Migration : injecter type='event' sur les anciens déclencheurs sans type
      setTriggers(
        regle.grille_objectifs.declencheurs.map(t => ({ type: 'event', ...t }))
      );
    } else {
      setTriggers(DEFAULT_TRIGGERS);
    }
  }, [regle]);

  const handleUpdate = (id, field, val) => {
    setTriggers(prev => prev.map(t => t.id === id ? { ...t, [field]: val } : t));
  };

  const switchType = (id, newType) => {
    setTriggers(prev => prev.map(t => {
      if (t.id !== id) return t;
      if (newType === 'kpi') return { id: t.id, type: 'kpi', kpi_id: '', operator: '<', value: '', impact: t.impact || '' };
      return { id: t.id, type: 'event', label: '', count: 1, impact: t.impact || '' };
    }));
  };

  const addTrigger = (type) => {
    const base = { id: Date.now(), type, impact: '' };
    if (type === 'event') {
      setTriggers(prev => [...prev, { ...base, label: '', count: 1 }]);
    } else {
      setTriggers(prev => [...prev, { ...base, kpi_id: '', operator: '<', value: '' }]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onSave({ ...regle.grille_objectifs, declencheurs: triggers });
    setIsSaving(false);
  };

  return (
    <div className="trs-section">
      <div className="trs-header">
        <h3 className="trs-title">Éléments déclencheurs (Killing Rules)</h3>
        <p className="trs-subtitle">
          Conditions critiques entraînant une perte immédiate de prime —
          par <strong>événement</strong> (incident, réclamation…) ou par <strong>seuil KPI</strong>.
        </p>
      </div>

      <div className="trs-list">
        {triggers.length === 0 && (
          <div className="trs-empty">
            <i className="fa-solid fa-skull-crossbones"></i>
            Aucun déclencheur configuré.
          </div>
        )}

        {triggers.map((trigger) => {
          const isKpi = trigger.type === 'kpi';
          return (
            <div key={trigger.id} className={`trs-item trs-item--${isKpi ? 'kpi' : 'event'}`}>

              {/* ── Toggle type ── */}
              <div className="trs-type-toggle">
                <button
                  type="button"
                  className={`trs-type-btn${!isKpi ? ' active active--event' : ''}`}
                  onClick={() => !isKpi || switchType(trigger.id, 'event')}
                  title="Déclencheur événement"
                >
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  Événement
                </button>
                <button
                  type="button"
                  className={`trs-type-btn${isKpi ? ' active active--kpi' : ''}`}
                  onClick={() => isKpi || switchType(trigger.id, 'kpi')}
                  title="Condition sur seuil KPI"
                >
                  <i className="fa-solid fa-chart-line"></i>
                  KPI
                </button>
              </div>

              {/* ── Condition ── */}
              {!isKpi ? (
                <div className="trs-item-config">
                  <span className="trs-prefix">Dès</span>
                  <input
                    type="number"
                    className="trs-count"
                    value={trigger.count ?? ''}
                    placeholder="N"
                    min={1}
                    onChange={(e) => handleUpdate(trigger.id, 'count', e.target.value === '' ? '' : parseInt(e.target.value) || 1)}
                  />
                  <input
                    className="trs-label"
                    value={trigger.label || ''}
                    onChange={(e) => handleUpdate(trigger.id, 'label', e.target.value)}
                    placeholder="Ex: Réclamation client"
                  />
                </div>
              ) : (
                <div className="trs-item-kpi">
                  <span className="trs-prefix trs-prefix--kpi">Si</span>
                  <select
                    className="trs-kpi-select"
                    value={trigger.kpi_id || ''}
                    onChange={(e) => handleUpdate(trigger.id, 'kpi_id', e.target.value)}
                  >
                    <option value="">— Choisir un KPI —</option>
                    {kpiOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <select
                    className="trs-operator-select"
                    value={trigger.operator || '<'}
                    onChange={(e) => handleUpdate(trigger.id, 'operator', e.target.value)}
                  >
                    {OPERATORS.map(op => (
                      <option key={op.value} value={op.value}>{op.symbol}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="trs-kpi-value"
                    value={trigger.value ?? ''}
                    placeholder="Ex: 80"
                    onChange={(e) => handleUpdate(trigger.id, 'value', e.target.value === '' ? '' : parseFloat(e.target.value))}
                  />
                  <span className="trs-unit">%</span>
                </div>
              )}

              {/* ── Impact ── */}
              <div className="trs-item-impact">
                <i className="fa-solid fa-arrow-right"></i>
                <input
                  className="trs-impact-input"
                  value={trigger.impact || ''}
                  onChange={(e) => handleUpdate(trigger.id, 'impact', e.target.value)}
                  placeholder="Impact sur la prime (ex: Toute la prime est perdue)"
                />
              </div>

              <button
                type="button"
                className="btn-icon danger"
                onClick={() => setTriggers(prev => prev.filter(t => t.id !== trigger.id))}
                title="Supprimer ce déclencheur"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          );
        })}
      </div>

      <div className="trs-footer">
        <div className="trs-add-group">
          <button type="button" className="btn btn-outline" onClick={() => addTrigger('event')}>
            <i className="fa-solid fa-triangle-exclamation"></i>
            Événement
          </button>
          <button type="button" className="btn btn-outline trs-btn-kpi" onClick={() => addTrigger('kpi')}>
            <i className="fa-solid fa-chart-line"></i>
            Condition KPI
          </button>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <><i className="fa-solid fa-spinner fa-spin"></i> Enregistrement…</> : 'Enregistrer les déclencheurs'}
        </button>
      </div>
    </div>
  );
}
