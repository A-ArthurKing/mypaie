/*
 * Fichier : EcProfilCard.jsx
 * Rôle    : Carte de profil du collaborateur — avatar, nom, matricule, prime langue.
 * Module  : mypaie / Pages / EspaceCollaborateur / Sections
 */
import React from 'react';
import './EcProfilCard.css';

export default function EcProfilCard({ user, agent }) {
  const initiales = [user?.prenom?.[0], user?.nom?.[0]].filter(Boolean).join('').toUpperCase();

  return (
    <div className="ec-profil-card">
      <div className="ec-profil-card__avatar" aria-hidden="true">
        {initiales || '?'}
      </div>

      <div className="ec-profil-card__info">
        <h2 className="ec-profil-card__name">{user?.prenom} {user?.nom}</h2>
        {user?.matricule && (
          <span className="ec-profil-card__meta">
            <i className="fa-solid fa-id-badge"></i>
            Matricule {user.matricule}
          </span>
        )}
      </div>

      {agent?.prime_langue > 0 && (
        <div className="ec-profil-card__prime-langue">
          <span className="ec-profil-card__prime-label">Prime langue</span>
          <span className="ec-profil-card__prime-value">
            {Number(agent.prime_langue).toFixed(2)} €
          </span>
        </div>
      )}
    </div>
  );
}
