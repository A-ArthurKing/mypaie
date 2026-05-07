import React, { useState } from 'react';
import './LibraryTab.css';
import ConfirmationModal from '../../../../Components/ConfirmationModal/ConfirmationModal';
import { useToast } from '../../../../Shared/Contexts/ToastContext';

export default function LibraryTab({ refs, onRefresh }) {
  const addToast = useToast();
  const { projets, operations, files, activites } = refs;

  const [newProjet, setNewProjet] = useState({ libelle: '', code: '' });
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
      else { addToast('Erreur lors de la création', 'error'); return false; }
    } catch { addToast('Erreur', 'error'); return false; }
  };

  const handleAddProjet = async (e) => {
    e.preventDefault();
    if (!newProjet.libelle.trim()) return;
    const ok = await handlePost(
      'projets',
      { nom: newProjet.libelle.trim() },
      'Projet créé avec succès'
    );
    if (ok) setNewProjet({ libelle: '', code: '' });
  };

  const handleAddOperation = async (e) => {
    e.preventDefault();
    if (!newOperation.libelle.trim() || !newOperation.id_projet) return;
    const ok = await handlePost(
      'operations',
      { libelle: newOperation.libelle.trim(), id_projet: parseInt(newOperation.id_projet) },
      'Business Unit créée'
    );
    if (ok) setNewOperation({ libelle: '', id_projet: '' });
  };

  const handleAddFile = async (e) => {
    e.preventDefault();
    if (!newFile.trim()) return;
    const ok = await handlePost('files', { libelle: newFile.trim() }, 'File créé avec succès');
    if (ok) setNewFile('');
  };

  const handleAddActivity = async (e) => {
    e.preventDefault();
    if (!newActivity.trim()) return;
    const ok = await handlePost('activites', { libelle: newActivity.trim() }, 'Activité créée avec succès');
    if (ok) setNewActivity('');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(
        `/api/parametres/structure/${deleteTarget.path}/${deleteTarget.id}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        addToast(`${deleteTarget.label} supprimé(e)`, 'success');
        setDeleteTarget(null);
        onRefresh();
      } else {
        addToast('Erreur lors de la suppression', 'error');
      }
    } catch { addToast('Erreur', 'error'); }
  };

  return (
    <div className="lt-page">
      <div className="lt-grid">

        {/* ── Projets ── */}
        <div className="lt-card">
          <div className="lt-card-header">
            <i className="fa-solid fa-folder-tree"></i>
            <h3>Projets</h3>
            <span className="lt-count">{projets.length}</span>
          </div>
          <div className="lt-card-body">
            <form className="lt-form" onSubmit={handleAddProjet}>
              <input
                placeholder="Nom du projet *"
                value={newProjet.libelle}
                onChange={e => setNewProjet(p => ({ ...p, libelle: e.target.value }))}
                required
              />
              <button type="submit" className="lt-btn-add" title="Créer">
                <i className="fa-solid fa-plus"></i>
              </button>
            </form>
            <div className="lt-list">
              {projets.map(p => (
                <div key={p.id} className="lt-item">
                  <span>{p.libelle}</span>
                  <button
                    className="lt-btn-del"
                    onClick={() => setDeleteTarget({ path: 'projets', id: p.id, label: 'le projet', name: p.libelle })}
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Business Units ── */}
        <div className="lt-card">
          <div className="lt-card-header">
            <i className="fa-solid fa-building"></i>
            <h3>Business Units</h3>
            <span className="lt-count">{operations.length}</span>
          </div>
          <div className="lt-card-body">
            <form className="lt-form" onSubmit={handleAddOperation}>
              <select
                value={newOperation.id_projet}
                onChange={e => setNewOperation(p => ({ ...p, id_projet: e.target.value }))}
                required
              >
                <option value="">Choisir un projet *</option>
                {projets.map(p => <option key={p.id} value={p.id}>{p.libelle}</option>)}
              </select>
              <input
                placeholder="Libellé de la BU *"
                value={newOperation.libelle}
                onChange={e => setNewOperation(p => ({ ...p, libelle: e.target.value }))}
                required
              />
              <button type="submit" className="lt-btn-add" title="Créer">
                <i className="fa-solid fa-plus"></i>
              </button>
            </form>
            <div className="lt-list">
              {operations.map(op => {
                const projet = projets.find(p => p.id === op.id_projet);
                return (
                  <div key={op.id} className="lt-item">
                    <div className="lt-item-info">
                      <span>{op.libelle}</span>
                      {projet && <small>{projet.libelle}</small>}
                    </div>
                    <button
                      className="lt-btn-del"
                      onClick={() => setDeleteTarget({ path: 'operations', id: op.id, label: 'la BU', name: op.libelle })}
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Files ── */}
        <div className="lt-card">
          <div className="lt-card-header">
            <i className="fa-solid fa-layer-group"></i>
            <h3>Files</h3>
            <span className="lt-count">{files.length}</span>
          </div>
          <div className="lt-card-body">
            <form className="lt-form" onSubmit={handleAddFile}>
              <input
                placeholder="Libellé du file (ex: Front, Back...)"
                value={newFile}
                onChange={e => setNewFile(e.target.value)}
                required
              />
              <button type="submit" className="lt-btn-add" title="Créer">
                <i className="fa-solid fa-plus"></i>
              </button>
            </form>
            <div className="lt-list">
              {files.map(f => (
                <div key={f.id} className="lt-item">
                  <span>{f.libelle}</span>
                  <button
                    className="lt-btn-del"
                    onClick={() => setDeleteTarget({ path: 'files', id: f.id, label: 'le file', name: f.libelle })}
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Activités ── */}
        <div className="lt-card">
          <div className="lt-card-header">
            <i className="fa-solid fa-tag"></i>
            <h3>Activités</h3>
            <span className="lt-count">{activites.length}</span>
          </div>
          <div className="lt-card-body">
            <form className="lt-form" onSubmit={handleAddActivity}>
              <input
                placeholder="Libellé de l'activité (ex: BO, Vente...)"
                value={newActivity}
                onChange={e => setNewActivity(e.target.value)}
                required
              />
              <button type="submit" className="lt-btn-add" title="Créer">
                <i className="fa-solid fa-plus"></i>
              </button>
            </form>
            <div className="lt-list">
              {activites.map(a => (
                <div key={a.id} className="lt-item">
                  <span>{a.libelle}</span>
                  <button
                    className="lt-btn-del"
                    onClick={() => setDeleteTarget({ path: 'activites', id: a.id, label: "l'activité", name: a.libelle })}
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

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

