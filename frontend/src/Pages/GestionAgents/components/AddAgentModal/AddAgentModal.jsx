import React, { useState, useRef } from 'react';
import './AddAgentModal.css';

const EMPTY_FORM = {
  matricule: '',
  nom: '',
  prenom: '',
  id_projet: '',
  id_operation: '',
  id_file: '',
  id_activite: '',
  id_statut: '',
  prime_langue: 0,
};

export default function AddAgentModal({ isOpen, onClose, onAgentAdded, refs }) {
  const [form, setForm] = useState(EMPTY_FORM);
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

  // Cascade filtering from structure map
  const filteredOps = form.id_projet
    ? operations.filter(o =>
        structure.some(s => String(s.id_projet) === String(form.id_projet) && String(s.id_operation) === String(o.id))
      )
    : operations;

  const filteredFiles = form.id_projet && form.id_operation
    ? files.filter(f =>
        structure.some(
          s =>
            String(s.id_projet) === String(form.id_projet) &&
            String(s.id_operation) === String(form.id_operation) &&
            s.id_file != null &&
            String(s.id_file) === String(f.id)
        )
      )
    : [];

  const filteredActivites = form.id_projet && form.id_operation
    ? activites.filter(a =>
        structure.some(
          s =>
            String(s.id_projet) === String(form.id_projet) &&
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
        // Automatisation prime langue
        const op = operations.find(o => String(o.id) === String(value));
        if (op?.libelle === 'CP NEERLANDO APSO') {
          next.prime_langue = 800;
        } else {
          next.prime_langue = 0;
        }
      }
      if (field === 'id_file')      { next.id_activite = ''; }
      return next;
    });
  };

  const findIdStructure = () => {
    const match = structure.find(s =>
      String(s.id_projet) === String(form.id_projet) &&
      String(s.id_operation) === String(form.id_operation) &&
      (form.id_file     ? String(s.id_file)     === String(form.id_file)     : !s.id_file) &&
      (form.id_activite ? String(s.id_activite) === String(form.id_activite) : !s.id_activite)
    );
    return match ? match.id : null;
  };

  const handleSubmit = e => {
    e.preventDefault();
    setError('');

    if (!form.matricule.trim() || !form.nom.trim() || !form.prenom.trim()) {
      setError('Matricule, Nom et Prénom sont obligatoires.');
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
    fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matricule:    form.matricule.trim().toUpperCase(),
        nom:          form.nom.trim().toUpperCase(),
        prenom:       form.prenom.trim(),
        id_structure,
        id_statut:    form.id_statut || null,
        prime_langue: parseFloat(form.prime_langue) || 0,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        onAgentAdded(data.agent);
        handleClose();
      })
      .catch(err => setError(err.message || "Erreur lors de l'ajout."))
      .finally(() => setSaving(false));
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="aam-overlay"
      ref={overlayRef}
      onClick={e => e.target === overlayRef.current && handleClose()}
    >
      <div className="aam-modal">
        {/* Header */}
        <div className="aam-modal__header">
          <div className="aam-modal__title-wrap">
            <span className="aam-modal__icon">
              <i className="fa-solid fa-user-plus"></i>
            </span>
            <h2 className="aam-modal__title">Ajouter un agent</h2>
          </div>
          <button className="aam-modal__close" onClick={handleClose} type="button">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Form */}
        <form className="aam-modal__form" onSubmit={handleSubmit}>
          {error && (
            <div className="aam-modal__error">
              <i className="fa-solid fa-triangle-exclamation"></i> {error}
            </div>
          )}

          {/* Section : Identité */}
          <div className="aam-modal__section-label">
            <i className="fa-solid fa-id-card"></i> Identité
          </div>
          <div className="aam-modal__row aam-modal__row--3">
            <div className="aam-modal__field">
              <label>Matricule <span className="aam-req">*</span></label>
              <input
                type="text"
                value={form.matricule}
                onChange={e => handleChange('matricule', e.target.value)}
                placeholder="EX: EMP001"
              />
            </div>
            <div className="aam-modal__field">
              <label>Nom <span className="aam-req">*</span></label>
              <input
                type="text"
                value={form.nom}
                onChange={e => handleChange('nom', e.target.value)}
                placeholder="Nom de famille"
              />
            </div>
            <div className="aam-modal__field">
              <label>Prénom <span className="aam-req">*</span></label>
              <input
                type="text"
                value={form.prenom}
                onChange={e => handleChange('prenom', e.target.value)}
                placeholder="Prénom"
              />
            </div>
          </div>

          {/* Section : Structure */}
          <div className="aam-modal__section-label">
            <i className="fa-solid fa-sitemap"></i> Structure
          </div>
          <div className="aam-modal__row aam-modal__row--2">
            <div className="aam-modal__field">
              <label>Projet <span className="aam-req">*</span></label>
              <select value={form.id_projet} onChange={e => handleChange('id_projet', e.target.value)}>
                <option value="">Sélectionner...</option>
                {projets.map(p => <option key={p.id} value={p.id}>{p.libelle}</option>)}
              </select>
            </div>
            <div className="aam-modal__field">
              <label>Opération <span className="aam-req">*</span></label>
              <select
                value={form.id_operation}
                onChange={e => handleChange('id_operation', e.target.value)}
                disabled={!form.id_projet}
              >
                <option value="">Sélectionner...</option>
                {filteredOps.map(o => <option key={o.id} value={o.id}>{o.libelle}</option>)}
              </select>
            </div>
          </div>

          <div className="aam-modal__row aam-modal__row--2">
            <div className="aam-modal__field">
              <label>File</label>
              <select
                value={form.id_file}
                onChange={e => handleChange('id_file', e.target.value)}
                disabled={!form.id_operation || filteredFiles.length === 0}
              >
                <option value="">Aucun / N/A</option>
                {filteredFiles.map(f => <option key={f.id} value={f.id}>{f.libelle}</option>)}
              </select>
            </div>
            <div className="aam-modal__field">
              <label>Activité</label>
              <select
                value={form.id_activite}
                onChange={e => handleChange('id_activite', e.target.value)}
                disabled={!form.id_operation || filteredActivites.length === 0}
              >
                <option value="">Aucune / N/A</option>
                {filteredActivites.map(a => <option key={a.id} value={a.id}>{a.libelle}</option>)}
              </select>
            </div>
          </div>

          {/* Section : Niveau */}
          <div className="aam-modal__section-label">
            <i className="fa-solid fa-star-half-stroke"></i> Niveau & Primes
          </div>
          <div className="aam-modal__row aam-modal__row--2">
            <div className="aam-modal__field">
              <label>Niveau</label>
              <select value={form.id_statut} onChange={e => handleChange('id_statut', e.target.value)}>
                <option value="">Non défini</option>
                {statuts.map(s => <option key={s.id} value={s.id}>{s.libelle}</option>)}
              </select>
            </div>
            <div className="aam-modal__field">
              <label>Prime Langue (DH)</label>
              <input
                type="number"
                value={form.prime_langue}
                onChange={e => handleChange('prime_langue', e.target.value)}
                placeholder="800"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="aam-modal__footer">
            <button type="button" className="aam-modal__btn aam-modal__btn--cancel" onClick={handleClose}>
              Annuler
            </button>
            <button type="submit" className="aam-modal__btn aam-modal__btn--submit" disabled={saving}>
              {saving
                ? <><i className="fa-solid fa-spinner fa-spin"></i> Enregistrement...</>
                : <><i className="fa-solid fa-check"></i> Ajouter l'agent</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
