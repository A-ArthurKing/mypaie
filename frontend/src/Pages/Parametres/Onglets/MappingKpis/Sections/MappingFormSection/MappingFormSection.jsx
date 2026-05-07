/*
 * Fichier : MappingFormSection.jsx
 * Rôle    : Formulaire de création et d'édition d'un mapping KPI
 *           (colonne source BigQuery → KPI standard).
 * Dépend  : Props injectées par MappingKpis.jsx
 * Module  : mypaie / Pages / Parametres / Onglets / MappingKpis
 */
import React, { useState, useEffect } from 'react';

export default function MappingFormSection({ 
  univers, setUnivers,
  sourceTable, setSourceTable, 
  sourceColumn, setSourceColumn,
  isFormula, setIsFormula,
  formula, setFormula,
  standardKpiCode, setStandardKpiCode, 
  idProjet, setIdProjet,
  description, setDescription, 
  isSubmitting, handleSubmit,
  kpiRefs, tables, columns, loadingCols, projects, onQuickAdd
}) {

  /**
   * Empêche la saisie manuelle de lettres (A-Z) pour forcer l'usage des tags colonnes.
   * On laisse passer les chiffres, opérateurs, parenthèses et touches de contrôle.
   */
  const handleKeyDown = (e) => {
    // Autorise chiffres, opérateurs, parenthèses et touches de contrôle.
    // On autorise aussi les lettres (A-Z) pour pouvoir taper les fonctions (SUM, AVG...)
    const allowedRegex = /^[0-9+\-*\/().a-zA-Z_]$/;
    const controlKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End', 'Enter'];

    if (!allowedRegex.test(e.key) && !controlKeys.includes(e.key)) {
      e.preventDefault();
    }
  };

  /**
   * Nettoie la saisie (fallback au cas où le filtrage clavier est contourné)
   */
  const handleFormulaSaisie = (e) => {
    // On autorise les lettres ici car elles proviennent des boutons de colonnes cliquables
    // ou d'un copier-coller (qu'on ne peut pas bloquer facilement en keydown).
    // Mais on retire toujours les espaces.
    const val = e.target.value;
    const sanitized = val.replace(/\s/g, '');
    setFormula(sanitized);
  };

  /**
   * Insère un élément (opérateur ou chiffre) dans la formule
   */
  const insertElement = (el) => {
    setFormula(prev => prev + el);
  };

  const clearFormula = () => {
    setFormula('');
  };

  /**
   * Insère une colonne avec le préfixe de la table actuelle pour permettre le multi-tables
   */
  const insertColumn = (colName) => {
    if (!sourceTable) return;
    setFormula(prev => prev + sourceTable + '.' + colName);
  };

  const OPERATEURS = ['+', '-', '*', '/', '(', ')', '.', 'SUM(', 'COUNT(', 'AVG(', 'SAFE_DIVIDE('];
  const CHIFFRES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="mk-form-card">
      <div className="mk-card-header">
        <i className="fa-solid fa-plus-circle"></i>
        <h3>Lier une métrique source à un KPI Standard</h3>
      </div>
      
      <form className="mk-form" onSubmit={handleSubmit}>
        <div className="mk-form-grid">
          
          {/* Univers / Module */}
          <div className="mk-field">
            <label>1. Module concerné</label>
            <div className="mk-input-wrapper">
              <i className="fa-solid fa-layer-group"></i>
              <select value={univers} onChange={(e) => setUnivers(e.target.value)} required>
                <option value="PERF">Performance</option>
                <option value="QUALITE">Qualité (Eval Plus)</option>
                <option value="HEURES">Heures Agents</option>
              </select>
            </div>
          </div>

          {/* Scope Projet */}
          <div className="mk-field">
            <label>2. Scope de la liaison</label>
            <div className="mk-input-wrapper">
              <i className="fa-solid fa-folder-tree"></i>
              <select value={idProjet} onChange={(e) => setIdProjet(e.target.value)}>
                <option value="">Tous les projets (Global)</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.libelle}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table Source (BigQuery) */}
          <div className="mk-field">
            <label>3. Table / Vue Source (BigQuery)</label>
            <div className="mk-input-wrapper">
              <i className="fa-solid fa-table"></i>
              <select 
                value={sourceTable} 
                onChange={(e) => { 
                  setSourceTable(e.target.value); 
                  if (!isFormula) setSourceColumn(''); 
                }} 
                required
              >
                <option value="">-- Sélectionner une table --</option>
                {tables.map(t => (
                  <option key={t.id} value={t.id}>{t.id} ({t.type})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mode de liaison */}
          <div className="mk-field">
            <label>4. Type de liaison</label>
            <div className="mk-mode-selector">
              <button 
                type="button" 
                className={`mk-mode-btn ${!isFormula ? 'active' : ''}`}
                onClick={() => setIsFormula(false)}
              >
                <i className="fa-solid fa-arrow-right"></i> Directe
              </button>
              <button 
                type="button" 
                className={`mk-mode-btn ${isFormula ? 'active' : ''}`}
                onClick={() => setIsFormula(true)}
              >
                <i className="fa-solid fa-calculator"></i> Formule
              </button>
            </div>
          </div>

          {/* Colonne Source (Simple) */}
          {!isFormula && (
            <div className="mk-field">
              <label>5. Colonne de donnée (Métrique)</label>
              <div className="mk-input-wrapper">
                <i className="fa-solid fa-columns"></i>
                <select 
                  value={sourceColumn} 
                  onChange={(e) => setSourceColumn(e.target.value)} 
                  disabled={!sourceTable || loadingCols}
                  required={!isFormula}
                >
                  <option value="">{loadingCols ? 'Chargement...' : '-- Sélectionner une colonne --'}</option>
                  {columns.map(c => (
                    <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Formule de calcul (Complexe) */}
          {isFormula && (
            <div className="mk-field mk-field--full">
              <label>5. Définition de la formule</label>
              <div className="mk-formula-editor">
                <div className="mk-formula-toolbar">
                  <div className="mk-toolbar-section">
                    <span className="mk-toolbar-label">Symboles & Chiffres :</span>
                    <div className="mk-operator-btns">
                      {OPERATEURS.map(op => (
                        <button 
                          key={op} 
                          type="button" 
                          className={`mk-op-btn ${op.length > 2 ? 'mk-op-btn--fn' : ''}`} 
                          onClick={() => insertElement(op)}
                        >
                          {op}
                        </button>
                      ))}
                      <div className="mk-separator-v"></div>
                      {CHIFFRES.map(num => (
                        <button key={num} type="button" className="mk-op-btn mk-op-btn--num" onClick={() => insertElement(num)}>{num}</button>
                      ))}
                      <button type="button" className="mk-op-btn mk-op-btn--clear" onClick={clearFormula} title="Effacer tout">
                        <i className="fa-solid fa-eraser"></i>
                      </button>
                    </div>
                  </div>
                  <div className="mk-toolbar-section">
                    <span className="mk-toolbar-label">Colonnes ({sourceTable || 'Sélectionner une table'}) :</span>
                    <div className="mk-column-tags">
                      {columns.map(c => (
                        <span 
                          key={c.name} 
                          className="mk-col-tag"
                          onClick={() => insertColumn(c.name)}
                          title={c.type}
                        >
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mk-input-wrapper">
                  <i className="fa-solid fa-square-root-variable"></i>
                  <textarea
                    value={formula}
                    onChange={handleFormulaSaisie}
                    onKeyDown={handleKeyDown}
                    placeholder="Cliquez sur les éléments ci-dessus pour construire votre formule"
                    rows="3"
                    required={isFormula}
                  />
                </div>
                <p className="mk-formula-hint">Saisie clavier limitée aux chiffres et opérateurs. Pour utiliser des colonnes d'autres tables, changez simplement la table source (3).</p>
              </div>
            </div>
          )}

          {/* KPI Standard */}
          <div className={`mk-field ${isFormula ? 'mk-field--full' : ''}`}>
            <label>{isFormula ? '6' : '6'}. Destination (KPI Standard)</label>
            <div className="mk-input-wrapper">
              <i className="fa-solid fa-bullseye"></i>
              <select
                value={standardKpiCode}
                onChange={(e) => setStandardKpiCode(e.target.value)}
                required
              >
                <option value="">-- Sélectionner un KPI Standard --</option>
                {/* On ne montre que les KPIs de l'univers sélectionné pour guider l'utilisateur */}
                {kpiRefs[univers]?.map(k => (
                  <option key={k.code} value={k.code}>
                    {k.libelle} [{k.code}]
                  </option>
                ))}
              </select>
              <button 
                type="button" 
                className="mk-quick-add-btn" 
                onClick={onQuickAdd}
                title="Créer un nouveau standard"
              >
                <i className="fa-solid fa-plus"></i>
              </button>
            </div>
          </div>

          <div className="mk-field mk-field--full">
            <label htmlFor="description">Notes internes / Contexte</label>
            <div className="mk-input-wrapper">
              <i className="fa-solid fa-align-left"></i>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Pourquoi ce mapping ? Spécificité projet ?"
                rows="2"
              />
            </div>
          </div>
        </div>

        <div className="mk-form-actions">
          <button 
            type="submit" 
            className="mk-btn mk-btn--primary"
            disabled={isSubmitting || !sourceTable || (!sourceColumn && !isFormula) || (isFormula && !formula.trim()) || !standardKpiCode}
          >
            {isSubmitting ? (
              <><i className="fa-solid fa-spinner fa-spin"></i> Enregistrement...</>
            ) : (
              <><i className="fa-solid fa-link"></i> Créer la liaison</>
            )}
          </button>
          
          {(sourceTable || sourceColumn || standardKpiCode) && (
            <button 
              type="button" 
              className="mk-btn mk-btn--ghost"
              onClick={() => {
                setSourceTable('');
                setSourceColumn('');
                setStandardKpiCode('');
                setDescription('');
              }}
            >
              Réinitialiser
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
