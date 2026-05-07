/*
 * Fichier : EmptyStateSection.jsx
 * Rôle    : État vide affiché dans l'onglet Variables quand aucun
 *           critère de calcul n'a encore été configuré.
 * Dépend  : EmptyStateSection.css
 * Module  : mypaie / Pages / ReglesPrimes / SubPages / RegleDetail / VariablesOnglet
 */
import React from 'react';
import './EmptyStateSection.css';
      <i className="fa-solid fa-sliders variables-onglet__empty-icon"></i>
      <h3 className="variables-onglet__empty-title">Aucun critère configuré</h3>
      <p className="variables-onglet__empty-text">
        Les param�tres et indicateurs de calcul de cette règle seront définis ici.
      </p>
    </div>
  );
}
