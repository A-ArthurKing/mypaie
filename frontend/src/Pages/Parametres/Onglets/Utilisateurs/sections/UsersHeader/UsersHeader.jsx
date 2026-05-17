import React from 'react';
import './UsersHeader.css';

export default function UsersHeader({ onAddUser }) {
  return (
    <div className="utilisateurs-header">
      <div className="header-info">
        <h2>Gestion des utilisateurs</h2>
        <p>Créez et configurez les accès à la plateforme (RBAC).</p>
      </div>
      <button className="btn-add-user" onClick={() => onAddUser()}>
        <i className="fa-solid fa-user-plus"></i>
        Ajouter un utilisateur
      </button>
    </div>
  );
}