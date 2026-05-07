/*
 * Fichier : KpiInfoModal.jsx
 * Rôle    : Modal d'affichage des détails et formules d'un KPI
 *           (supporte un seul objet ou une liste de formules).
 * Dépend  : KpiInfoModal.css
 * Module  : mypaie / Components
 */
import React from 'react';
import './KpiInfoModal.css';

export default function KpiInfoModal({ isOpen, onClose, data }) {
  if (!isOpen || !data) return null;

  // Si data est un tableau, on affiche une liste de formules, sinon une seule
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
              
              <div className="kim-detail-item">
                <span className="kim-detail-label">
                  <i className="fa-solid fa-calculator"></i> {items.length === 1 ? 'Formule de calcul' : `Formule : ${item.title}`}
                </span>
                <div className="kim-detail-value kim-formula-box">
                  <code>{item.formula}</code>
                </div>
              </div>

              <div className="kim-detail-item">
                <span className="kim-detail-label">
                  <i className="fa-solid fa-database"></i> Source
                </span>
                <div className="kim-detail-value">
                  <span className="kim-badge-source">{item.sourceTable}</span>
                </div>
              </div>

              <div className="kim-detail-item">
                <span className="kim-detail-label">
                  <i className="fa-solid fa-code"></i> Métriques
                </span>
                <div className="kim-detail-value">
                  <div className="kim-metrics-list">
                    {item.metrics.split(',').map((m, idx) => (
                      <span key={idx} className="kim-badge-metric">{m.trim()}</span>
                    ))}
                  </div>
                </div>
              </div>
              
              {item.description && (
                <div className="kim-detail-item">
                  <span className="kim-detail-label">
                    <i className="fa-solid fa-align-left"></i> Description
                  </span>
                  <div className="kim-detail-value kim-description-text">
                    {item.description}
                  </div>
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
