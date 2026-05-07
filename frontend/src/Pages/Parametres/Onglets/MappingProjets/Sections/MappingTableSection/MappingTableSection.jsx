import React from 'react';

export default function MappingTableSection({ 
  mappings, 
  loading, 
  error, 
  handleEdit, 
  handleDelete 
}) {
  if (loading) {
    return (
      <div className="mp-list-card mp-list-card--loading">
        <i className="fa-solid fa-circle-notch fa-spin"></i>
        <p>Chargement des mappings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mp-list-card mp-list-card--error">
        <i className="fa-solid fa-triangle-exclamation"></i>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="mp-list-card">
      <div className="mp-card-header">
        <i className="fa-solid fa-list-ul"></i>
        <h3>Mappings actifs <span className="mp-count-badge">{mappings.length}</span></h3>
      </div>

      {!mappings.length ? (
        <div className="mp-empty-state">
          <i className="fa-solid fa-link-slash"></i>
          <p>Aucun mapping configuré pour le moment.</p>
        </div>
      ) : (
        <div className="mp-table-container">
          <table className="mp-table">
            <thead>
              <tr>
                <th>Nom brut (Source)</th>
                <th></th>
                <th>Nom standard</th>
                <th>File / Activité</th>
                <th>Description</th>
                <th className="mp-action-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((item) => (
                <tr key={item.id || item.source_name} className="mp-row">
                  <td className="mp-cell-source">
                    <span className="mp-badge-source">
                      <i className="fa-solid fa-database"></i>
                      {item.source_name}
                    </span>
                  </td>
                  <td className="mp-cell-arrow">
                    <i className="fa-solid fa-arrow-right-long"></i>
                  </td>
                  <td className="mp-cell-standard">
                    <span className="mp-badge-standard">
                      <i className="fa-solid fa-tag"></i>
                      {item.standard_nom}
                    </span>
                  </td>
                  <td className="mp-cell-associations">
                    <div className="mp-assoc-tags">
                      {item.file_nom && (
                        <span className="mp-assoc-tag mp-assoc-tag--file">
                          <i className="fa-solid fa-layer-group"></i> {item.file_nom}
                        </span>
                      )}
                      {item.activite_nom && (
                        <span className="mp-assoc-tag mp-assoc-tag--activity">
                          <i className="fa-solid fa-folder-open"></i> {item.activite_nom}
                        </span>
                      )}
                      {!item.file_nom && !item.activite_nom && <span className="mk-nil">—</span>}
                    </div>
                  </td>
                  <td className="mp-cell-desc">
                    {item.description || <span className="mk-nil">—</span>}
                  </td>
                  <td className="mp-cell-actions">
                    <div className="mp-actions-group">
                      <button 
                        className="mp-action-btn mp-action-btn--edit" 
                        onClick={() => handleEdit(item)}
                        title="Modifier"
                      >
                        <i className="fa-solid fa-pencil" />
                      </button>
                      <button 
                        className="mp-action-btn mp-action-btn--delete" 
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
