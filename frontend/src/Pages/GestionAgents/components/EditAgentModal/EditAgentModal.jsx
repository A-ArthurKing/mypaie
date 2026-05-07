import React, { useState, useEffect, useRef } from 'react';
import './EditAgentModal.css';

export default function EditAgentModal({ isOpen, onClose, onAgentUpdated, agent, refs }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const overlayRef = useRef(null);

  const {
    projets = [],
    operations = [],
    files = [],
    activites = [],
    statuts = [],
    structure = [],
  } = refs || {};

  // Pre-fill form whenever agent changes
  useEffect(() => {
    if (!agent || !structure.length) return;

    const projId = projets.find(p => p.libelle === agent.projet)?.id  || '';
    const opId   = operations.find(o => o.libelle === agent.operation)?.id || '';
    const filId  = files.find(f => f.libelle === agent.file)?.id    || '';
    const actId  = activites.find(a => a.libelle === agent.activite)?.id  || '';

    setForm({
      nom:          agent.nom || '',
      prenom:       agent.prenom || '',
      id_projet:    String(projId),
      id_operation: String(opId),
      id_file:      String(filId),
      id_activite:  String(actId),
      id_statut:    String(agent.id_statut || ''),
      prime_langue: agent.prime_langue || 0,
    });
    setError('');
  }, [agent, structure.length]);

  // Cascade filtering
  const filteredOps = form.id_projet
    ? operations.filter(o =>
        structure.some(s =>
          String(s.id_projet) === String(form.id_projet) &&
          String(s.id_operation) === String(o.id)
        )
      )
    : operations;

  const filteredFiles = form.id_projet && form.id_operation
    ? files.filter(f =>
        structure.some(s =>
          String(s.id_projet)    === String(form.id_projet) &&
          String(s.id_operation) === String(form.id_operation) &&
          s.id_file != null &&
          String(s.id_file) === String(f.id)
        )
      )
    : [];

  const filteredActivites = form.id_projet && form.id_operation
    ? activites.filter(a =>
        structure.some(s =>
          String(s.id_projet)    === String(form.id_projet) &&
          String(s.id_operation) === String(form.id_operation) &&
          (!form.id_file || String(s.id_file) === String(form.id_file)) &&
          s.id_activite != null &&
          String(s.id_activite) === String(a.id)
        )
      )
    : [];

  const handleChange = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'id_projet')    { next.id_operation = ''; next.id_file = ''; next.id_activite = ''; }
      if (field === 'id_operation') { 
        next.id_file = ''; 
        next.id_activite = ''; 
        // Automatisation prime langue si on change d'opération
        const op = operations.find(o => String(o.id) === String(value));
        if (op?.libelle === 'CP NEERLANDO APSO') {
          next.prime_langue = 800;
        } else if (value) {
          next.prime_langue = 0;
        }
      }
      if (field === 'id_file')      { next.id_activite = ''; }
      return next;
    });
  };

  const findIdStructure = () => {
    const match = structure.find(s =>
      String(s.id_projet)    === String(form.id_projet) &&
      String(s.id_operation) === String(form.id_operation) &&
      (form.id_file     ? String(s.id_file)      === String(form.id_file)     : !s.id_file) &&
      (form.id_activite ? String(s.id_activite)  === String(form.id_activite) : !s.id_activite)
    );
    return match ? match.id : null;
  };

  const handleSubmit = e => {
    e.preventDefault();
    setError('');

    if (!form.nom.trim() || !form.prenom.trim()) {
      setError('Nom et Prénom sont obligatoires.');
      return;
    }
    if (!form.id_projet || !form.id_operation) {
      setError('Projet et Opération sont obligatoires.');
      return;
    }
    const id_structure = findIdStructure();
    if (!id_structure) {
      setError('Combinaison Projet / Opération / File / Activité introuvable dans la structure.');
      return;
    }

    setSaving(true);
    fetch(`/api/agents/${agent.matricule}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom:         form.nom.trim().toUpperCase(),
        prenom:      form.prenom.trim(),
        id_structure,
        id_statut:   form.id_statut || null,
        prime_langue: parseFloat(form.prime_langue) || 0,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        onAgentUpdated(data.agent);
        onClose();
      })
      .catch(err => setError(err.message || 'Erreur lors de la modification.'))
      .finally(() => setSaving(false));
  };

  if (!isOpen || !agent) return null;

  return (
    <div
      className="eam-overlay"
      ref={overlayRef}
      onClick={e => e.target === overlayRef.current && onClose()}
    >
      <div className="eam-modal">
        {/* Header */}
        <div className="eam-modal__header">
          <div className="eam-modal__title-wrap">
            <span className="eam-modal__icon">
              <i className="fa-solid fa-pen"></i>
            </span>
            <div>
              <h2 className="eam-modal__title">Modifier l'agent</h2>
              <span className="eam-modal__matricule">{agent.matricule}</span>
            </div>
          </div>
          <button className="eam-modal__close" onClick={onClose} type="button">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Form */}
        <form className="eam-modal__form" onSubmit={handleSubmit}>
          {error && (
            <div className="eam-modal__error">
              <i className="fa-solid fa-triangle-exclamation"></i> {error}
            </div>
          )}

          {/* Identité */}
          <div className="eam-modal__section-label">
            <i className="fa-solid fa-id-card"></i> Identité
          </div>
          <div className="eam-modal__row eam-modal__row--2">
            <div className="eam-modal__field">
              <label>Nom <span className="eam-req">*</span></label>
              <input type="text" value={form.nom || ''} onChange={e => handleChange('nom', e.target.value)} />
            </div>
            <div className="eam-modal__field">
              <label>Prénom <span className="eam-req">*</span></label>
              <input type="text" value={form.prenom || ''} onChange={e => handleChange('prenom', e.target.value)} />
            </div>
          </div>

          {/* Structure */}
          <div className="eam-modal__section-label">
            <i className="fa-solid fa-sitemap"></i> Structure
          </div>
          <div className="eam-modal__row eam-modal__row--2">
            <div className="eam-modal__field">
              <label>Projet <span className="eam-req">*</span></label>
              <select value={form.id_projet || ''} onChange={e => handleChange('id_projet', e.target.value)}>
                <option value="">Sélectionner...</option>
                {projets.map(p => <option key={p.id} value={p.id}>{p.libelle}</option>)}
              </select>
            </div>
            <div className="eam-modal__field">
              <label>Opération <span className="eam-req">*</span></label>
              <select
                value={form.id_operation || ''}
                onChange={e => handleChange('id_operation', e.target.value)}
                disabled={!form.id_projet}
              >
                <option value="">Sélectionner...</option>
                {filteredOps.map(o => <option key={o.id} value={o.id}>{o.libelle}</option>)}
              </select>
            </div>
          </div>
          <div className="eam-modal__row eam-modal__row--2">
            <div className="eam-modal__field">
              <label>File</label>
              <select
                value={form.id_file || ''}
                onChange={e => handleChange('id_file', e.target.value)}
                disabled={!form.id_operation || filteredFiles.length === 0}
              >
                <option value="">Aucun / N/A</option>
                {filteredFiles.map(f => <option key={f.id} value={f.id}>{f.libelle}</option>)}
              </select>
            </div>
            <div className="eam-modal__field">
              <label>Activité</label>
              <select
                value={form.id_activite || ''}
                onChange={e => handleChange('id_activite', e.target.value)}
                disabled={!form.id_operation || filteredActivites.length === 0}
              >
                <option value="">Aucune / N/A</option>
                {filteredActivites.map(a => <option key={a.id} value={a.id}>{a.libelle}</option>)}
              </select>
            </div>
          </div>

          {/* Niveau */}
          <div className="eam-modal__section-label">
            <i className="fa-solid fa-star-half-stroke"></i> Niveau & Primes
          </div>
          <div className="eam-modal__row eam-modal__row--2">
            <div className="eam-modal__field">
              <label>Niveau</label>
              <select value={form.id_statut || ''} onChange={e => handleChange('id_statut', e.target.value)}>
                <option value="">Non défini</option>
                {statuts.map(s => <option key={s.id} value={s.id}>{s.libelle}</option>)}
              </select>
            </div>
            <div className="eam-modal__field">
              <label>Prime Langue (DH)</label>
              <input
                type="number"
                value={form.prime_langue || 800}
                onChange={e => handleChange('prime_langue', e.target.value)}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="eam-modal__footer">
            <button type="button" className="eam-modal__btn eam-modal__btn--cancel" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="eam-modal__btn eam-modal__btn--submit" disabled={saving}>
              {saving
                ? <><i className="fa-solid fa-spinner fa-spin"></i> Enregistrement...</>
                : <><i className="fa-solid fa-check"></i> Enregistrer</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
