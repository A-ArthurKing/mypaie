import React from 'react';
import './KpiGridSection.css';

const PERIODICITE_LABELS = {
  mensuelle: 'Mensuelle',
  trimestrielle: 'Trimestrielle',
  semestrielle: 'Semestrielle',
  annuelle: 'Annuelle',
};

function KpiCard({ icon, label, value }) {
  return (
    <div className="objectifs-onglet__kpi-card">
      <div className="objectifs-onglet__kpi-label">
        <i className={icon}></i> {label}
      </div>
      <div className="objectifs-onglet__kpi-value">{value || '—'}</div>
    </div>
  );
}

export default function KpiGridSection({ regle }) {
  if (!regle) return null;

  return (
    <div className="objectifs-onglet__kpi-grid">
      <KpiCard
        icon="fa-regular fa-calendar"
        label="Périodicité"
        value={PERIODICITE_LABELS[regle.periodicite] ?? regle.periodicite}
      />
      <KpiCard
        icon="fa-regular fa-calendar-days"
        label="Début de période"
        value={regle.periode_debut}
      />
      <KpiCard
        icon="fa-regular fa-calendar-xmark"
        label="Fin de période"
        value={regle.periode_fin}
      />
      <KpiCard
        icon="fa-regular fa-clock"
        label="Créée le"
        value={regle.created_at}
      />
      <KpiCard
        icon="fa-regular fa-pen-to-square"
        label="Modifiée le"
        value={regle.updated_at}
      />
      <KpiCard
        icon="fa-solid fa-folder"
        label="Projet"
        value={regle.projet}
      />
    </div>
  );
}
