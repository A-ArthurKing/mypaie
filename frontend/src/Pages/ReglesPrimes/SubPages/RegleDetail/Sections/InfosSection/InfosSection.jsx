/*
 * Fichier : InfosSection.jsx
 * Rôle    : Onglet "Informations" du détail d'une règle de prime.
 *           Affiche les KPIs de configuration et la description.
 * Module  : mypaie / Pages / ReglesPrimes / SubPages / Sections
 */

import React from 'react';
import './InfosSection.css';

const PERIODICITE_LABELS = {
  mensuelle: 'Mensuelle',
  trimestrielle: 'Trimestrielle',
  semestrielle: 'Semestrielle',
  annuelle: 'Annuelle',
};

function KpiCard({ icon, label, value }) {
  return (
    <div className="infos-section__kpi-card">
      <div className="infos-section__kpi-label">
        <i className={icon}></i> {label}
      </div>
      <div className="infos-section__kpi-value">{value || '—'}</div>
    </div>
  );
}

export default function InfosSection({ regle }) {
  return (
    <div className="infos-section">
      <div className="infos-section__kpi-grid">
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

      {regle.description ? (
        <div className="infos-section__description">
          <h3 className="infos-section__description-title">
            <i className="fa-regular fa-file-lines"></i> Description
          </h3>
          <p className="infos-section__description-text">{regle.description}</p>
        </div>
      ) : (
        <div className="infos-section__description infos-section__description--empty">
          <i className="fa-regular fa-file-lines"></i>
          <span>Aucune description renseignée.</span>
        </div>
      )}
    </div>
  );
}
