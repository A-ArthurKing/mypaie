/*
 * Fichier : KpiInfoModal.jsx
 * Rôle    : Modal d'affichage des détails et formules d'un KPI
 *           (supporte un seul objet ou une liste de formules).
 * Dépend  : KpiInfoModal.css
 * Module  : mypaie / Components
 */
import React from 'react';
import './KpiInfoModal.css';

/**
 * Tokenise une formule SQL pour la coloration syntaxique.
 * Exemple : "paie_performance.chiffre_affaire / paie_performance.nb_ventes"
 * → table en bleu, colonne en orange, opérateurs en violet.
 */
function renderFormula(formula) {
  if (!formula) return null;

  // Split en tokens : table.col, opérateurs, nombres, espace
  const tokens = formula.split(/(\s*[\+\-\*\/\(\)]\s*|\d+(?:\.\d+)?)/);

  return tokens.map((token, i) => {
    if (!token) return null;

    // Opérateur
    if (/^[\s]*[\+\-\*\/\(\)][\s]*$/.test(token)) {
      return <span key={i} className="kim-fml-op">{token}</span>;
    }

    // Nombre
    if (/^\d+(\.\d+)?$/.test(token.trim())) {
      return <span key={i} className="kim-fml-num">{token}</span>;
    }

    // table.column
    const dotIdx = token.indexOf('.');
    if (dotIdx > 0) {
      const table = token.slice(0, dotIdx);
      const col   = token.slice(dotIdx + 1);
      return (
        <span key={i}>
          <span className="kim-fml-table">{table}</span>
          <span className="kim-fml-dot">.</span>
          <span className="kim-fml-col">{col}</span>
        </span>
      );
    }

    // Colonne seule (sans table)
    if (token.trim()) {
      return <span key={i} className="kim-fml-plain">{token}</span>;
    }

    return <span key={i}>{token}</span>;
  });
}

export default function KpiInfoModal({ isOpen, onClose, data }) {
  if (!isOpen || !data) return null;

  const items = Array.isArray(data) ? data : [data];

  return (
    <div className="kim-overlay" onClick={onClose}>
      <div className="kim-content" onClick={(e) => e.stopPropagation()}>

        <div className="kim-header">
          <div className="kim-title-wrapper">
            <i className="fa-solid fa-circle-info kim-icon-title"></i>
            <h2>Détails des calculs</h2>
          </div>
          <button className="kim-btn-close" onClick={onClose} title="Fermer">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="kim-body">
          {items.map((item, index) => (
            <div key={index} className={`kim-section ${items.length > 1 ? 'kim-section--multi' : ''}`}>
              {items.length > 1 && <h3 className="kim-section-title">{item.title}</h3>}

              {/* ── Formule ── */}
              <div className="kim-detail-item">
                <span className="kim-detail-label">
                  <i className="fa-solid fa-calculator"></i>
                  {items.length === 1 ? 'Formule de calcul' : `Formule : ${item.title}`}
                </span>
                <div className="kim-formula-box">
                  <div className="kim-formula-code">
                    {renderFormula(item.formula)}
                  </div>
                </div>
              </div>

              {/* ── Source ── */}
              <div className="kim-detail-item">
                <span className="kim-detail-label">
                  <i className="fa-solid fa-database"></i> Source
                </span>
                <div>
                  <span className="kim-badge-source">
                    <i className="fa-solid fa-server" style={{ fontSize: '0.65rem' }}></i>
                    {item.sourceTable}
                  </span>
                </div>
              </div>

              {/* ── Métriques ── */}
              {item.metrics && (
                <div className="kim-detail-item">
                  <span className="kim-detail-label">
                    <i className="fa-solid fa-code"></i> Métriques
                  </span>
                  <div className="kim-metrics-list">
                    {item.metrics.split(',').map((m, idx) => (
                      <span key={idx} className="kim-badge-metric">{m.trim()}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Description ── */}
              {item.description && (
                <div className="kim-detail-item">
                  <span className="kim-detail-label">
                    <i className="fa-solid fa-align-left"></i> Description
                  </span>
                  <div className="kim-description-text">{item.description}</div>
                </div>
              )}

              {index < items.length - 1 && <hr className="kim-separator" />}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
