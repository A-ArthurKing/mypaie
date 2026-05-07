import React, { useState, useMemo } from 'react';
import './StructureExplorer.css';
import ConfirmationModal from '../../../../Components/ConfirmationModal/ConfirmationModal';
import { useToast } from '../../../../Shared/Contexts/ToastContext';

export default function StructureExplorer({ refs, onRefresh }) {
  const addToast = useToast();
  const { projets, operations, files, activites, structure } = refs;

  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [newBuLabel, setNewBuLabel] = useState('');
  const [addingBu, setAddingBu] = useState(false);
  const [linkFileForBu, setLinkFileForBu] = useState({});
  const [linkActForKey, setLinkActForKey] = useState({});

  const selectedProject = projets.find(p => p.id === selectedProjectId);

  const projectBus = useMemo(() => {
    if (!selectedProjectId) return [];
    return operations.filter(op => op.id_projet === selectedProjectId);
  }, [selectedProjectId, operations]);

  const getFilesForBu = (buId) => {
    const fileIds = [...new Set(
      structure.filter(s => s.id_operation === buId).map(s => s.id_file).filter(Boolean)
    )];
    return files.filter(f => fileIds.includes(f.id));
  };

  const getActivitiesForBuFile = (buId, fileId) => {
    const actIds = structure
      .filter(s => s.id_operation === buId && s.id_file === fileId)
      .map(s => s.id_activite)
      .filter(Boolean);
    return activites.filter(a => actIds.includes(a.id));
  };

  const getFileMappingId = (buId, fileId) => {
    const row = structure.find(s =>
      s.id_operation === buId && s.id_file === fileId && !s.id_activite
    );
    return row?.id;
  };

  const getActMappingId = (buId, fileId, actId) => {
    const row = structure.find(s =>
      s.id_operation === buId && s.id_file === fileId && s.id_activite === actId
    );
    return row?.id;
  };

  const getAvailableFiles = (buId) => {
    const linked = new Set(
      structure.filter(s => s.id_operation === buId).map(s => s.id_file).filter(Boolean)
    );
    return files.filter(f => !linked.has(f.id));
  };

  const getAvailableActivities = (buId, fileId) => {
    const linked = new Set(
      structure
        .filter(s => s.id_operation === buId && s.id_file === fileId)
        .map(s => s.id_activite)
        .filter(Boolean)
    );
    return activites.filter(a => !linked.has(a.id));
  };

  const handleCreateBu = async () => {
    if (!newBuLabel.trim() || !selectedProjectId) return;
    try {
      const res = await fetch('/api/parametres/structure/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libelle: newBuLabel.trim(), id_projet: selectedProjectId })
      });
      if (res.ok) {
        setNewBuLabel('');
        setAddingBu(false);
        addToast('Business Unit créée', 'success');
        onRefresh();
      } else {
        addToast('Erreur lors de la création', 'error');
      }
    } catch { addToast('Erreur', 'error'); }
  };

  const handleLinkFile = async (buId, fileId) => {
    if (!fileId) return;
    try {
      const res = await fetch('/api/parametres/structure/mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_projet: selectedProjectId,
          id_operation: buId,
          id_file: fileId,
          id_activite: null
        })
      });
      if (res.ok) {
        addToast('File associé à la BU', 'success');
        setLinkFileForBu(prev => ({ ...prev, [buId]: '' }));
        onRefresh();
      } else {
        addToast("Erreur lors de l'association", 'error');
      }
    } catch { addToast('Erreur', 'error'); }
  };

  const handleLinkActivity = async (buId, fileId, actId) => {
    if (!actId) return;
    try {
      const res = await fetch('/api/parametres/structure/mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_projet: selectedProjectId,
          id_operation: buId,
          id_file: fileId,
          id_activite: actId
        })
      });
      if (res.ok) {
        const key = `${buId}-${fileId}`;
        addToast('Activité associée', 'success');
        setLinkActForKey(prev => ({ ...prev, [key]: '' }));
        onRefresh();
      } else {
        addToast("Erreur lors de l'association", 'error');
      }
    } catch { addToast('Erreur', 'error'); }
  };

  const handleUnlink = async (mappingId) => {
    if (!mappingId) return;
    try {
      const res = await fetch(`/api/parametres/structure/mapping/${mappingId}`, { method: 'DELETE' });
      if (res.ok) { addToast('Association supprimée', 'success'); onRefresh(); }
      else { addToast('Erreur lors de la suppression', 'error'); }
    } catch { addToast('Erreur', 'error'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(
        `/api/parametres/structure/${deleteTarget.type}/${deleteTarget.id}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        addToast(`${deleteTarget.label} supprimé(e)`, 'success');
        if (deleteTarget.type === 'projets') setSelectedProjectId(null);
        setDeleteTarget(null);
        onRefresh();
      } else {
        addToast('Erreur lors de la suppression', 'error');
      }
    } catch { addToast('Erreur', 'error'); }
  };

  return (
    <div className="se-carto">

      {/* ── LEFT: Projects list ── */}
      <div className="se-projects-panel">
        <div className="se-panel-header">
          <i className="fa-solid fa-folder-tree"></i>
          <span>Projets</span>
        </div>
        <div className="se-projects-list">
          {projets.length === 0 && (
            <p className="se-empty-msg">
              Aucun projet. Créez-en un dans l&apos;onglet <strong>Référentiels</strong>.
            </p>
          )}
          {projets.map(p => (
            <div
              key={p.id}
              className={`se-project-item ${selectedProjectId === p.id ? 'active' : ''}`}
              onClick={() => { setSelectedProjectId(p.id); setAddingBu(false); }}
            >
              <div className="se-project-info">
                <strong>{p.libelle}</strong>
              </div>
              <button
                className="se-icon-btn danger"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget({ type: 'projets', id: p.id, label: 'le projet', name: p.libelle });
                }}
                title="Supprimer le projet"
              >
                <i className="fa-solid fa-trash-can"></i>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT: BU tree for selected project ── */}
      <div className="se-tree-panel">
        {!selectedProjectId ? (
          <div className="se-hint">
            <i className="fa-solid fa-hand-point-left"></i>
            <p>Sélectionnez un projet à gauche pour visualiser et gérer sa structure</p>
          </div>
        ) : (
          <>
            <div className="se-tree-header">
              <h3>
                <i className="fa-solid fa-folder-open"></i>
                {selectedProject?.libelle}
              </h3>
              <span className="se-tree-subtitle">
                Gérez les Business Units, Files et Activités de ce projet
              </span>
            </div>

            <div className="se-bu-list">
              {projectBus.length === 0 && (
                <div className="se-empty-bus">
                  <i className="fa-solid fa-circle-info"></i>
                  <span>
                    Aucune Business Unit. Cliquez sur <strong>Ajouter une BU</strong> ci-dessous.
                  </span>
                </div>
              )}

              {projectBus.map(bu => {
                const buFiles = getFilesForBu(bu.id);
                const availFiles = getAvailableFiles(bu.id);

                return (
                  <div key={bu.id} className="se-bu-card">

                    {/* BU Header */}
                    <div className="se-bu-header">
                      <div className="se-bu-title">
                        <i className="fa-solid fa-building"></i>
                        <strong>{bu.libelle}</strong>
                      </div>
                      <button
                        className="se-icon-btn danger-white"
                        onClick={() => setDeleteTarget({ type: 'operations', id: bu.id, label: 'la BU', name: bu.libelle })}
                        title="Supprimer cette BU"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>

                    {/* Files linked to this BU */}
                    <div className="se-files-area">
                      {buFiles.length === 0 && (
                        <div className="se-empty-inline">Aucun file lié à cette BU</div>
                      )}

                      {buFiles.map(f => {
                        const fileMappingId = getFileMappingId(bu.id, f.id);
                        const buFileActs = getActivitiesForBuFile(bu.id, f.id);
                        const availActs = getAvailableActivities(bu.id, f.id);
                        const actKey = `${bu.id}-${f.id}`;

                        return (
                          <div key={f.id} className="se-file-card">
                            <div className="se-file-header">
                              <div className="se-file-title">
                                <i className="fa-solid fa-layer-group"></i>
                                <span>{f.libelle}</span>
                              </div>
                              <button
                                className="se-icon-btn warn"
                                onClick={() => handleUnlink(fileMappingId)}
                                title="Délier ce file de la BU"
                              >
                                <i className="fa-solid fa-link-slash"></i>
                              </button>
                            </div>

                            {/* Activities linked to this File in this BU */}
                            <div className="se-acts-area">
                              {buFileActs.map(a => (
                                <div key={a.id} className="se-act-item">
                                  <i className="fa-solid fa-tag"></i>
                                  <span>{a.libelle}</span>
                                  <button
                                    className="se-icon-btn warn xs"
                                    onClick={() => handleUnlink(getActMappingId(bu.id, f.id, a.id))}
                                    title="Délier cette activité"
                                  >
                                    <i className="fa-solid fa-xmark"></i>
                                  </button>
                                </div>
                              ))}

                              {/* Associate an activity */}
                              {availActs.length > 0 && (
                                <div className="se-assoc-row">
                                  <select
                                    value={linkActForKey[actKey] || ''}
                                    onChange={e =>
                                      setLinkActForKey(prev => ({ ...prev, [actKey]: e.target.value }))
                                    }
                                  >
                                    <option value="">Associer une activité...</option>
                                    {availActs.map(a => (
                                      <option key={a.id} value={a.id}>{a.libelle}</option>
                                    ))}
                                  </select>
                                  <button
                                    className="se-btn-ok"
                                    disabled={!linkActForKey[actKey]}
                                    onClick={() =>
                                      handleLinkActivity(bu.id, f.id, parseInt(linkActForKey[actKey]))
                                    }
                                  >
                                    <i className="fa-solid fa-check"></i>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Associate a file to this BU */}
                      {availFiles.length > 0 && (
                        <div className="se-assoc-row se-assoc-file">
                          <select
                            value={linkFileForBu[bu.id] || ''}
                            onChange={e =>
                              setLinkFileForBu(prev => ({ ...prev, [bu.id]: e.target.value }))
                            }
                          >
                            <option value="">Associer un file à cette BU...</option>
                            {availFiles.map(f => (
                              <option key={f.id} value={f.id}>{f.libelle}</option>
                            ))}
                          </select>
                          <button
                            className="se-btn-ok"
                            disabled={!linkFileForBu[bu.id]}
                            onClick={() => handleLinkFile(bu.id, parseInt(linkFileForBu[bu.id]))}
                          >
                            <i className="fa-solid fa-check"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add BU */}
              <div className="se-add-bu">
                {addingBu ? (
                  <div className="se-add-bu-form">
                    <input
                      autoFocus
                      placeholder="Nom de la Business Unit..."
                      value={newBuLabel}
                      onChange={e => setNewBuLabel(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleCreateBu();
                        if (e.key === 'Escape') setAddingBu(false);
                      }}
                    />
                    <button className="se-btn-confirm" onClick={handleCreateBu}>
                      <i className="fa-solid fa-check"></i> Créer
                    </button>
                    <button className="se-btn-cancel" onClick={() => setAddingBu(false)}>
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                ) : (
                  <button className="se-btn-add-bu" onClick={() => setAddingBu(true)}>
                    <i className="fa-solid fa-plus"></i>
                    Ajouter une Business Unit
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Supprimer ${deleteTarget?.label}`}
        message={`Voulez-vous vraiment supprimer "${deleteTarget?.name}" ?`}
        confirmText="Supprimer"
        type="danger"
      />
    </div>
  );
}

