import React from 'react';
import './KpiInfoModal.css';

export default function KpiInfoModal({ isOpen, onClose, data }) {
  if (!isOpen || !data) return null;

  return (
    <div className="kpi-modal-overlay" onClick={onClose}>
      <div className="kpi-modal-content" onClick={(e) => e.stopPropagation()}>
        
        <div className="kpi-modal-header">
          <div className="kpi-modal-title-wrapper">
            <i className="fa-solid fa-circle-info kpi-modal-icon-title"></i>
            <h2>Détails de l'indicateur : {data.title}</h2>
          </div>
          <button className="kpi-modal-close" onClick={onClose} title="Fermer">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="kpi-modal-body">
          <div className="kpi-detail-item">
            <span className="kpi-detail-label">
              <i className="fa-solid fa-calculator"></i> Formule de calcul
            </span>
            <div className="kpi-detail-value formula-box">
              <code>{data.formula}</code>
            </div>
          </div>

          <div className="kpi-detail-item">
            <span className="kpi-detail-label">
              <i className="fa-solid fa-database"></i> Table source principale
            </span>
            <div className="kpi-detail-value">
              <span className="badge-source">{data.sourceTable}</span>
            </div>
          </div>

          <div className="kpi-detail-item">
            <span className="kpi-detail-label">
              <i className="fa-solid fa-code"></i> Champs (JSON / Métriques brutes)
            </span>
            <div className="kpi-detail-value">
              <div className="metrics-list">
                {data.metrics.split(',').map((m, idx) => (
                  <span key={idx} className="badge-metric">{m.trim()}</span>
                ))}
              </div>
            </div>
          </div>
          
          {data.description && (
            <div className="kpi-detail-item">
              <span className="kpi-detail-label">
                <i className="fa-solid fa-align-left"></i> Description métier
              </span>
              <div className="kpi-detail-value text-muted">
                {data.description}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
