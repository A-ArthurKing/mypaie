/*
 * Fichier : Loader.jsx
 * Rôle    : Composant de chargement personnalisé utilisant le logo.
 * Module  : mypaie / Shared / UI
 */

import React from 'react';
import './Loader.css';

function Loader({ message = "Chargement en cours..." }) {
  return (
    <div className="mypaie-loader">
      <div className="mypaie-loader__content">
        <i className="fa-solid fa-circle-nodes mypaie-loader__icon" />
        {message && <span className="mypaie-loader__text">{message}</span>}
      </div>
    </div>
  );
}

export default Loader;
