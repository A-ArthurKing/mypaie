/*
 * Fichier : HeaderSection.jsx
 * Rôle    : Bandeau d'en-tête de la page Paramètres (titre + sous-titre).
 * Dépend  : HeaderSection.css
 * Module  : mypaie / Pages / Parametres / Sections
 */
import React from 'react';
import './HeaderSection.css';

export default function HeaderSection() {
  return (
    <div className="parametres-header">
      <h1 className="parametres-title">Paramètres Généraux</h1>
      <p className="parametres-subtitle">Administration et configuration de la plateforme</p>
    </div>
  );
}
