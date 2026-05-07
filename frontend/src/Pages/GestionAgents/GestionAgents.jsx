/*
 * Fichier : GestionAgents.jsx
 * Rôle    : Page de gestion des agents — liste, recherche, filtres, CRUD
 *           avec assignation des niveaux et de la structure projet.
 * Dépend  : AgentsHeader, AgentsToolbar, AgentsTable, AddAgentModal, EditAgentModal,
 *           ConfirmationModal, SocketContext, ToastContext
 * Module  : mypaie / Pages / GestionAgents
 */
import React, { useState, useEffect } from 'react';
import './GestionAgents.css';
import AgentsHeader      from './sections/AgentsHeader/AgentsHeader';
import AgentsToolbar     from './sections/AgentsToolbar/AgentsToolbar';
import AgentsTable       from './sections/AgentsTable/AgentsTable';
import AddAgentModal     from './components/AddAgentModal/AddAgentModal';
import EditAgentModal    from './components/EditAgentModal/EditAgentModal';
import ConfirmationModal from '../../Components/ConfirmationModal/ConfirmationModal';
import { useSocket } from '../../Shared/Contexts/SocketContext';
import { useToast } from '../../Shared/Contexts/ToastContext';

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [projetFilter, setProjetFilter] = useState('');
  const [operationFilter, setOperationFilter] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  const [activiteFilter, setActiviteFilter] = useState('');
  const [statutFilter, setStatutFilter] = useState('');
  const [refs, setRefs] = useState({ projets: [], operations: [], files: [], activites: [], statuts: [], structure: [] });

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // agent object
  const [deleting, setDeleting] = useState(false);
  const socket = useSocket();
  const addToast = useToast();

  const fetchAgents = () => {
    fetch('/api/agents/gestion')
      .then(res => res.json())
      .then(data => {
        setAgents(data.data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Erreur agents:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetch('/api/parametres/references')
      .then(res => res.json())
      .then(data => setRefs(data))
      .catch(err => console.error('Erreur refs:', err));

    fetchAgents();
  }, []);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      console.log('[RealTime] Mise à jour agents détectée');
      fetchAgents();
    };

    socket.on('agent_created', handleUpdate);
    socket.on('agent_updated', handleUpdate);
    socket.on('agent_deleted', handleUpdate);

    return () => {
      socket.off('agent_created', handleUpdate);
      socket.off('agent_updated', handleUpdate);
      socket.off('agent_deleted', handleUpdate);
    };
  }, [socket]);

  const handleAgentAdded = newAgent => {
    if (newAgent) setAgents(prev => [...prev, newAgent]);
  };

  const handleAgentUpdated = updatedAgent => {
    if (updatedAgent)
      setAgents(prev => prev.map(a => a.matricule === updatedAgent.matricule ? updatedAgent : a));
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    fetch(`/api/agents/${deleteTarget.matricule}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setAgents(prev => prev.filter(a => a.matricule !== deleteTarget.matricule));
        setDeleteTarget(null);
        addToast('Agent supprimé avec succès', 'success');
      })
      .catch(err => {
        console.error('Erreur suppression:', err);
        addToast(err.message || 'Erreur lors de la suppression', 'error');
      })
      .finally(() => setDeleting(false));
  };

  // Options uniques (avec cascade projet → opération)
  const uniqueProjets   = [...new Set(agents.map(a => a.projet).filter(Boolean))].sort();
  const uniqueOperations = [...new Set(
    agents
      .filter(a => !projetFilter || a.projet === projetFilter)
      .map(a => a.operation)
      .filter(Boolean)
  )].sort();
  const uniqueFiles = [...new Set(
    agents
      .filter(a => (!projetFilter || a.projet === projetFilter) && (!operationFilter || a.operation === operationFilter))
      .map(a => a.file)
      .filter(Boolean)
  )].sort();
  const uniqueActivites  = [...new Set(
    agents
      .filter(a =>
        (!projetFilter    || a.projet    === projetFilter)    &&
        (!operationFilter || a.operation === operationFilter) &&
        (!fileFilter      || a.file      === fileFilter)
      )
      .map(a => a.activite)
      .filter(Boolean)
  )].sort();

  const filtered = agents.filter(a => {
    const term = search.toLowerCase();
    const matchSearch =
      a.matricule.toLowerCase().includes(term) ||
      a.nom.toLowerCase().includes(term) ||
      a.prenom.toLowerCase().includes(term) ||
      (a.projet    || '').toLowerCase().includes(term) ||
      (a.operation || '').toLowerCase().includes(term) ||
      (a.file      || '').toLowerCase().includes(term) ||
      (a.activite  || '').toLowerCase().includes(term);
    const matchProjet    = projetFilter    ? (a.projet    || '') === projetFilter    : true;
    const matchOperation = operationFilter ? (a.operation || '') === operationFilter : true;
    const matchFile      = fileFilter      ? (a.file      || '') === fileFilter      : true;
    const matchActivite  = activiteFilter  ? (a.activite  || '') === activiteFilter  : true;
    const matchStatut    = statutFilter    ? (a.statut    || '') === statutFilter    : true;
    return matchSearch && matchProjet && matchOperation && matchFile && matchActivite && matchStatut;
  });

  return (
    <div className="agents-page">
      <AgentsHeader
        total={agents.length}
        filtered={filtered.length}
        onAddClick={() => setShowAddModal(true)}
      />

      <AgentsToolbar
        search={search}
        onSearchChange={setSearch}
        projetFilter={projetFilter}
        onProjetFilterChange={v => { setProjetFilter(v); setOperationFilter(''); setFileFilter(''); setActiviteFilter(''); }}
        projets={uniqueProjets}
        operationFilter={operationFilter}
        onOperationFilterChange={v => { setOperationFilter(v); setFileFilter(''); setActiviteFilter(''); }}
        operations={uniqueOperations}
        fileFilter={fileFilter}
        onFileFilterChange={v => { setFileFilter(v); setActiviteFilter(''); }}
        files={uniqueFiles}
        activiteFilter={activiteFilter}
        onActiviteFilterChange={setActiviteFilter}
        activites={uniqueActivites}
        statutFilter={statutFilter}
        onStatutFilterChange={setStatutFilter}
        statutRefs={refs.statuts || []}
        total={agents.length}
        filtered={filtered.length}
      />

      {loading ? (
        <div className="agents-page__loading">
          <i className="fa-solid fa-circle-notch fa-spin"></i>
          Chargement des agents...
        </div>
      ) : (
        <AgentsTable
          agents={filtered}
          onEdit={agent => setEditingAgent(agent)}
          onDelete={agent => setDeleteTarget(agent)}
        />
      )}

      <AddAgentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAgentAdded={handleAgentAdded}
        refs={refs}
      />

      <EditAgentModal
        isOpen={!!editingAgent}
        agent={editingAgent}
        onClose={() => setEditingAgent(null)}
        onAgentUpdated={handleAgentUpdated}
        refs={refs}
      />

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Supprimer l'agent"
        message={
          deleteTarget
            ? `Vous allez supprimer définitivement l'agent ${deleteTarget.nom} ${deleteTarget.prenom} (${deleteTarget.matricule}). Cette action est irréversible.`
            : ''
        }
        confirmText={deleting ? 'Suppression...' : 'Supprimer'}
        type="danger"
      />
    </div>
  );
}
