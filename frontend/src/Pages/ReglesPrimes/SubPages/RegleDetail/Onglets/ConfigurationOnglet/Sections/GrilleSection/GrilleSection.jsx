/*
 * Fichier : GrilleSection.jsx
 * Rôle    : Affiche la grille de notation croisant catégories et statuts
 *           pour visualiser les seuils d'attribution de la prime.
 *           Inclut les barèmes paliers_valeur, malus_conditions, regles_metier.
 * Dépend  : GrilleSection.css
 * Module  : mypaie / Pages / ReglesPrimes / SubPages / RegleDetail / ObjectifsOnglet
 */
import React from 'react';
import './GrilleSection.css';

/** Barème CA→montant pour mode_prime=montant_direct */
function PaliersValeurCard({ indicateur }) {
  const paliers = indicateur.paliers_valeur;
  if (!paliers || paliers.length === 0) return null;
  return (
    <div className="gs-extra-card gs-extra-card--paliers">
      <div className="gs-extra-card__title">
        <i className="fa-solid fa-table-list"></i>
        Barème — {indicateur.nom}
        <span className="gs-extra-badge gs-extra-badge--direct">Montant direct</span>
      </div>
      <table className="gs-extra-table">
        <thead>
          <tr>
            <th>Plage</th>
            <th>Montant</th>
          </tr>
        </thead>
        <tbody>
          {paliers.map((p, i) => {
            const min = p.seuil_min != null ? Number(p.seuil_min).toLocaleString('fr-FR') : '0';
            const max = p.seuil_max != null ? Number(p.seuil_max).toLocaleString('fr-FR') : '∞';
            const montant = p.type_montant === 'pourcentage_kpi'
              ? `${p.montant} % du CA`
              : `${Number(p.montant).toLocaleString('fr-FR')} MAD`;
            return (
              <tr key={i} className={p.montant === 0 ? 'gs-extra-row--zero' : ''}>
                <td>{min} → {max}</td>
                <td className="gs-extra-cell--montant">{montant}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Barème de malus gradués pour un KPI */
function MalusConditionsCard({ indicateur }) {
  const conditions = indicateur.malus_conditions;
  if (!conditions || conditions.length === 0) return null;
  return (
    <div className="gs-extra-card gs-extra-card--malus">
      <div className="gs-extra-card__title">
        <i className="fa-solid fa-arrow-trend-down"></i>
        Malus — {indicateur.nom}
        <span className="gs-extra-badge gs-extra-badge--malus">Malus gradué</span>
      </div>
      <table className="gs-extra-table">
        <thead>
          <tr>
            <th>Condition</th>
            <th>Malus appliqué</th>
          </tr>
        </thead>
        <tbody>
          {conditions.map((c, i) => (
            <tr key={i}>
              <td>{c.description || `${c.seuil_min} → ${c.seuil_max != null ? c.seuil_max : '∞'}`}</td>
              <td className="gs-extra-cell--malus">−{c.malus_pct} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Encadré des règles métier appliquées manuellement */
function ReglesMetierBox({ regles }) {
  if (!regles || regles.length === 0) return null;

  const TYPE_ICON = {
    disqualifiant:       { icon: 'fa-ban',             cls: 'gs-regle--disqualifiant' },
    malus_conditionnel:  { icon: 'fa-circle-minus',    cls: 'gs-regle--malus' },
    prorata:             { icon: 'fa-calendar-days',   cls: 'gs-regle--prorata' },
  };

  return (
    <div className="gs-regles-metier">
      <div className="gs-regles-metier__header">
        <i className="fa-solid fa-gavel"></i>
        Règles appliquées manuellement
        <span className="gs-extra-badge gs-extra-badge--human">Application humaine</span>
      </div>
      <p className="gs-regles-metier__desc">
        Ces conditions ne sont pas calculées automatiquement. Elles doivent être vérifiées et appliquées
        par le responsable lors de la validation des primes.
      </p>
      <ul className="gs-regles-metier__list">
        {regles.map((r, i) => {
          const { icon, cls } = TYPE_ICON[r.type] || { icon: 'fa-circle-info', cls: '' };
          return (
            <li key={i} className={`gs-regle ${cls}`}>
              <i className={`fa-solid ${icon}`}></i>
              <span>{r.description}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function GrilleSection({ grille }) {
  if (!grille || !grille.statuts || grille.statuts.length === 0) return null;

  const categories = grille.categories || [];
  const indicateurs = grille.indicateurs || [];
  const statuts = grille.statuts || [];
  const reglesMetier = grille.regles_metier || [];

  // Indicateurs avec barème direct ou malus gradués
  const indicateursAvecPaliersValeur = indicateurs.filter(i => i.paliers_valeur?.length > 0);
  const indicateursAvecMalus = indicateurs.filter(i => i.malus_conditions?.length > 0);

  // Calcul du nombre de colonnes par catégorie (pour le colSpan)
  const colsByCategory = categories.map(cat => {
    return indicateurs.filter(ind => ind.categorie === cat).length;
  });

  return (
    <div className="grille-section-wrapper">
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
                <th key={ind.id} className="grille-col-ind">
                  {ind.nom}
                  {ind.paliers_valeur?.length > 0 && (
                    <span className="grille-ind-badge grille-ind-badge--direct" title="Montant direct par palier CA">⊞</span>
                  )}
                  {ind.malus_conditions?.length > 0 && (
                    <span className="grille-ind-badge grille-ind-badge--malus" title="Malus gradué">▼</span>
                  )}
                </th>
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
                  const val = statut.cibles?.[ind.id];
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

      {/* ── Barèmes et règles complémentaires ── */}
      {(indicateursAvecPaliersValeur.length > 0 || indicateursAvecMalus.length > 0 || reglesMetier.length > 0) && (
        <div className="gs-extras">
          {indicateursAvecPaliersValeur.map(ind => (
            <PaliersValeurCard key={ind.id} indicateur={ind} />
          ))}
          {indicateursAvecMalus.map(ind => (
            <MalusConditionsCard key={ind.id} indicateur={ind} />
          ))}
          {reglesMetier.length > 0 && (
            <ReglesMetierBox regles={reglesMetier} />
          )}
        </div>
      )}
    </div>
  );
}
