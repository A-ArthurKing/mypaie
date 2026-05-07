import React, { useState } from 'react';
import './ProjetsTab.css';
import ConfirmationModal from '../../../../Components/ConfirmationModal/ConfirmationModal';
import { useToast } from '../../../../Shared/Contexts/ToastContext';

export default function ProjetsTab({ projects, operations }) {
  const addToast = useToast();
  const [editingProject, setEditingProject] = useState(null);
  const [newProject, setNewProject] = useState({ nom: '', code: '' });
  const [newOperation, setNewOperation] = useState({ id_projet: '', libelle: '' });
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'project'|'operation', id: number, name: string }

  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!newProject.nom) return;
    try {
      const res = await fetch('/api/parametres/structure/projets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject)
      });
      if (res.ok) setNewProject({ nom: '', code: '' });
    } catch (e) { console.error(e); }
  };

  const handleAddOperation = async (e) => {
    e.preventDefault();
    if (!newOperation.id_projet || !newOperation.libelle) return;
    try {
      const res = await fetch('/api/parametres/structure/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOperation)
      });
      if (res.ok) setNewOperation({ id_projet: '', libelle: '' });
    } catch (e) { console.error(e); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const url = deleteTarget.type === 'project' 
      ? `/api/parametres/structure/projets/${deleteTarget.id}` 
      : `/api/parametres/structure/operations/${deleteTarget.id}`;
    const label = deleteTarget.type === 'project' ? 'Projet' : 'Opération';
    try {
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) {
        setDeleteTarget(null);
        addToast(`${label} supprimé(e) avec succès`, 'success');
      } else {
        addToast(`Erreur lors de la suppression du/de la ${label.toLowerCase()}`, 'error');
      }
    } catch (e) {
      console.error(e);
      addToast('Erreur lors de la suppression', 'error');
    }
  };

  return (
    <div className="pt-tab">
      <div className="pt-grid">
        {/* Colonne 1 : Projets */}
        <section className="pt-section">
          <div className="pt-card">
            <div className="pt-card-header">
              <i className="fa-solid fa-folder-open"></i>
              <h3>Référentiel Projets</h3>
            </div>
            <div className="pt-card-body">
              <form className="pt-quick-form" onSubmit={handleAddProject}>
                <input 
                  placeholder="Nom du projet" 
                  value={newProject.nom} 
                  onChange={e => setNewProject({...newProject, nom: e.target.value})} 
                  required
                />
                <input 
                  placeholder="Code (ex: PVCP)" 
                  value={newProject.code} 
                  onChange={e => setNewProject({...newProject, code: e.target.value})} 
                />
                <button type="submit" className="pt-btn-add"><i className="fa-solid fa-plus"></i></button>
              </form>

              <div className="pt-list">
                {projects.map(p => (
                  <div key={p.id} className="pt-item">
                    <div className="pt-item-info">
                      <strong>{p.libelle}</strong>
                      {p.code && <small>{p.code}</small>}
                    </div>
                    <div className="pt-item-actions">
                      <button className="pt-action-btn danger" onClick={() => setDeleteTarget({ type: 'project', id: p.id, name: p.libelle })}>
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Colonne 2 : Opérations (BU) */}
        <section className="pt-section">
          <div className="pt-card">
            <div className="pt-card-header">
              <i className="fa-solid fa-gears"></i>
              <h3>Business Units (Opérations)</h3>
            </div>
            <div className="pt-card-body">
              <form className="pt-quick-form pt-quick-form--stack" onSubmit={handleAddOperation}>
                <select 
                  value={newOperation.id_projet} 
                  onChange={e => setNewOperation({...newOperation, id_projet: e.target.value})}
                  required
                >
                  <option value="">-- Rattacher au projet --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.libelle}</option>)}
                </select>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    placeholder="Nom de la BU / Opération" 
                    value={newOperation.libelle} 
                    onChange={e => setNewOperation({...newOperation, libelle: e.target.value})}
                    required
                  />
                  <button type="submit" className="pt-btn-add"><i className="fa-solid fa-plus"></i></button>
                </div>
              </form>

              <div className="pt-list">
                {operations.map(o => {
                  const parentProj = projects.find(p => p.id === o.id_projet);
                  return (
                    <div key={o.id} className="pt-item">
                      <div className="pt-item-info">
                        <strong>{o.libelle}</strong>
                        <small className="pt-parent-tag">{parentProj?.libelle || '—'}</small>
                      </div>
                      <div className="pt-item-actions">
                        <button className="pt-action-btn danger" onClick={() => setDeleteTarget({ type: 'operation', id: o.id, name: o.libelle })}>
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Supprimer ${deleteTarget?.type === 'project' ? 'le projet' : 'l\'opération'}`}
        message={`Voulez-vous vraiment supprimer "${deleteTarget?.name}" ? Cela peut impacter les agents et mappings rattachés.`}
        confirmText="Supprimer"
        type="danger"
      />
    </div>
  );
}
