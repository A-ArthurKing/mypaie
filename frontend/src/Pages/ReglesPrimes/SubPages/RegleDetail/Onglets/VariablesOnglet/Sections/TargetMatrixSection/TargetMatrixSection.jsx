/*
 * Fichier     : TargetMatrixSection.jsx
 * Rôle        : Section "Postes & Objectifs Cibles" de l'onglet Variables.
 *               Permet de définir les postes d'agents (CP SE, PV SE, etc.)
 *               et leurs objectifs cibles par KPI et par niveau d'ancienneté
 *               (Débutant / Confirmé / Sénior), ainsi que le montant brut de prime.
 *               Correspond directement à la feuille OBJECTIFS!C9:J18 de l'Excel source.
 * Dépendances : grille_objectifs.indicateurs (définis dans l'onglet Objectifs)
 * Module      : mypaie / Pages / ReglesPrimes / SubPages / Onglets / VariablesOnglet / Sections
 */

import React, { useState, useEffect } from 'react';
import './TargetMatrixSection.css';

// #region CONSTANTES
// Niveaux d'ancienneté : correspondance exacte avec l'Excel (Débutant / Confirmé / Sénior)
const NIVEAUX = [
  { key: 'debutant', label: 'Débutant' },
  { key: 'confirme', label: 'Confirmé' },
  { key: 'senior',   label: 'Sénior'   },
];

// Fabrique un poste vierge avec des niveaux pré-initialisés
const makePoste = () => ({
  id: `poste_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  code: '',
  niveaux: {
    debutant: { montant: 0, objectifs: {} },
    confirme: { montant: 0, objectifs: {} },
    senior:   { montant: 0, objectifs: {} },
  },
});
// #endregion

export default function TargetMatrixSection({ regle, onSave }) {

  // #region STATE
  const [postes, setPostes] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  // #endregion

  // #region INITIALISATION
  // Charge les postes existants depuis la règle, ou crée un poste vierge par défaut
  useEffect(() => {
    if (regle?.grille_objectifs?.postes?.length) {
      setPostes(regle.grille_objectifs.postes);
    } else {
      setPostes([makePoste()]);
    }
  }, [regle]);
  // #endregion

  // #region DONNÉES DÉRIVÉES
  const indicateurs = regle?.grille_objectifs?.indicateurs || [];
  const hasIndicateurs = indicateurs.length > 0;
  // #endregion

  // #region HANDLERS
  // Met à jour le code (libellé) d'un poste
  const handleCodeChange = (posteId, val) => {
    setPostes(prev => prev.map(p =>
      p.id === posteId ? { ...p, code: val } : p
    ));
  };

  // Met à jour le montant brut de prime pour un niveau donné
  const handleMontantChange = (posteId, niveauKey, val) => {
    const num = parseFloat(val) || 0;
    setPostes(prev => prev.map(p => {
      if (p.id !== posteId) return p;
      return {
        ...p,
        niveaux: {
          ...p.niveaux,
          [niveauKey]: { ...p.niveaux[niveauKey], montant: num },
        },
      };
    }));
  };

  // Met à jour la valeur cible d'un KPI pour un poste et un niveau donnés
  const handleObjectifChange = (posteId, niveauKey, kpiId, val) => {
    const num = parseFloat(val);
    const finalVal = isNaN(num) ? '' : num;
    setPostes(prev => prev.map(p => {
      if (p.id !== posteId) return p;
      return {
        ...p,
        niveaux: {
          ...p.niveaux,
          [niveauKey]: {
            ...p.niveaux[niveauKey],
            objectifs: { ...p.niveaux[niveauKey].objectifs, [kpiId]: finalVal },
          },
        },
      };
    }));
  };

  // Ajoute un nouveau poste vierge à la liste
  const handleAddPoste = () => setPostes(prev => [...prev, makePoste()]);

  // Supprime un poste par son identifiant (interdit si dernier poste)
  const handleDeletePoste = (posteId) => {
    if (postes.length <= 1) return;
    setPostes(prev => prev.filter(p => p.id !== posteId));
  };

  // Persiste les postes dans grille_objectifs via le handler parent
  const handleSave = async () => {
    setIsSaving(true);
    const newGrille = { ...regle.grille_objectifs, postes };
    await onSave(newGrille);
    setIsSaving(false);
  };
  // #endregion

  // #region RENDERING — ÉTAT VIDE
  if (!hasIndicateurs) {
    return (
      <div className="tm-section tm-section--empty">
        <i className="fa-solid fa-triangle-exclamation"></i>
        <p>
          Veuillez d'abord configurer les indicateurs dans l'onglet{' '}
          <strong>Objectifs</strong>, puis leurs pondérations dans la section{' '}
          <strong>Pondération</strong>.
        </p>
      </div>
    );
  }
  // #endregion

  // #region RENDERING — PRINCIPAL
  return (
    <div className="tm-section">

      {/* ── En-tête de section ── */}
      <div className="tm-section__header">
        <div className="tm-section__title-group">
          <h3 className="tm-section__title">Postes & Objectifs Cibles</h3>
          <p className="tm-section__subtitle">
            Définissez le montant de prime et les objectifs KPI par poste et par niveau d'ancienneté.
          </p>
        </div>
      </div>

      {/* ── Liste des cartes poste ── */}
      <div className="tm-postes-list">
        {postes.map((poste) => (
          <div key={poste.id} className="tm-poste-card">

            {/* En-tête du poste : champ code + bouton suppression */}
            <div className="tm-poste-card__header">
              <div className="tm-poste-card__label-group">
                <i className="fa-solid fa-id-badge tm-poste-card__icon"></i>
                <input
                  className="tm-poste-card__code-input"
                  type="text"
                  value={poste.code}
                  onChange={(e) => handleCodeChange(poste.id, e.target.value)}
                  placeholder="Code poste (ex : CP SE, PV SE…)"
                />
              </div>
              <button
                className="tm-poste-card__delete-btn"
                onClick={() => handleDeletePoste(poste.id)}
                title="Supprimer ce poste"
                disabled={postes.length <= 1}
              >
                <i className="fa-solid fa-trash"></i> Supprimer
              </button>
            </div>

            {/* Tableau : une ligne par KPI + ligne prime, une colonne par niveau */}
            <div className="tm-table-wrapper">
              <table className="tm-table">
                <thead>
                  <tr>
                    <th className="tm-table__kpi-col">Indicateur</th>
                    {NIVEAUX.map(n => (
                      <th key={n.key} className="tm-table__niveau-col">{n.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>

                  {/* Ligne spéciale : montant brut de la prime */}
                  <tr className="tm-table__row--prime">
                    <td className="tm-table__kpi-cell">
                      <i className="fa-solid fa-euro-sign"></i>
                      <span>Montant Prime (€ brut)</span>
                    </td>
                    {NIVEAUX.map(n => (
                      <td key={n.key} className="tm-table__value-cell">
                        <input
                          type="number"
                          className="tm-table__input tm-table__input--prime"
                          value={poste.niveaux[n.key]?.montant ?? 0}
                          onChange={(e) => handleMontantChange(poste.id, n.key, e.target.value)}
                          min="0"
                          step="50"
                        />
                      </td>
                    ))}
                  </tr>

                  {/* Une ligne par KPI/indicateur défini dans l'onglet Objectifs */}
                  {indicateurs.map(ind => (
                    <tr key={ind.id} className="tm-table__row--kpi">
                      <td className="tm-table__kpi-cell">
                        <span className="tm-table__kpi-cat">{ind.categorie}</span>
                        <span className="tm-table__kpi-name">{ind.nom}</span>
                      </td>
                      {NIVEAUX.map(n => (
                        <td key={n.key} className="tm-table__value-cell">
                          <input
                            type="number"
                            className="tm-table__input"
                            value={poste.niveaux[n.key]?.objectifs?.[ind.id] ?? ''}
                            onChange={(e) => handleObjectifChange(poste.id, n.key, ind.id, e.target.value)}
                            placeholder="—"
                            step="any"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}

                </tbody>
              </table>
            </div>

          </div>
        ))}
      </div>

      {/* ── Pied de section : ajouter un poste + enregistrer ── */}
      <div className="tm-section__footer">
        <button className="btn btn-outline" onClick={handleAddPoste}>
          <i className="fa-solid fa-plus"></i> Ajouter un poste
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Enregistrement...' : 'Enregistrer les cibles'}
        </button>
      </div>

    </div>
  );
  // #endregion
}
