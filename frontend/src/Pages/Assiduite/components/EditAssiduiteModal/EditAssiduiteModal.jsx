/*
 * Fichier : EditAssiduiteModal.jsx
 * Rôle    : Modal de saisie/mise à jour des données d'assiduité d'un agent.
 *           Affiche le résumé calculé (N.T, TRAV.) en temps réel pendant la saisie.
 * Dépend  : EditAssiduiteModal.css
 * Module  : mypaie / Pages / Assiduite / components
 */
import React, { useState, useEffect, useRef } from 'react';
import './EditAssiduiteModal.css';

// Formate un mois YYYY-MM en label lisible
function formatMoisLabel(mois) {
  if (!mois) return '';
  const [year, month] = mois.split('-').map(Number);
  return new Date(year, month - 1, 1)
    .toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
}

// Champ numérique compact avec label
function NumField({ label, hint, value, onChange, min = 0, max = 31 }) {
  return (
    <div className="eam-field">
      <label className="eam-field__label">
        {label}
        {hint && <span className="eam-field__hint">{hint}</span>}
      </label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || 0)))}
        className="eam-field__input"
      />
    </div>
  );
}

export default function EditAssiduiteModal({ isOpen, onClose, agent, selectedMois, onSave }) {
  const [form, setForm] = useState({
    abs_injustifie: 0,
    retard:         0,
    abs_justifie:   0,
    cp_css:         0,
    jours_ouvres:   22,
  });
  const [saving, setSaving]     = useState(false);
  const [error,  setError]      = useState('');
  const [commentaire, setCommentaire] = useState('');
  const overlayRef = useRef(null);

  // Pré-remplir le formulaire quand l'agent change
  useEffect(() => {
    if (!agent) return;
    setForm({
      abs_injustifie: agent.abs_injustifie ?? 0,
      retard:         agent.retard         ?? 0,
      abs_justifie:   agent.abs_justifie   ?? 0,
      cp_css:         agent.cp_css         ?? 0,
      jours_ouvres:   agent.jours_ouvres   ?? 22,
    });
    setError('');
    setCommentaire('');
  }, [agent]);

  // Fermer le modal sur clic en dehors
  const handleOverlayClick = e => {
    if (e.target === overlayRef.current) onClose();
  };

  // Valeurs dérivées recalculées en direct
  const nt   = (form.abs_injustifie || 0) + (form.abs_justifie || 0) + (form.cp_css || 0);
  const trav = Math.max(0, (form.jours_ouvres || 22) - nt);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');

    // Validation : N.T ne peut pas dépasser les jours ouvrés
    if (nt > form.jours_ouvres) {
      setError(`Les jours non travaillés (${nt}) dépassent les jours ouvrés (${form.jours_ouvres}).`);
      return;
    }

    setSaving(true);
    try {
      await onSave(agent.matricule, { ...form, commentaire: commentaire.trim() || undefined });
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !agent) return null;

  return (
    <div
      className="eam-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="eam-title"
    >
      <div className="eam-modal">

        {/* En-tête */}
        <div className="eam-header">
          <div>
            <h2 className="eam-title" id="eam-title">Saisie Assiduité</h2>
            <p className="eam-subtitle">
              <strong>{agent.nom} {agent.prenom}</strong>
              <span className="eam-mat">#{agent.matricule}</span>
              &nbsp;·&nbsp;
              {formatMoisLabel(selectedMois)}
            </p>
          </div>
          <button className="eam-close" onClick={onClose} title="Fermer">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="eam-body">

            {/* Absences */}
            <fieldset className="eam-group">
              <legend className="eam-group__legend">
                <i className="fa-solid fa-circle-xmark" /> Absences & Retards
              </legend>
              <div className="eam-grid">
                <NumField
                  label="ABS. Injustifiées"
                  hint="Jours"
                  value={form.abs_injustifie}
                  onChange={v => set('abs_injustifie', v)}
                />
                <NumField
                  label="Retards"
                  hint="Occurrences"
                  value={form.retard}
                  onChange={v => set('retard', v)}
                />
                <NumField
                  label="ABS. Justifiées"
                  hint="Jours"
                  value={form.abs_justifie}
                  onChange={v => set('abs_justifie', v)}
                />
                <NumField
                  label="CP / CSS"
                  hint="Jours"
                  value={form.cp_css}
                  onChange={v => set('cp_css', v)}
                />
              </div>
            </fieldset>

            {/* Jours ouvrés */}
            <fieldset className="eam-group">
              <legend className="eam-group__legend">
                <i className="fa-solid fa-briefcase" /> Jours ouvrés du mois
              </legend>
              <div className="eam-grid eam-grid--single">
                <NumField
                  label="Jours ouvrés"
                  hint="Par défaut : 22"
                  value={form.jours_ouvres}
                  onChange={v => set('jours_ouvres', v)}
                  min={1}
                  max={31}
                />
              </div>
            </fieldset>

            {/* Résumé calculé en temps réel */}
            <div className="eam-summary">
              <div className="eam-summary__item">
                <span className="eam-summary__label">Jours non travaillés (N.T)</span>
                <span className={`eam-summary__value ${nt > 0 ? 'eam-summary__value--warn' : ''}`}>{nt}</span>
              </div>
              <div className="eam-summary__sep" />
              <div className="eam-summary__item">
                <span className="eam-summary__label">Jours travaillés (TRAV.)</span>
                <span className="eam-summary__value eam-summary__value--ok">{trav}</span>
              </div>
              <div className="eam-summary__sep" />
              <div className="eam-summary__item">
                <span className="eam-summary__label">Jours ouvrés (OUV.)</span>
                <span className="eam-summary__value">{form.jours_ouvres}</span>
              </div>
            </div>

            {/* Commentaire optionnel */}
            <fieldset className="eam-group">
              <legend className="eam-group__legend">
                <i className="fa-solid fa-comment" /> Commentaire
              </legend>
              <textarea
                className="eam-textarea"
                placeholder="Raison de la modification (optionnel)..."
                rows={2}
                maxLength={500}
                value={commentaire}
                onChange={e => setCommentaire(e.target.value)}
              />
            </fieldset>

          </div>

          {/* Erreur */}
          {error && (
            <div className="eam-error">
              <i className="fa-solid fa-triangle-exclamation" /> {error}
            </div>
          )}

          {/* Footer */}
          <div className="eam-footer">
            <button type="button" className="eam-btn eam-btn--cancel" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="eam-btn eam-btn--save" disabled={saving}>
              {saving
                ? <><i className="fa-solid fa-circle-notch fa-spin" /> Sauvegarde…</>
                : <><i className="fa-solid fa-floppy-disk" /> Enregistrer</>}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
