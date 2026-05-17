import React from 'react';
import './UsersTable.css';

export default function UsersTable({ users, currentUser, onEdit, onDelete }) {
  const getRoleColor = (role) => {
    switch(role) {
      case 'Super Administrateur': return 'role-superadmin';
      case 'Gestionnaire Paie': return 'role-gestionnaire';
      case 'Manager': return 'role-manager';
      default: return 'role-collaborateur';
    }
  };

  return (
    <div className="table-responsive">
      <table className="users-table">
        <thead>
          <tr>
            <th>Identité</th>
            <th>Email</th>
            <th>Rôle</th>
            <th>Statut</th>
            <th className="th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className={u.actif ? '' : 'user-inactive'}>
              <td>
                <div className="user-identity">
                  <div className="user-avatar-small">
                    {u.prenom.charAt(0)}{u.nom.charAt(0)}
                  </div>
                  <div className="user-name-group">
                    <span className="user-fullname">{u.prenom} {u.nom}</span>
                  </div>
                </div>
              </td>
              <td className="user-email">{u.email}</td>
              <td>
                <span className={`role-badge ${getRoleColor(u.role)}`}>
                  {u.role}
                </span>
              </td>
              <td>
                <span className={`status-badge ${u.actif ? 'status-active' : 'status-inactive'}`}>
                  {u.actif ? 'Actif' : 'Désactivé'}
                </span>
              </td>
              <td className="td-actions">
                <button className="btn-action edit" onClick={() => onEdit(u)} title="Modifier">
                  <i className="fa-solid fa-pen-to-square"></i>
                </button>
                {u.id !== currentUser.user_id && (
                  <button className="btn-action delete" onClick={() => onDelete(u)} title="Supprimer">
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}