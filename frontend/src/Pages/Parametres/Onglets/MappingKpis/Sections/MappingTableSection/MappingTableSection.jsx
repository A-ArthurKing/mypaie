/*
 * Fichier : MappingTableSection.jsx
 * Rôle    : Tableau listant les règles de mapping KPI existantes
 *           avec actions d'édition et de suppression.
 * Dépend  : Props injectées par MappingKpis.jsx
 * Module  : mypaie / Pages / Parametres / Onglets / MappingKpis
 */
import React from 'react';

export default function MappingTableSection({ 
  mappings, 
  loading, 
  error, 
  handleEdit, 
  handleDelete,
  handleRenameKpi,
  kpiRefs
}) {
  
  // Helper pour trouver le libellé lisible du KPI standard
  const getReadableStandard = (univers, code) => {
    if (!kpiRefs || !kpiRefs[univers]) return code;
    const found = kpiRefs[univers].find(item => item.code === code);
    return found ? found : { code, libelle: code, unite: null };
  };

  if (loading) {
    return (
      <div className="mk-list-card mk-list-card--loading">
        <i className="fa-solid fa-circle-notch fa-spin"></i>
        <p>Chargement des mappings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mk-list-card mk-list-card--error">
        <i className="fa-solid fa-triangle-exclamation"></i>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="mk-list-card">
      <div className="mk-card-header">
        <i className="fa-solid fa-list-ul"></i>
        <h3>Liaisons existantes <span className="mk-count-badge">{mappings.length}</span></h3>
      </div>

      {!mappings.length ? (
        <div className="mk-empty-state">
          <i className="fa-solid fa-link-slash"></i>
          <p>Aucun mapping configuré pour le moment.</p>
        </div>
      ) : (
        <div className="mk-table-container">
          <table className="mk-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Scope</th>
                <th>Source BigQuery (Table & Colonne)</th>
                <th></th>
                <th>Destination Standard</th>
                <th>Notes</th>
                <th className="mk-action-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((item) => (
                <tr key={item.id} className="mk-row">
                  <td className="mk-cell-univers">
                    <span className={`mk-univers-tag mk-univers-tag--${item.univers.toLowerCase()}`}>
                      {item.univers}
                    </span>
                  </td>
                  <td className="mk-cell-scope">
                    {item.projet_nom ? (
                      <span className="mk-scope-tag mk-scope-tag--project" title={`Uniquement pour ${item.projet_nom}`}>
                        <i className="fa-solid fa-folder-tree"></i> {item.projet_nom}
                      </span>
                    ) : (
                      <span className="mk-scope-tag mk-scope-tag--global" title="Utilisé pour tous les projets">
                        <i className="fa-solid fa-earth-africa"></i> Global
                      </span>
                    )}
                  </td>
                  <td className="mk-cell-source">
                    <div className="mk-source-info">
                      <span className="mk-table-name">
                        <i className="fa-solid fa-table"></i> {item.source_table}
                      </span>
                      {item.is_formula ? (
                        <span className="mk-formula-badge" title={item.formula}>
                          <i className="fa-solid fa-calculator"></i> {item.formula}
                        </span>
                      ) : (
                        <span className="mk-column-name">
                          <i className="fa-solid fa-columns"></i> {item.source_column}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="mk-cell-arrow">
                    <i className="fa-solid fa-arrow-right-long"></i>
                  </td>
                  <td className="mk-cell-standard">
                    {(() => {
                      const kpi = getReadableStandard(item.univers, item.standard_kpi_code);
                      return (
                        <span className="mk-badge-standard">
                          <i className="fa-solid fa-bullseye"></i>
                          <strong>{typeof kpi === 'object' ? kpi.libelle : kpi}</strong>
                          <small>{item.standard_kpi_code}</small>
                        </span>
                      );
                    })()}
                  </td>
                  <td className="mk-cell-desc">
                    {item.description || <span className="mk-nil">—</span>}
                  </td>
                  <td className="mk-cell-actions">
                    <div className="mk-actions-group">
                      {handleRenameKpi && (() => {
                        const kpi = getReadableStandard(item.univers, item.standard_kpi_code);
                        return (
                          <button
                            className="mk-action-btn mk-action-btn--rename"
                            onClick={() => handleRenameKpi(
                              typeof kpi === 'object'
                                ? { ...kpi, univers: item.univers }
                                : { code: item.standard_kpi_code, libelle: item.standard_kpi_code, unite: '%', univers: item.univers }
                            )}
                            title="Renommer la destination (KPI Standard)"
                          >
                            <i className="fa-solid fa-tag" />
                          </button>
                        );
                      })()}
                      <button 
                        className="mk-action-btn mk-action-btn--edit" 
                        onClick={() => handleEdit(item)}
                        title="Modifier le mapping"
                      >
                        <i className="fa-solid fa-pencil" />
                      </button>
                      <button 
                        className="mk-action-btn mk-action-btn--delete" 
                        onClick={() => handleDelete(item)}
                        title="Supprimer"
                      >
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
