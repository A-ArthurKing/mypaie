/*
 * Fichier : EcGrilleContent.jsx
 * Rôle    : Affichage de la règle de prime active + résultats réels du mois +
 *           indicateurs + statuts + paliers.
 *           Reçoit les données déjà décodées depuis EspaceCollaborateur.
 * Module  : mypaie / Pages / EspaceCollaborateur / Sections
 */
import React from 'react';
import './EcGrilleContent.css';

/* ── Section générique ── */
function EcSection({ icon, title, badge, className = '', children }) {
  return (
    <section className={`ec-grille__section ${className}`}>
      <div className="ec-grille__section-header">
        <h3 className="ec-grille__section-title">
          <i className={`fa-solid ${icon}`}></i>
          {title}
        </h3>
        {badge && <span className="ec-grille__badge">{badge}</span>}
      </div>
      <div className="ec-grille__section-body">
        {children}
      </div>
    </section>
  );
}

/* ── Helpers de formatage ── */
function formatDh(val) {
  if (val == null) return '—';
  return Number(val).toLocaleString('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 2 }).replace('MAD', 'DH');
}
function formatPct(val) {
  if (val == null) return '—';
  return `${Number(val).toFixed(1)} %`;
}
function formatVal(val, kpi) {
  if (val == null) return '—';
  // Indicateurs dont le mode_prime est montant_direct → on assume valeur monétaire
  if (kpi?.mode_prime === 'montant_direct') return formatDh(val);
  // Indicateurs de type malus (qualité, etc.) → pourcentage
  if (kpi?.type_ponderation === 'malus') return formatPct(val);
  // Fallback : nombre formaté
  return Number(val).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

/* ── Résultats réels du mois (cœur de l'affichage) ── */
function EcResultats({ indicateurs, kpis, prime_brute_estimee, periode_calcul, grilleName }) {
  if (!Array.isArray(indicateurs) || indicateurs.length === 0) return null;

  const moisLabel = periode_calcul?.mois_label ?? 'mois courant';
  const hasSomeData = indicateurs.some(ind => kpis?.[ind.id]?.valeur_reelle != null);

  return (
    <EcSection
      icon="fa-chart-line"
      title={`Mes résultats — ${moisLabel}`}
      badge={grilleName}
      className="ec-bento-resultats"
    >
      {!hasSomeData && (
        <p className="ec-resultats__no-data">
          <i className="fa-solid fa-circle-info"></i>
          Aucune donnée de performance disponible pour ce mois.
        </p>
      )}

      <div className="ec-resultats__grid">
        {indicateurs.map((ind, idx) => {
          const kpiData = kpis?.[ind.id] ?? {};
          const valReelle = kpiData.valeur_reelle;
          const primeKpi = kpiData.prime_kpi;
          const malusPct = kpiData.malus_pct;
          const isBonus = ind.type_ponderation === 'bonus' || ind.mode_prime === 'montant_direct';
          const isMalus = ind.type_ponderation === 'malus';

          return (
            <div key={ind.id || idx} className={`ec-resultats__card ${isMalus ? 'ec-resultats__card--malus' : 'ec-resultats__card--bonus'}`}>
              {/* En-tête */}
              <div className="ec-resultats__card-header">
                <span className="ec-resultats__card-nom">{ind.nom || ind.id}</span>
                <span className={`ec-resultats__type-badge ${isMalus ? 'ec-resultats__type-badge--malus' : 'ec-resultats__type-badge--bonus'}`}>
                  {isMalus ? 'Malus' : 'Bonus'}
                </span>
              </div>

              {/* Pondération */}
              {ind.poids != null && (
                <span className="ec-resultats__ponderation">
                  Pondération : {ind.poids}%
                </span>
              )}

              {/* Valeur réelle */}
              <div className="ec-resultats__stat">
                <span className="ec-resultats__stat-label">Valeur réelle</span>
                <span className={`ec-resultats__stat-value ${valReelle == null ? 'ec-resultats__stat-value--empty' : ''}`}>
                  {formatVal(valReelle, ind)}
                </span>
              </div>

              {/* Prime ou Malus applicable */}
              {isBonus && (
                <div className="ec-resultats__stat">
                  <span className="ec-resultats__stat-label">Prime applicable</span>
                  <span className={`ec-resultats__stat-value ec-resultats__stat-value--prime ${primeKpi == null ? 'ec-resultats__stat-value--empty' : ''}`}>
                    {primeKpi != null ? formatDh(primeKpi) : (valReelle == null ? '—' : 'Hors paliers')}
                  </span>
                </div>
              )}
              {isMalus && (
                <div className="ec-resultats__stat">
                  <span className="ec-resultats__stat-label">Malus appliqué</span>
                  <span className={`ec-resultats__stat-value ${malusPct != null ? 'ec-resultats__stat-value--malus' : 'ec-resultats__stat-value--ok'}`}>
                    {malusPct != null ? `−${malusPct} %` : (valReelle == null ? '—' : 'Aucun malus ✓')}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Total prime estimée */}
      {prime_brute_estimee != null ? (
        <div className="ec-resultats__total">
          <span className="ec-resultats__total-label">
            <i className="fa-solid fa-coins"></i>
            Prime estimée du mois
          </span>
          <span className="ec-resultats__total-value">
            {formatDh(prime_brute_estimee)}
          </span>
        </div>
      ) : (
        hasSomeData && (
          <div className="ec-resultats__total ec-resultats__total--missing">
            <span className="ec-resultats__total-label">
              <i className="fa-solid fa-triangle-exclamation"></i>
              Prime non calculée
            </span>
            <span className="ec-resultats__total-value" style={{ fontSize: '1rem', color: '#eab308' }}>
              Indicateurs manquants
            </span>
          </div>
        )
      )}
    </EcSection>
  );
}

/* ── Indicateurs KPI (définition de la grille) ── */
function EcIndicateurs({ indicateurs, grilleName }) {
  if (!Array.isArray(indicateurs) || indicateurs.length === 0) return null;
  return (
    <EcSection icon="fa-bullseye" title="Règles de la grille" badge={grilleName} className="ec-bento-kpis">
      <div className="ec-grille__kpi-grid">
        {indicateurs.map((kpi, idx) => (
          <div key={kpi.id || idx} className="ec-grille__kpi-card">
            <div className="ec-grille__kpi-header">
              <span className="ec-grille__kpi-nom">{kpi.nom || kpi.id || `KPI ${idx + 1}`}</span>
              {kpi.poids != null && (
                <span className="ec-grille__kpi-poids" title="Pondération dans le calcul">
                  {kpi.poids}% pond.
                </span>
              )}
            </div>

            {kpi.categorie && (
              <span className="ec-grille__kpi-categorie">{kpi.categorie}</span>
            )}

            {/* Paliers de prime (montant_direct) */}
            {Array.isArray(kpi.paliers_valeur) && kpi.paliers_valeur.length > 0 && (
              <div className="ec-grille__kpi-paliers">
                {kpi.paliers_valeur.map((p, pi) => (
                  <div key={pi} className="ec-grille__palier-row">
                    <span className="ec-grille__palier-label">
                      {p.seuil_max != null
                        ? `${Number(p.seuil_min ?? 0).toLocaleString('fr-FR')} – ${Number(p.seuil_max).toLocaleString('fr-FR')}`
                        : `≥ ${Number(p.seuil_min ?? 0).toLocaleString('fr-FR')}`}
                    </span>
                    <div className="ec-grille__palier-vals">
                      <span className="ec-grille__palier-pts">
                        {p.type_montant === 'pourcentage_kpi' ? `${p.montant}%` : formatDh(p.montant)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Conditions de malus (qualité) */}
            {Array.isArray(kpi.malus_conditions) && kpi.malus_conditions.length > 0 && (
              <div className="ec-grille__kpi-paliers">
                {kpi.malus_conditions.map((c, ci) => (
                  <div key={ci} className="ec-grille__palier-row">
                    <span className="ec-grille__palier-label">
                      {c.seuil_max != null
                        ? `${c.seuil_min}% – ${c.seuil_max}%`
                        : `< ${c.seuil_min}%`}
                    </span>
                    <div className="ec-grille__palier-vals">
                      <span className="ec-grille__palier-pts ec-grille__palier-pts--malus">
                        −{c.malus_pct}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </EcSection>
  );
}

/* ── Statuts / Niveaux de prime ── */
function EcStatuts({ statuts, userStatut }) {
  if (!Array.isArray(statuts) || statuts.length === 0) return null;

  const currentStatut = statuts.find(s => {
    if (!s.nom || !userStatut) return false;
    return String(s.nom).localeCompare(String(userStatut), 'fr', { sensitivity: 'base' }) === 0;
  });

  if (!currentStatut) return null;

  return (
    <EcSection icon="fa-stairs" title="Votre Niveau de prime" className="ec-bento-statuts">
      <div className="ec-grille__table">
        <div className="ec-grille__table-head">
          <span>Statut</span>
          <span>Prime brute</span>
          <span>Montant SB</span>
        </div>
        <div className="ec-grille__table-row ec-grille__table-row--active">
          <span className="ec-grille__table-label">
            {currentStatut.nom || 'Statut actuel'}
            <span className="ec-badge-current">Actuel</span>
          </span>
          <span className="ec-grille__table-prime">
            {currentStatut.prime_brute != null ? formatDh(currentStatut.prime_brute) : '—'}
          </span>
          <span className="ec-grille__table-neutral">
            {currentStatut.montant_sb != null ? formatDh(currentStatut.montant_sb) : '—'}
          </span>
        </div>
      </div>
    </EcSection>
  );
}

/* ── Paliers globaux ── */
function EcPaliers({ paliers }) {
  if (!Array.isArray(paliers) || paliers.length === 0) return null;
  return (
    <EcSection icon="fa-chart-bar" title="Paliers d'atteinte" className="ec-bento-paliers">
      <div className="ec-grille__table">
        <div className="ec-grille__table-head">
          <span>Palier</span>
          <span>Seuil</span>
          <span>Prime</span>
        </div>
        {paliers.map((p, idx) => (
          <div key={idx} className="ec-grille__table-row">
            <span className="ec-grille__table-label">
              {p.label || p.nom || `Palier ${idx + 1}`}
            </span>
            <span className="ec-grille__table-neutral">
              {p.min != null ? `≥ ${p.min}` : p.seuil != null ? `≥ ${p.seuil}` : '—'}
            </span>
            <span className="ec-grille__table-prime">
              {p.prime != null
                ? formatDh(p.prime)
                : p.points != null
                  ? `${p.points} pts`
                  : '—'}
            </span>
          </div>
        ))}
      </div>
    </EcSection>
  );
}

/* ── Composant principal ── */
export default function EcGrilleContent({ regle, agent, kpis, prime_brute_estimee, periode_calcul }) {
  if (!regle) return null;

  const config = regle.config;
  const content = config?.content || {};
  const { indicateurs, statuts, paliers } = content;

  const hasConfig = Boolean(config);
  const hasGrilleObjectifs = Boolean(regle.grille_objectifs);

  return (
    <div className="ec-grille">
      {/* ── Règle de prime ── */}
      <EcSection icon="fa-trophy" title="Règle de prime" className="ec-bento-regle">
        <div className="ec-grille__regle-top">
          <h4 className="ec-grille__regle-libelle">{regle.libelle}</h4>
          <div className="ec-grille__regle-badges">
            {regle.periodicite && (
              <span className="ec-grille__badge ec-grille__badge--neutral">
                <i className="fa-regular fa-calendar"></i>
                {regle.periodicite}
              </span>
            )}
            {regle.periode_debut && (
              <span className="ec-grille__badge ec-grille__badge--neutral">
                Depuis {new Date(regle.periode_debut).toLocaleDateString('fr-FR', {
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>
        </div>
        {regle.description && (
          <p className="ec-grille__regle-desc">{regle.description}</p>
        )}
        {regle.description_kpi && regle.description_kpi !== regle.description && (
          <p className="ec-grille__regle-desc">{regle.description_kpi}</p>
        )}
      </EcSection>

      {/* ── Résultats réels du mois courant ── */}
      {hasConfig && Array.isArray(indicateurs) && indicateurs.length > 0 && (
        <EcResultats
          indicateurs={indicateurs}
          kpis={kpis}
          prime_brute_estimee={prime_brute_estimee}
          periode_calcul={periode_calcul}
          grilleName={config.grille_nom || config.libelle}
        />
      )}

      {/* ── Règles de la grille (définition des indicateurs) ── */}
      {hasConfig && (
        <EcIndicateurs
          indicateurs={indicateurs}
          grilleName={config.grille_nom || config.libelle}
        />
      )}

      {/* ── Grille objectifs (fallback si pas de config active) ── */}
      {!hasConfig && hasGrilleObjectifs && (
        <EcSection icon="fa-bullseye" title="Objectifs" className="ec-bento-kpis">
          <div className="ec-grille__kpi-grid">
            {(Array.isArray(regle.grille_objectifs)
              ? regle.grille_objectifs
              : Object.entries(regle.grille_objectifs).map(([k, v]) => ({ code: k, ...v }))
            ).map((item, idx) => (
              <div key={idx} className="ec-grille__kpi-card">
                <div className="ec-grille__kpi-header">
                  <span className="ec-grille__kpi-nom">{item.libelle || item.code || `KPI ${idx + 1}`}</span>
                </div>
              </div>
            ))}
          </div>
        </EcSection>
      )}

      {/* ── Statuts ── */}
      {hasConfig && <EcStatuts statuts={statuts} userStatut={agent?.statut} />}

      {/* ── Paliers globaux ── */}
      {hasConfig && <EcPaliers paliers={paliers} />}

      {/* ── Aucun contenu ── */}
      {!hasConfig && !hasGrilleObjectifs && (
        <div className="ec-grille__empty">
          <i className="fa-solid fa-circle-info"></i>
          <p>La configuration de cette règle n&apos;a pas encore été publiée.</p>
        </div>
      )}
    </div>
  );
}