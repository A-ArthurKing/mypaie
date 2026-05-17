import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../Shared/Contexts/AuthContext';
import ConfirmationModal from '../../../../Components/ConfirmationModal/ConfirmationModal';
import UsersHeader from './sections/UsersHeader/UsersHeader';
import UsersTable from './sections/UsersTable/UsersTable';
import UserFormModal from './components/UserFormModal/UserFormModal';
import './Utilisateurs.css';

export default function Utilisateurs() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    nom: '', prenom: '', email: '', role: 'Collaborateur', password: '', actif: 1
  });

  const { user: currentUser } = useAuth();
  
  // N'autoriser l'accès qu'au Super Admin
  if (currentUser?.role !== 'Super Administrateur') {
    return (
      <div className="utilisateurs-container error-container">
        <i className="fa-solid fa-lock"></i>
        <h2>Accès refusé</h2>
        <p>Vous n'avez pas les droits nécessaires pour accéder à cette page.</p>
      </div>
    );
  }

  const ROLES = ['Collaborateur', 'Manager', 'Gestionnaire Paie', 'Super Administrateur'];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (res.ok) {
        setUsers(data.data || []);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role,
        actif: user.actif,
        password: '' // empty so we don't accidentally override
      });
    } else {
      setEditingUser(null);
      setFormData({
        nom: '', prenom: '', email: '', role: 'Collaborateur', password: '', actif: 1
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      
      const payload = { ...formData };
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const confirmDelete = async () => {
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Erreur de suppression");
      
      setIsDeleteModalOpen(false);
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const getRoleColor = (role) => {
    switch(role) {
      case 'Super Administrateur': return 'role-superadmin';
      case 'Gestionnaire Paie': return 'role-gestionnaire';
      case 'Manager': return 'role-manager';
      default: return 'role-collaborateur';
    }
  };

  return (
    <div className="utilisateurs-container">
      <UsersHeader onAddUser={() => handleOpenModal()} />

      {loading ? (
        <div className="loading">Chargement des utilisateurs...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <UsersTable 
          users={users} 
          currentUser={currentUser} 
          onEdit={handleOpenModal} 
          onDelete={(u) => { setEditingUser(u); setIsDeleteModalOpen(true); }} 
        />
      )}

      <UserFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        editingUser={editingUser}
        ROLES={ROLES}
      />

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Supprimer l'utilisateur"
        message={`Êtes-vous sûr de vouloir supprimer définitivement ${editingUser?.prenom} ${editingUser?.nom} ?`}
        confirmText="Supprimer"
        cancelText="Annuler"
        type="danger"
      />
    </div>
  );
}