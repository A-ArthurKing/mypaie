/*
 * Fichier : GrilleSection.jsx
 * Rôle    : Affiche la grille de notation croisant catégories et statuts
 *           pour visualiser les seuils d'attribution de la prime.
 * Dépend  : GrilleSection.css
 * Module  : mypaie / Pages / ReglesPrimes / SubPages / RegleDetail / ObjectifsOnglet
 */
import React from 'react';
import './GrilleSection.css';

export default function GrilleSection({ grille }) {
  if (!grille || !grille.statuts || grille.statuts.length === 0) return null;

  const categories = grille.categories || [];
  const indicateurs = grille.indicateurs || [];
  const statuts = grille.statuts || [];

  // Calcul du nombre de colonnes par catégorie (pour le colSpan)
  const colsByCategory = categories.map(cat => {
    return indicateurs.filter(ind => ind.categorie === cat).length;
  });

  return (
    <div className="grille-section table-responsive">
      <table className="grille-table">
        <thead>
          {/* Ligne 1 : Points (Pondération) */}
          <tr className="grille-row-points">
            <th colSpan="2" className="grille-col-points-label">Nb de points</th>
            {indicateurs.map(ind => (
              <th key={ind.id} className="grille-cell-point">
                {ind.poids || 0}
              </th>
            ))}
          </tr>
          {/* Ligne 2 : Titre principal */}
          <tr className="grille-row-title">
            <th rowSpan="3" className="grille-col-statut">Niveau</th>
            <th rowSpan="3" className="grille-col-prime">Montants Cibles<br/>(Base + S.Bonus)</th>
            <th colSpan={indicateurs.length} className="grille-col-main">Objectifs / Indicateurs par Niveau</th>
          </tr>
          {/* Ligne 2 : Catégories */}
          <tr className="grille-row-categories">
            {categories.map((cat, i) => (
              <th key={cat} colSpan={colsByCategory[i] || 1} className="grille-col-cat">{cat}</th>
            ))}
          </tr>
          {/* Ligne 3 : Indicateurs (KPIs) */}
          <tr className="grille-row-indicators">
            {indicateurs.map(ind => (
              <th key={ind.id} className="grille-col-ind">{ind.nom}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {statuts.map(statut => (
            <tr key={statut.nom} className="grille-row-data">
              <td className="grille-cell-statut">
                <span className="statut-badge">{statut.nom}</span>
              </td>
              <td className="grille-cell-prime">
                <div className="grille-amounts">
                  <span className="grille-amount-base">{statut.prime_brute} DH</span>
                  {statut.montant_sb > 0 && (
                    <span className="grille-amount-sb">+{statut.montant_sb} SB</span>
                  )}
                </div>
              </td>
              {indicateurs.map(ind => {
                const val = statut.cibles[ind.id];
                return (
                  <td key={ind.id} className="grille-cell-cible">
                    {val !== undefined ? val : '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
