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
    <div className="kpi-card">
      <div className="kpi-card__icon-wrap">
        <i className={icon}></i>
      </div>
      <div className="kpi-card__body">
        <span className="kpi-card__label">{label}</span>
        <span className="kpi-card__value">{value || '\u2014'}</span>
      </div>
    </div>
  );
}

export default function KpiGridSection({ regle }) {
  if (!regle) return null;

  return (
    <div className="kpi-grid">
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
