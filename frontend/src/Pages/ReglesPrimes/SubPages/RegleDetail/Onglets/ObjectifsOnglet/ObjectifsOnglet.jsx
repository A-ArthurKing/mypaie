/*
 * Fichier : ObjectifsOnglet.jsx
 * Rôle    : Onglet "Objectifs" du détail d'une règle de prime.
 *           Affiche les KPIs de configuration et la description.
 * Module  : mypaie / Pages / ReglesPrimes / SubPages / Onglets
 */

import React from 'react';
import './ObjectifsOnglet.css';

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

export default function ObjectifsOnglet({ regle }) {
  return (
    <div className="objectifs-onglet">
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

      {regle.description ? (
        <div className="objectifs-onglet__description">
          <h3 className="objectifs-onglet__description-title">
            <i className="fa-regular fa-file-lines"></i> Description
          </h3>
          <p className="objectifs-onglet__description-text">{regle.description}</p>
        </div>
      ) : (
        <div className="objectifs-onglet__description objectifs-onglet__description--empty">
          <i className="fa-regular fa-file-lines"></i>
          <span>Aucune description renseignée.</span>
        </div>
      )}
    </div>
  );
}
