/*
 * Fichier : EcGrilleContent.jsx
 * Rôle    : Affichage de la règle de prime active + indicateurs + statuts + paliers.
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

/* ── Indicateurs KPI ── */
function EcIndicateurs({ indicateurs, grilleName }) {
  if (!Array.isArray(indicateurs) || indicateurs.length === 0) return null;
  return (
    <EcSection icon="fa-bullseye" title="Indicateurs" badge={grilleName} className="ec-bento-kpis">
      <div className="ec-grille__kpi-grid">
        {indicateurs.map((kpi, idx) => (
          <div key={kpi.id || idx} className="ec-grille__kpi-card">
            <div className="ec-grille__kpi-header">
              <span className="ec-grille__kpi-nom">{kpi.nom || kpi.id || `KPI ${idx + 1}`}</span>
              {kpi.poids != null && (
                <span className="ec-grille__kpi-poids">{kpi.poids}%</span>
              )}
            </div>

            {kpi.categorie && (
              <span className="ec-grille__kpi-categorie">{kpi.categorie}</span>
            )}

            {Array.isArray(kpi.paliers) && kpi.paliers.length > 0 && (
              <div className="ec-grille__kpi-paliers">
                {kpi.paliers.map((p, pi) => (
                  <div key={pi} className="ec-grille__palier-row">
                    <span className="ec-grille__palier-label">
                      {p.label || p.nom || `Palier ${pi + 1}`}
                    </span>
                    <div className="ec-grille__palier-vals">
                      {p.min != null && <span className="ec-grille__palier-seuil">≥ {p.min}</span>}
                      {p.max != null && <span className="ec-grille__palier-seuil">≤ {p.max}</span>}
                      {p.points != null && (
                        <span className="ec-grille__palier-pts">{p.points} pts</span>
                      )}
                      {p.taux != null && (
                        <span className="ec-grille__palier-pts">{p.taux}%</span>
                      )}
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
  
  // Clean up userStatut to ensure safe matching
  const safeUserStatut = userStatut ? String(userStatut).trim().toLowerCase() : null;

  return (
    <EcSection icon="fa-stairs" title="Niveaux de prime" className="ec-bento-statuts">
      <div className="ec-grille__table">
        <div className="ec-grille__table-head">
          <span>Statut</span>
          <span>Prime brute</span>
          <span>Montant SB</span>
        </div>
        {statuts.map((s, idx) => {
          const isCurrent = safeUserStatut && s.nom && String(s.nom).trim().toLowerCase() === safeUserStatut;
          return (
            <div key={idx} className={`ec-grille__table-row ${isCurrent ? 'ec-grille__table-row--active' : ''}`}>
              <span className="ec-grille__table-label">
                {s.nom || `Statut ${idx + 1}`}
                {isCurrent && <span className="ec-badge-current">Votre statut</span>}
              </span>
              <span className="ec-grille__table-prime">
                {s.prime_brute != null ? `${Number(s.prime_brute).toFixed(2)} €` : '—'}
              </span>
              <span className="ec-grille__table-neutral">
                {s.montant_sb != null ? `${Number(s.montant_sb).toFixed(2)} €` : '—'}
              </span>
            </div>
          );
        })}
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
                ? `${Number(p.prime).toFixed(2)} €`
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
export default function EcGrilleContent({ regle, agent }) {
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

      {/* ── Indicateurs (depuis config active) ── */}
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
                  {item.poids != null && (
                    <span className="ec-grille__kpi-poids">{item.poids}%</span>
                  )}
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
