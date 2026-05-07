/*
 * Fichier : QuickAddKpiModal.jsx
 * Rôle    : Modal rapide de création ou renommage d'un KPI standard (code, libellé, unité).
 *           - Mode création : POST /api/parametres/kpis-standards
 *           - Mode édition  : PATCH /api/parametres/kpis-standards/:code
 * Dépend  : QuickAddKpiModal.css, /api/parametres/kpis-standards
 * Module  : mypaie / Pages / Parametres / Onglets / MappingKpis
 */
import React, { useState, useEffect } from 'react';
import './QuickAddKpiModal.css';

export default function QuickAddKpiModal({ isOpen, onClose, univers, editKpi = null }) {
  const isEditMode = editKpi !== null;
  const [form, setForm] = useState({ code: '', libelle: '', unite: '%' });
  const [saving, setSaving] = useState(false);

  // Pré-remplir le formulaire quand on passe en mode édition
  useEffect(() => {
    if (isEditMode && editKpi) {
      setForm({
        code:    editKpi.code    || '',
        libelle: editKpi.libelle || '',
        unite:   editKpi.unite   || '%',
      });
    } else {
      setForm({ code: '', libelle: '', unite: '%' });
    }
  }, [editKpi, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEditMode) {
        // PATCH : mise à jour libellé + unité
        const res = await fetch(`/api/parametres/kpis-standards/${encodeURIComponent(editKpi.code)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ libelle: form.libelle, unite: form.unite })
        });
        if (res.ok) onClose(true);
      } else {
        // POST : création
        const res = await fetch('/api/parametres/kpis-standards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, univers })
        });
        if (res.ok) onClose(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="qak-overlay" onClick={() => onClose(false)}>
      <div className="qak-modal" onClick={e => e.stopPropagation()}>
        <div className="qak-header">
          <h3>
            {isEditMode
              ? <><i className="fa-solid fa-tag"></i> Modifier le KPI</>
              : <>Nouveau KPI Standard ({univers})</>
            }
          </h3>
          <button type="button" onClick={() => onClose(false)}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="qak-body">
          <div className="qak-field">
            <label>Code Technique (Unique)</label>
            <input
              placeholder="Ex: QUALITY_MAIL"
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
              required
              readOnly={isEditMode}
              className={isEditMode ? 'qak-readonly' : ''}
              title={isEditMode ? 'Le code technique ne peut pas être modifié (clé de liaison)' : ''}
            />
            {isEditMode && (
              <span className="qak-hint">
                <i className="fa-solid fa-lock"></i> Le code ne peut pas être modifié.
              </span>
            )}
          </div>
          <div className="qak-field">
            <label>Libellé Affichage</label>
            <input
              placeholder="Ex: Taux Qualité Mail"
              value={form.libelle}
              onChange={e => setForm({ ...form, libelle: e.target.value })}
              required
              autoFocus={isEditMode}
            />
          </div>
          <div className="qak-field">
            <label>Unité de mesure</label>
            <select value={form.unite} onChange={e => setForm({ ...form, unite: e.target.value })}>
              <option value="%">% (Pourcentage)</option>
              <option value="h">h (Heures)</option>
              <option value="nb">nb (Nombre)</option>
              <option value="DH">DH (Dirhams)</option>
              <option value="EUR">€ (Euros)</option>
            </select>
          </div>
          <div className="qak-footer">
            <button type="button" className="btn-cancel" onClick={() => onClose(false)}>Annuler</button>
            <button type="submit" className="btn-add" disabled={saving}>
              {saving
                ? (isEditMode ? 'Mise à jour…' : 'Création...')
                : (isEditMode ? 'Enregistrer' : 'Créer le standard')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
