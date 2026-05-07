import React, { useState, useMemo } from 'react';
import './LibraryTab.css';
import ConfirmationModal from '../../../../Components/ConfirmationModal/ConfirmationModal';
import { useToast } from '../../../../Shared/Contexts/ToastContext';

export default function LibraryTab({ refs, onRefresh }) {
  const addToast = useToast();
  const { projets, operations, files, activites, structure } = refs;

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [newProjet, setNewProjet] = useState('');
  const [newOperation, setNewOperation] = useState({ libelle: '', id_projet: '' });
  const [newFile, setNewFile] = useState('');
  const [newActivity, setNewActivity] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handlePost = async (path, body, successMsg) => {
    try {
      const res = await fetch(`/api/parametres/structure/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) { addToast(successMsg, 'success'); onRefresh(); return true; }
      addToast('Erreur lors de la création', 'error'); return false;
    } catch { addToast('Erreur', 'error'); return false; }
  };

  const handleAddProjet = async (e) => {
    e.preventDefault();
    if (!newProjet.trim()) return;
    const ok = await handlePost('projets', { nom: newProjet.trim() }, 'Projet créé');
    if (ok) setNewProjet('');
  };

  const handleAddOperation = async (e) => {
    e.preventDefault();
    if (!newOperation.libelle.trim() || !newOperation.id_projet) return;
    const ok = await handlePost(
      'operations',
      { libelle: newOperation.libelle.trim(), id_projet: parseInt(newOperation.id_projet) },
      'Business Unit créée'
    );
    if (ok) setNewOperation(p => ({ ...p, libelle: '' }));
  };

  const handleAddFile = async (e) => {
    e.preventDefault();
    if (!newFile.trim()) return;
    const ok = await handlePost('files', { libelle: newFile.trim() }, 'File créé');
    if (ok) setNewFile('');
  };

  const handleAddActivity = async (e) => {
    e.preventDefault();
    if (!newActivity.trim()) return;
    const ok = await handlePost('activites', { libelle: newActivity.trim() }, 'Activité créée');
    if (ok) setNewActivity('');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/parametres/structure/${deleteTarget.path}/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        addToast(`${deleteTarget.label} supprimé(e)`, 'success');
        setDeleteTarget(null);
        onRefresh();
      } else {
        addToast('Erreur lors de la suppression', 'error');
      }
    } catch { addToast('Erreur', 'error'); }
  };

  /* ── Build flat table rows: Projet → BU → File → Activité ── */
  const tableRows = useMemo(() => {
    const rows = [];
    for (const projet of projets) {
      const projectBus = operations.filter(op => op.id_projet === projet.id);
      if (projectBus.length === 0) {
        rows.push({ projet, bu: null, file: null, activite: null });
        continue;
      }
      for (const bu of projectBus) {
        const fileIds = [...new Set(
          structure.filter(s => s.id_operation === bu.id).map(s => s.id_file).filter(Boolean)
        )];
        const buFiles = files.filter(f => fileIds.includes(f.id));
        if (buFiles.length === 0) {
          rows.push({ projet, bu, file: null, activite: null });
          continue;
        }
        for (const file of buFiles) {
          const actMappings = structure.filter(
            s => s.id_operation === bu.id && s.id_file === file.id && s.id_activite
          );
          if (actMappings.length === 0) {
            rows.push({ projet, bu, file, activite: null });
            continue;
          }
          for (const mapping of actMappings) {
            const activite = activites.find(a => a.id === mapping.id_activite) || null;
            rows.push({ projet, bu, file, activite });
          }
        }
      }
    }
    return rows;
  }, [projets, operations, structure, files, activites]);

  return (
    <div className="lt-page">

      {/* ── Toolbar ── */}
      <div className="lt-toolbar">
        <button className="lt-toggle-btn" onClick={() => setShowAddPanel(v => !v)}>
          <i className={`fa-solid fa-chevron-${showAddPanel ? 'up' : 'down'}`}></i>
          Ajouter des éléments
        </button>
        <span className="lt-summary">
          {projets.length} projet{projets.length !== 1 ? 's' : ''} &middot;{' '}
          {operations.length} BU{operations.length !== 1 ? 's' : ''} &middot;{' '}
          {files.length} file{files.length !== 1 ? 's' : ''} &middot;{' '}
          {activites.length} activité{activites.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Add panel ── */}
      {showAddPanel && (
        <div className="lt-add-panel">
          <div className="lt-add-card">
            <div className="lt-add-card-title"><i className="fa-solid fa-folder-tree"></i> Nouveau projet</div>
            <form className="lt-form" onSubmit={handleAddProjet}>
              <input placeholder="Nom du projet *" value={newProjet}
                onChange={e => setNewProjet(e.target.value)} required />
              <button type="submit" className="lt-btn-add"><i className="fa-solid fa-plus"></i></button>
            </form>
          </div>

          <div className="lt-add-card">
            <div className="lt-add-card-title"><i className="fa-solid fa-building"></i> Nouvelle BU</div>
            <form className="lt-form" onSubmit={handleAddOperation}>
              <select value={newOperation.id_projet}
                onChange={e => setNewOperation(p => ({ ...p, id_projet: e.target.value }))} required>
                <option value="">Projet *</option>
                {projets.map(p => <option key={p.id} value={p.id}>{p.libelle}</option>)}
              </select>
              <input placeholder="Libellé *" value={newOperation.libelle}
                onChange={e => setNewOperation(p => ({ ...p, libelle: e.target.value }))} required />
              <button type="submit" className="lt-btn-add"><i className="fa-solid fa-plus"></i></button>
            </form>
          </div>

          <div className="lt-add-card">
            <div className="lt-add-card-title"><i className="fa-solid fa-layer-group"></i> Nouveau file</div>
            <form className="lt-form" onSubmit={handleAddFile}>
              <input placeholder="Libellé *" value={newFile}
                onChange={e => setNewFile(e.target.value)} required />
              <button type="submit" className="lt-btn-add"><i className="fa-solid fa-plus"></i></button>
            </form>
            <div className="lt-mini-list">
              {files.map(f => (
                <div key={f.id} className="lt-mini-item">
                  <span>{f.libelle}</span>
                  <button className="lt-btn-del" onClick={() =>
                    setDeleteTarget({ path: 'files', id: f.id, label: 'le file', name: f.libelle })}>
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="lt-add-card">
            <div className="lt-add-card-title"><i className="fa-solid fa-tag"></i> Nouvelle activité</div>
            <form className="lt-form" onSubmit={handleAddActivity}>
              <input placeholder="Libellé *" value={newActivity}
                onChange={e => setNewActivity(e.target.value)} required />
              <button type="submit" className="lt-btn-add"><i className="fa-solid fa-plus"></i></button>
            </form>
            <div className="lt-mini-list">
              {activites.map(a => (
                <div key={a.id} className="lt-mini-item">
                  <span>{a.libelle}</span>
                  <button className="lt-btn-del" onClick={() =>
                    setDeleteTarget({ path: 'activites', id: a.id, label: "l'activité", name: a.libelle })}>
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Hierarchical table ── */}
      <div className="lt-table-wrap">
        {tableRows.length === 0 ? (
          <div className="lt-empty-state">
            <i className="fa-solid fa-table"></i>
            <p>Aucune donnée. Commencez par ajouter des projets et des Business Units.</p>
          </div>
        ) : (
          <table className="lt-table">
            <thead>
              <tr>
                <th><i className="fa-solid fa-folder-tree"></i> Projet</th>
                <th><i className="fa-solid fa-building"></i> Business Unit</th>
                <th><i className="fa-solid fa-layer-group"></i> File</th>
                <th><i className="fa-solid fa-tag"></i> Activité</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, idx) => {
                const prev = tableRows[idx - 1];
                const showProjet = !prev || prev.projet?.id !== row.projet?.id;
                const showBu = showProjet || !prev || prev.bu?.id !== row.bu?.id;
                const showFile = showBu || !prev || prev.file?.id !== row.file?.id;

                return (
                  <tr key={idx} className={showProjet ? 'lt-tr-project-top' : showBu ? 'lt-tr-bu-top' : ''}>

                    <td className={`lt-td ${showProjet ? 'lt-cell-top' : 'lt-cell-cont'}`}>
                      {showProjet && (
                        <div className="lt-cell-inner">
                          <span className="lt-cell-project">{row.projet.libelle}</span>
                          <button className="lt-btn-del" title="Supprimer le projet"
                            onClick={() => setDeleteTarget({ path: 'projets', id: row.projet.id, label: 'le projet', name: row.projet.libelle })}>
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      )}
                    </td>

                    <td className={`lt-td ${showBu ? 'lt-cell-top' : 'lt-cell-cont'}`}>
                      {showBu && row.bu && (
                        <div className="lt-cell-inner">
                          <span className="lt-cell-bu">{row.bu.libelle}</span>
                          <button className="lt-btn-del" title="Supprimer la BU"
                            onClick={() => setDeleteTarget({ path: 'operations', id: row.bu.id, label: 'la BU', name: row.bu.libelle })}>
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      )}
                    </td>

                    <td className={`lt-td ${showFile ? 'lt-cell-top' : 'lt-cell-cont'}`}>
                      {showFile && row.file && (
                        <div className="lt-cell-inner">
                          <span>{row.file.libelle}</span>
                        </div>
                      )}
                    </td>

                    <td className="lt-td">
                      {row.activite && (
                        <div className="lt-cell-inner">
                          <span>{row.activite.libelle}</span>
                        </div>
                      )}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Supprimer ${deleteTarget?.label}`}
        message={`Voulez-vous vraiment supprimer "${deleteTarget?.name}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        type="danger"
      />
    </div>
  );
}
