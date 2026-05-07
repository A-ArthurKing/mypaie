/*
 * Fichier : MappingTab.jsx
 * Rôle    : Onglet de liaison manuelle Projet → BU → File → Activité
 *           dans la table ref_structure_map.
 * Dépend  : ConfirmationModal, ToastContext, /api/parametres/structure
 * Module  : mypaie / Pages / GestionStructure / tabs
 */
import React, { useState } from 'react';
import './MappingTab.css';
import ConfirmationModal from '../../../../Components/ConfirmationModal/ConfirmationModal';
import { useToast } from '../../../../Shared/Contexts/ToastContext';

export default function MappingTab({ refs }) {
  const addToast = useToast();
  const { projets, operations, files, activites, structure } = refs;
  const [form, setForm] = useState({ id_projet: '', id_operation: '', id_file: '', id_activite: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Filtrer les opérations selon le projet choisi
  const filteredOps = form.id_projet 
    ? operations.filter(o => o.id_projet === parseInt(form.id_projet)) 
    : [];

  const handleAddMapping = async (e) => {
    e.preventDefault();
    if (!form.id_projet || !form.id_operation) return;
    try {
      await fetch('/api/parametres/structure/mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      setForm({ id_projet: '', id_operation: '', id_file: '', id_activite: '' });
    } catch (e) { console.error(e); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/parametres/structure/mapping/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteTarget(null);
        addToast('Combinaison supprimée avec succès', 'success');
      } else {
        addToast('Erreur lors de la suppression', 'error');
      }
    } catch (e) {
      console.error(e);
      addToast('Erreur lors de la suppression', 'error');
    }
  };

  return (
    <div className="mt-tab">
      <div className="mt-card">
        <div className="mt-card-header">
          <i className="fa-solid fa-link"></i>
          <h3>Nouvelle Combinaison (Cartographie)</h3>
        </div>
        <div className="mt-card-body">
          <form className="mt-form" onSubmit={handleAddMapping}>
            <div className="mt-form-grid">
              <div className="mt-field">
                <label>Projet</label>
                <select value={form.id_projet} onChange={e => setForm({...form, id_projet: e.target.value, id_operation: ''})} required>
                  <option value="">-- Choisir --</option>
                  {projets.map(p => <option key={p.id} value={p.id}>{p.libelle}</option>)}
                </select>
              </div>
              <div className="mt-field">
                <label>Opération / BU</label>
                <select value={form.id_operation} onChange={e => setForm({...form, id_operation: e.target.value})} disabled={!form.id_projet} required>
                  <option value="">-- Choisir --</option>
                  {filteredOps.map(o => <option key={o.id} value={o.id}>{o.libelle}</option>)}
                </select>
              </div>
              <div className="mt-field">
                <label>File (Optionnel)</label>
                <select value={form.id_file} onChange={e => setForm({...form, id_file: e.target.value})}>
                  <option value="">-- Aucun --</option>
                  {files.map(f => <option key={f.id} value={f.id}>{f.libelle}</option>)}
                </select>
              </div>
              <div className="mt-field">
                <label>Activité (Optionnel)</label>
                <select value={form.id_activite} onChange={e => setForm({...form, id_activite: e.target.value})}>
                  <option value="">-- Aucune --</option>
                  {activites.map(a => <option key={a.id} value={a.id}>{a.libelle}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" className="mt-btn-submit" disabled={!form.id_projet || !form.id_operation}>
              <i className="fa-solid fa-plus"></i> Créer la branche
            </button>
          </form>
        </div>
      </div>

      <div className="mt-list-card">
        <div className="mt-card-header">
          <i className="fa-solid fa-sitemap"></i>
          <h3>Structure Actuelle</h3>
        </div>
        <div className="mt-table-wrapper">
          <table className="mt-table">
            <thead>
              <tr>
                <th>Projet</th>
                <th>Opération</th>
                <th>File</th>
                <th>Activité</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {structure.map(s => (
                <tr key={s.id} className="mt-row">
                  <td><span className="mt-badge mt-badge--projet">{projets.find(p => p.id === s.id_projet)?.libelle}</span></td>
                  <td><span className="mt-badge mt-badge--op">{operations.find(o => o.id === s.id_operation)?.libelle}</span></td>
                  <td>{files.find(f => f.id === s.id_file)?.libelle || <span className="mt-nil">—</span>}</td>
                  <td>{activites.find(a => a.id === s.id_activite)?.libelle || <span className="mt-nil">—</span>}</td>
                  <td>
                    <button className="mt-action-btn danger" onClick={() => setDeleteTarget(s)}>
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer la branche"
        message="Voulez-vous vraiment supprimer cette combinaison ? Cela empêchera l'ajout de nouveaux agents sur ce périmètre."
        confirmText="Supprimer"
        type="danger"
      />
    </div>
  );
}
