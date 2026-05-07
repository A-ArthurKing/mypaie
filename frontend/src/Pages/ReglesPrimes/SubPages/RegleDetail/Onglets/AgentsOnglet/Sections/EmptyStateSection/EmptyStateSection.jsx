/*
 * Fichier : EmptyStateSection.jsx
 * Rôle    : État vide affiché dans l'onglet Agents quand aucun agent
 *           n'est encore associé à la règle de prime.
 * Dépend  : EmptyStateSection.css
 * Module  : mypaie / Pages / ReglesPrimes / SubPages / RegleDetail / AgentsOnglet
 */
import React from 'react';
import './EmptyStateSection.css';
      <i className="fa-solid fa-users agents-onglet__empty-icon"></i>
      <h3 className="agents-onglet__empty-title">Aucun agent associé</h3>
      <p className="agents-onglet__empty-text">
        Les agents éligibles à cette règle de prime apparaîtront ici avec leurs résultats calculés.
      </p>
    </div>
  );
}
