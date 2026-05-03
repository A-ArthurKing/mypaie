/*
 * Fichier     : PaliersSection.jsx
 * Rôle        : Section "Paliers de Performance" de l'onglet Variables.
 *               Permet de configurer les seuils de conversion du % d'atteinte
 *               d'un KPI en nb de points. Chaque palier définit une plage de %
 *               et un multiplicateur appliqué au poids du KPI.
 *               Correspond aux cellules OBJECTIFS!E56:I60 de l'Excel source.
 *               Formule cible : IF(atteinte < seuil1, 0, IF(atteinte < seuil2, pts*mult1, ...))
 * Dépendances : grille_objectifs (via prop regle)
 * Module      : mypaie / Pages / ReglesPrimes / SubPages / Onglets / VariablesOnglet / Sections
 */

import React, { useState, useEffect } from 'react';
import './PaliersSection.css';

// #region CONSTANTES
// Paliers par défaut extraits du reverse-engineering de l'Excel source
const DEFAULT_PALIERS = [
  { id: 1, label: 'Insuffisant', seuil_max: 70,  multiplicateur: 0,    couleur: '#f87171', locked: true  },
  { id: 2, label: 'Partiel',     seuil_max: 85,  multiplicateur: 0.50, couleur: '#f59e0b', locked: false },
  { id: 3, label: 'Correct',     seuil_max: 100, multiplicateur: 0.75, couleur: '#38bdf8', locked: false },
  { id: 4, label: 'Atteint',     seuil_max: null, multiplicateur: 1.0, couleur: '#22c55e', locked: true  },
];

const COULEURS_DISPONIBLES = ['#f87171', '#fb923c', '#f59e0b', '#a3e635', '#38bdf8', '#818cf8', '#22c55e'];
// #endregion

// #region HELPERS
// Formate un multiplicateur (0.5 → "50%", 1.0 → "100%")
const formatMult = (val) => `${Math.round(val * 100)}%`;

// Calcule le seuil_min d'un palier à partir du seuil_max du précédent
const getSeuils = (paliers, index) => {
  const min = index === 0 ? 0 : paliers[index - 1].seuil_max;
  const max = paliers[index].seuil_max;
  return { min, max };
};
// #endregion

export default function PaliersSection({ regle, onSave }) {

  // #region STATE
  const [paliers, setPaliers] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  // #endregion

  // #region INITIALISATION
  // Charge les paliers existants depuis la règle, ou applique les défauts Excel
  useEffect(() => {
    if (regle?.grille_objectifs?.paliers_scoring?.length) {
      setPaliers(regle.grille_objectifs.paliers_scoring);
    } else {
      setPaliers(DEFAULT_PALIERS);
    }
  }, [regle]);
  // #endregion

  // #region HANDLERS
  // Met à jour un champ d'un palier par son id
  const handleUpdate = (id, field, val) => {
    setPaliers(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  // Met à jour le seuil_max en valeur numérique validée
  const handleSeuilChange = (id, val) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      handleUpdate(id, 'seuil_max', num);
    }
  };

  // Met à jour le multiplicateur (saisi en %, converti en décimal)
  const handleMultChange = (id, val) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      handleUpdate(id, 'multiplicateur', num / 100);
    }
  };

  // Ajoute un palier intermédiaire avant le dernier (Atteint)
  const handleAddPalier = () => {
    const last = paliers[paliers.length - 1];
    const avantDernier = paliers[paliers.length - 2];
    const newSeuil = avantDernier?.seuil_max ? Math.min(avantDernier.seuil_max + 5, 99) : 90;

    const newPalier = {
      id: Date.now(),
      label: 'Nouveau palier',
      seuil_max: newSeuil,
      multiplicateur: 0.80,
      couleur: '#818cf8',
      locked: false,
    };

    // Insère avant le palier "Atteint" (locked final)
    setPaliers(prev => [
      ...prev.slice(0, prev.length - 1),
      newPalier,
      last,
    ]);
  };

  // Supprime un palier non verrouillé
  const handleDeletePalier = (id) => {
    setPaliers(prev => prev.filter(p => p.id !== id));
  };

  // Persiste les paliers dans grille_objectifs
  const handleSave = async () => {
    setIsSaving(true);
    const newGrille = { ...regle.grille_objectifs, paliers_scoring: paliers };
    await onSave(newGrille);
    setIsSaving(false);
  };
  // #endregion

  // #region RENDERING — BARRE DE VISUALISATION
  // Construit la barre de progression colorée représentant les paliers
  const renderVisualBar = () => {
    // Calcul des largeurs proportionnelles de chaque segment
    const segments = paliers.map((p, i) => {
      const { min, max } = getSeuils(paliers, i);
      const width = max !== null ? max - min : 15; // Le dernier prend ~15%
      return { ...p, width };
    });

    const total = segments.reduce((acc, s) => acc + s.width, 0);

    return (
      <div className="ps-bar">
        {segments.map((seg, i) => (
          <div
            key={seg.id}
            className="ps-bar__segment"
            style={{ width: `${(seg.width / total) * 100}%`, background: seg.couleur }}
            title={`${seg.label} : × ${formatMult(seg.multiplicateur)}`}
          >
            <span className="ps-bar__label">{seg.label}</span>
            <span className="ps-bar__mult">{formatMult(seg.multiplicateur)}</span>
          </div>
        ))}
      </div>
    );
  };
  // #endregion

  // #region RENDERING — PRINCIPAL
  return (
    <div className="ps-section">

      {/* Barre de visualisation des paliers */}
      {renderVisualBar()}

      {/* Légende des paliers éditables */}
      <div className="ps-legend">
        <div className="ps-legend__header">
          <span>Palier</span>
          <span>Plage d'atteinte</span>
          <span>Multiplicateur</span>
          <span>Couleur</span>
          <span></span>
        </div>

        {paliers.map((palier, index) => {
          const { min } = getSeuils(paliers, index);
          return (
            <div key={palier.id} className={`ps-legend__row ${palier.locked ? 'ps-legend__row--locked' : ''}`}>

              {/* Nom du palier */}
              <div className="ps-legend__cell">
                <span
                  className="ps-legend__dot"
                  style={{ background: palier.couleur }}
                ></span>
                <input
                  type="text"
                  className="ps-input ps-input--label"
                  value={palier.label}
                  onChange={(e) => handleUpdate(palier.id, 'label', e.target.value)}
                  disabled={palier.locked}
                />
              </div>

              {/* Plage : de X% à Y% */}
              <div className="ps-legend__cell ps-legend__cell--range">
                <span className="ps-range__from">{min}%</span>
                <span className="ps-range__sep">→</span>
                {palier.seuil_max !== null ? (
                  <input
                    type="number"
                    className="ps-input ps-input--seuil"
                    value={palier.seuil_max}
                    onChange={(e) => handleSeuilChange(palier.id, e.target.value)}
                    min={min + 1}
                    max={99}
                    disabled={palier.locked}
                  />
                ) : (
                  <span className="ps-range__infinity">∞</span>
                )}
                {palier.seuil_max !== null && <span className="ps-range__unit">%</span>}
              </div>

              {/* Multiplicateur saisi en % */}
              <div className="ps-legend__cell ps-legend__cell--mult">
                <input
                  type="number"
                  className="ps-input ps-input--mult"
                  value={Math.round(palier.multiplicateur * 100)}
                  onChange={(e) => handleMultChange(palier.id, e.target.value)}
                  min={0}
                  max={100}
                  disabled={palier.locked}
                />
                <span className="ps-range__unit">%</span>
                <span className="ps-mult__hint">des points</span>
              </div>

              {/* Sélecteur de couleur */}
              <div className="ps-legend__cell ps-legend__cell--colors">
                {COULEURS_DISPONIBLES.map(c => (
                  <button
                    key={c}
                    className={`ps-color-dot ${palier.couleur === c ? 'ps-color-dot--active' : ''}`}
                    style={{ background: c }}
                    onClick={() => !palier.locked && handleUpdate(palier.id, 'couleur', c)}
                    disabled={palier.locked}
                    title={c}
                    type="button"
                  />
                ))}
              </div>

              {/* Bouton suppression (uniquement paliers non verrouillés) */}
              <div className="ps-legend__cell ps-legend__cell--action">
                {!palier.locked ? (
                  <button
                    className="btn-icon danger"
                    onClick={() => handleDeletePalier(palier.id)}
                    title="Supprimer ce palier"
                    type="button"
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                ) : (
                  <span className="ps-locked-badge" title="Palier système non modifiable">
                    <i className="fa-solid fa-lock"></i>
                  </span>
                )}
              </div>

            </div>
          );
        })}
      </div>

      {/* Pied : ajouter un palier + enregistrer */}
      <div className="ps-footer">
        <button className="btn btn-outline" onClick={handleAddPalier} type="button">
          <i className="fa-solid fa-plus"></i> Ajouter un palier
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={isSaving} type="button">
          {isSaving ? 'Enregistrement...' : 'Enregistrer les paliers'}
        </button>
      </div>

    </div>
  );
  // #endregion
}
