/*
 * Fichier : QuickAddKpiModal.jsx
 * Rôle    : Modal rapide de création d'un KPI standard (code, libellé, unité)
 *           directement depuis le formulaire de mapping.
 * Dépend  : QuickAddKpiModal.css, /api/parametres/kpis
 * Module  : mypaie / Pages / Parametres / Onglets / MappingKpis
 */
import React, { useState } from 'react';
import './QuickAddKpiModal.css';

export default function QuickAddKpiModal({ isOpen, onClose, univers }) {
  const [form, setForm] = useState({ code: '', libelle: '', unite: '%' });
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/parametres/kpis-standards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, univers })
      });
      if (res.ok) onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="qak-overlay" onClick={onClose}>
      <div className="qak-modal" onClick={e => e.stopPropagation()}>
        <div className="qak-header">
          <h3>Nouveau KPI Standard ({univers})</h3>
          <button onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <form onSubmit={handleSubmit} className="qak-body">
          <div className="qak-field">
            <label>Code Technique (Unique)</label>
            <input 
              placeholder="Ex: QUALITY_MAIL" 
              value={form.code} 
              onChange={e => setForm({...form, code: e.target.value.toUpperCase()})}
              required 
            />
          </div>
          <div className="qak-field">
            <label>Libellé Affichage</label>
            <input 
              placeholder="Ex: Taux Qualité Mail" 
              value={form.libelle} 
              onChange={e => setForm({...form, libelle: e.target.value})}
              required 
            />
          </div>
          <div className="qak-field">
            <label>Unité de mesure</label>
            <select value={form.unite} onChange={e => setForm({...form, unite: e.target.value})}>
              <option value="%">% (Pourcentage)</option>
              <option value="h">h (Heures)</option>
              <option value="nb">nb (Nombre)</option>
              <option value="DH">DH (Dirhams)</option>
              <option value="EUR">€ (Euros)</option>
            </select>
          </div>
          <div className="qak-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-add" disabled={saving}>
              {saving ? 'Création...' : 'Créer le standard'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
