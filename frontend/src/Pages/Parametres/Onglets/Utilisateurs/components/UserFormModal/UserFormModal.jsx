import React from 'react';
import './UserFormModal.css';

export default function UserFormModal({ isOpen, onClose, onSubmit, formData, setFormData, editingUser, ROLES }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</h3>
          <button className="modal-close" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        
        <form onSubmit={onSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>Prénom</label>
              <input type="text" required value={formData.prenom} onChange={e => setFormData({...formData, prenom: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Nom</label>
              <input type="text" required value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} />
            </div>
          </div>

          <div className="form-group">
            <label>Email</label>
            <input type="email" required disabled={editingUser} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Rôle</label>
              <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Statut</label>
              <select value={formData.actif} onChange={e => setFormData({...formData, actif: parseInt(e.target.value)})}>
                <option value={1}>Actif</option>
                <option value={0}>Désactivé</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>{editingUser ? "Nouveau mot de passe (laisser vide pour ne pas modifier)" : "Mot de passe"}</label>
            <input 
              type="password" 
              required={!editingUser} 
              value={formData.password} 
              onChange={e => setFormData({...formData, password: e.target.value})} 
              placeholder="Saisissez un mot de passe"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-save">Enregistrer</button>
          </div>
        </form>
      </div>
    </div>
  );
}