/*
 * Fichier : EcHeaderBar.jsx
 * Rôle    : Barre de navigation de l'Espace Collaborateur.
 *           Logo, libellé, badge utilisateur, bouton refresh, déconnexion.
 * Module  : mypaie / Pages / EspaceCollaborateur / Sections
 */
import React from 'react';
import './EcHeaderBar.css';

export default function EcHeaderBar({ user, isRefreshing, onRefresh, onLogout }) {
  return (
    <header className="ec-header-bar">
      <div className="ec-header-bar__brand">
        <span className="ec-header-bar__logo">
          <span className="ec-header-bar__logo-accent">my</span>Paie
        </span>
        <span className="ec-header-bar__label">Espace Collaborateur</span>
      </div>

      <div className="ec-header-bar__actions">
        <div className="ec-header-bar__user">
          <i className="fa-solid fa-circle-user"></i>
          <span className="ec-header-bar__username">{user?.prenom} {user?.nom}</span>
        </div>

        <button
          className={`ec-header-bar__btn ec-header-bar__btn--refresh ${isRefreshing ? 'spinning' : ''}`}
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Actualiser les données"
          aria-label="Actualiser"
        >
          <i className="fa-solid fa-rotate-right"></i>
          <span className="ec-header-bar__btn-label">Actualiser</span>
        </button>

        <button
          className="ec-header-bar__btn ec-header-bar__btn--logout"
          onClick={onLogout}
          title="Se déconnecter"
        >
          <i className="fa-solid fa-right-from-bracket"></i>
          <span className="ec-header-bar__btn-label">Déconnexion</span>
        </button>
      </div>
    </header>
  );
}
