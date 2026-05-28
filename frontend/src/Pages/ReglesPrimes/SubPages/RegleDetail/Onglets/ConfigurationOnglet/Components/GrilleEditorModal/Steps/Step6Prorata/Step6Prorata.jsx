/*
 * Fichier : Step6Prorata.jsx
 * Rôle    : Étape 6 du GrilleEditorModal - Configuration du prorata et de la présence.
 */
import React from 'react';
import './Step6Prorata.css';

const MODES_PRORATA = [
  { value: 'jours',  label: 'Jours travaillés', icon: 'fa-solid fa-calendar-days' },
  { value: 'heures', label: 'Heures réelles',    icon: 'fa-solid fa-clock' },
  { value: 'aucun',  label: 'Pas de prorata',    icon: 'fa-solid fa-ban' },
];
const BASES_HORAIRES = [169, 176, 191];

export default function Step6Prorata({ config, onUpdate }) {
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
                  {m.value === 'jours' ? 'Basé sur les jours de production' : 
                   m.value === 'heures' ? 'Basé sur le pointage réel' : 'Montant plein garanti'}
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
              ? <>
                  La prime sera calculée au prorata des jours travaillés sur{' '}
                  <strong>{config.jours_ouvres} jours</strong> ouvrés.
                </>
              : <>
                  La prime sera calculée au prorata des heures réelles sur une base de{' '}
                  <strong>{config.base_horaire}h</strong> mensuelles.
                </>
            }
            {config.seuil_minimum_jours ? (
              <> En dessous de{' '}
                <strong>{config.seuil_minimum_jours}{config.mode_prorata === 'heures' ? 'h' : ' jours'}</strong>,{' '}
                aucune prime n'est versée.
              </>
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
    </div>
  );
}
