/*
 * Fichier     : TempsProrataSection.jsx
 * Rôle        : Section C "Configuration Temps & Prorata" de l'onglet Variables.
 *               Définit les paramètres temporels nécessaires au calcul du prorata
 *               de présence appliqué sur la prime brute :
 *                 Prime Proratée = Prime Brute × (Jours travaillés / Jours ouvrés)
 *               Correspond à la logique de la colonne Prorata de l'Excel source.
 * Dépendances : grille_objectifs.config_temps
 * Module      : mypaie / Pages / ReglesPrimes / SubPages / Onglets / VariablesOnglet / Sections
 */

import React, { useState, useEffect } from 'react';
import './TempsProrataSection.css';

// #region CONSTANTES
// Bases horaires mensuelles courantes (contrats France)
const BASES_HORAIRES_PRESET = [
  { label: '169 h',  value: 169, hint: 'Temps plein standard (35h × 4,33)' },
  { label: '176 h',  value: 176, hint: 'Temps plein majoré (40h × 4,33 approx.)' },
  { label: '191 h',  value: 191, hint: 'Base spécifique projet (ex : APEN SE)' },
  { label: 'Autre',  value: 'custom', hint: 'Saisie manuelle' },
];

// Modes de calcul du prorata
const MODES_PRORATA = [
  {
    key:   'jours',
    label: 'Par jours ouvrés',
    icon:  'fa-solid fa-calendar-day',
    hint:  'Prorata = Jours travaillés ÷ Jours ouvrés du mois',
  },
  {
    key:   'heures',
    label: 'Par heures effectuées',
    icon:  'fa-solid fa-clock',
    hint:  'Prorata = Heures réalisées ÷ Base horaire mensuelle',
  },
  {
    key:   'aucun',
    label: 'Aucun prorata',
    icon:  'fa-solid fa-circle-check',
    hint:  'La prime est versée intégralement, peu importe le temps de présence',
  },
];

const DEFAULT_CONFIG = {
  jours_ouvres:        22,
  base_horaire:        191,
  mode_prorata:        'jours',
  seuil_minimum_jours: null,   // null = pas de seuil minimum
};
// #endregion

// #region HELPERS
// Calcule un exemple de prime proratée pour l'aperçu
const calcExemple = (config, montantExemple = 500) => {
  if (config.mode_prorata === 'aucun') return montantExemple;
  if (config.mode_prorata === 'heures') {
    const heuresTravaillees = Math.round(config.base_horaire * 0.9);
    return ((montantExemple * heuresTravaillees) / config.base_horaire).toFixed(2);
  }
  const joursTravailles = Math.round(config.jours_ouvres * 0.85);
  return ((montantExemple * joursTravailles) / config.jours_ouvres).toFixed(2);
};
// #endregion

export default function TempsProrataSection({ regle, onSave }) {

  // #region STATE
  const [config, setConfig]           = useState(DEFAULT_CONFIG);
  const [baseMode, setBaseMode]       = useState('191');  // preset sélectionné (string)
  const [baseCustom, setBaseCustom]   = useState('');
  const [avecSeuil, setAvecSeuil]     = useState(false);
  const [isSaving, setIsSaving]       = useState(false);
  // #endregion

  // #region INITIALISATION
  useEffect(() => {
    const saved = regle?.grille_objectifs?.config_temps;
    if (saved) {
      setConfig(saved);
      setAvecSeuil(saved.seuil_minimum_jours !== null);
      const presetMatch = BASES_HORAIRES_PRESET.find(
        b => b.value === saved.base_horaire && b.value !== 'custom'
      );
      if (presetMatch) {
        setBaseMode(String(presetMatch.value));
      } else {
        setBaseMode('custom');
        setBaseCustom(String(saved.base_horaire));
      }
    } else {
      setConfig(DEFAULT_CONFIG);
      setBaseMode('191');
    }
  }, [regle]);
  // #endregion

  // #region HANDLERS
  const handleField = (field, val) => {
    setConfig(prev => ({ ...prev, [field]: val }));
  };

  // Sélection d'une base horaire preset
  const handleBasePreset = (val) => {
    setBaseMode(val);
    if (val !== 'custom') {
      handleField('base_horaire', parseInt(val, 10));
    }
  };

  // Saisie base horaire custom
  const handleBaseCustom = (val) => {
    setBaseCustom(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      handleField('base_horaire', num);
    }
  };

  // Toggle du seuil minimum
  const handleToggleSeuil = () => {
    const next = !avecSeuil;
    setAvecSeuil(next);
    handleField('seuil_minimum_jours', next ? 15 : null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const newGrille = { ...regle.grille_objectifs, config_temps: config };
    await onSave(newGrille);
    setIsSaving(false);
  };
  // #endregion

  // #region RENDERING — APERÇU FORMULE
  const renderApercu = () => {
    const montantEx  = 500;
    const resultatEx = calcExemple(config, montantEx);

    let formuleText;
    if (config.mode_prorata === 'aucun') {
      formuleText = `${montantEx} € (prime versée intégralement)`;
    } else if (config.mode_prorata === 'heures') {
      const hEx = Math.round(config.base_horaire * 0.9);
      formuleText = `${montantEx} × ${hEx}h / ${config.base_horaire}h = ${resultatEx} €`;
    } else {
      const jEx = Math.round(config.jours_ouvres * 0.85);
      formuleText = `${montantEx} × ${jEx}j / ${config.jours_ouvres}j = ${resultatEx} €`;
    }

    return (
      <div className="tp-apercu">
        <div className="tp-apercu__label">
          <i className="fa-solid fa-flask-vial"></i>
          Aperçu avec une prime de <strong>{montantEx} €</strong>
          {config.mode_prorata !== 'aucun' && (
            <span className="tp-apercu__hint">
              (exemple à {config.mode_prorata === 'heures' ? '90%' : '85%'} de présence)
            </span>
          )}
        </div>
        <div className="tp-apercu__formula">{formuleText}</div>
        {config.seuil_minimum_jours !== null && (
          <div className="tp-apercu__warning">
            <i className="fa-solid fa-triangle-exclamation"></i>
            Si l'agent travaille moins de <strong>{config.seuil_minimum_jours} jours</strong>,
            aucune prime ne sera versée.
          </div>
        )}
      </div>
    );
  };
  // #endregion

  // #region RENDERING — PRINCIPAL
  return (
    <div className="tp-section">

      {/* ── Ligne 1 : Jours ouvrés + Base horaire côte à côte ── */}
      <div className="tp-cards-row">

        {/* Carte : Jours ouvrés */}
        <div className="tp-card">
          <div className="tp-card__header">
            <i className="fa-solid fa-calendar-days"></i>
            <span className="tp-card__title">Jours ouvrés du mois</span>
          </div>
          <div className="tp-card__body">
            <div className="tp-jours-input">
              <input
                type="number"
                className="tp-input tp-input--big"
                value={config.jours_ouvres}
                min={1}
                max={31}
                onChange={(e) => handleField('jours_ouvres', parseInt(e.target.value, 10) || 0)}
              />
              <span className="tp-input__unit">jours</span>
            </div>
            <p className="tp-card__hint">
              Nombre de jours travaillables dans le mois (hors week-ends et jours fériés).
            </p>
          </div>
        </div>

        {/* Carte : Base horaire */}
        <div className="tp-card">
          <div className="tp-card__header">
            <i className="fa-solid fa-hourglass-half"></i>
            <span className="tp-card__title">Base horaire mensuelle</span>
          </div>
          <div className="tp-card__body">
            <div className="tp-presets">
              {BASES_HORAIRES_PRESET.map(preset => (
                <button
                  key={preset.value}
                  type="button"
                  className={`tp-preset-btn ${baseMode === String(preset.value) ? 'tp-preset-btn--active' : ''}`}
                  onClick={() => handleBasePreset(String(preset.value))}
                  title={preset.hint}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {baseMode === 'custom' && (
              <div className="tp-jours-input" style={{ marginTop: '10px' }}>
                <input
                  type="number"
                  className="tp-input tp-input--big"
                  value={baseCustom}
                  min={1}
                  max={300}
                  placeholder="Ex: 151"
                  onChange={(e) => handleBaseCustom(e.target.value)}
                />
                <span className="tp-input__unit">heures</span>
              </div>
            )}
            <p className="tp-card__hint">
              Référence contractuelle (utilisée si le mode prorata est "Par heures").
            </p>
          </div>
        </div>
      </div>

      {/* ── Mode de calcul du prorata ── */}
      <div className="tp-field-group">
        <label className="tp-field-label">
          <i className="fa-solid fa-sliders"></i>
          Mode de calcul du prorata
        </label>
        <div className="tp-mode-cards">
          {MODES_PRORATA.map(mode => (
            <button
              key={mode.key}
              type="button"
              className={`tp-mode-card ${config.mode_prorata === mode.key ? 'tp-mode-card--active' : ''}`}
              onClick={() => handleField('mode_prorata', mode.key)}
            >
              <i className={`${mode.icon} tp-mode-card__icon`}></i>
              <span className="tp-mode-card__label">{mode.label}</span>
              <span className="tp-mode-card__hint">{mode.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Seuil minimum de jours travaillés ── */}
      <div className="tp-field-group">
        <div className="tp-seuil-header">
          <div className="tp-field-label">
            <i className="fa-solid fa-gate"></i>
            Seuil minimum de présence
          </div>
          {/* Toggle switch */}
          <button
            type="button"
            role="switch"
            aria-checked={avecSeuil}
            className={`tp-toggle ${avecSeuil ? 'tp-toggle--on' : ''}`}
            onClick={handleToggleSeuil}
          >
            <span className="tp-toggle__thumb"></span>
          </button>
        </div>
        {avecSeuil && (
          <div className="tp-seuil-body">
            <p className="tp-seuil-desc">
              En dessous de ce nombre de jours travaillés, aucune prime ne sera versée.
            </p>
            <div className="tp-jours-input">
              <input
                type="number"
                className="tp-input tp-input--big"
                value={config.seuil_minimum_jours ?? 15}
                min={1}
                max={config.jours_ouvres - 1}
                onChange={(e) => handleField('seuil_minimum_jours', parseInt(e.target.value, 10) || 1)}
              />
              <span className="tp-input__unit">jours minimum</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Aperçu de la formule ── */}
      {renderApercu()}

      {/* ── Pied : enregistrer ── */}
      <div className="tp-footer">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={isSaving}
          type="button"
        >
          {isSaving ? 'Enregistrement...' : 'Enregistrer la configuration'}
        </button>
      </div>

    </div>
  );
  // #endregion
}
