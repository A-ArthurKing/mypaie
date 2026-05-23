/*
 * Fichier : GestionCollaborateurs.jsx
 * Rôle    : Page de gestion des collaborateurs — liste, recherche, filtres, CRUD
 *           avec assignation des niveaux et de la structure projet.
 * Dépend  : AgentsHeader, AgentsToolbar, AgentsTable, AddAgentModal, EditAgentModal,
 *           ConfirmationModal, SocketContext, ToastContext
 * Module  : mypaie / Pages / GestionCollaborateurs
 */
import React, { useState, useEffect } from 'react';
import './GestionCollaborateurs.css';
import AgentsHeader      from './sections/AgentsHeader/AgentsHeader';
import AgentsToolbar     from './sections/AgentsToolbar/AgentsToolbar';
import AgentsTable       from './sections/AgentsTable/AgentsTable';
import AddAgentModal     from './components/AddAgentModal/AddAgentModal';
import EditAgentModal    from './components/EditAgentModal/EditAgentModal';
import ConfirmationModal from '../../Components/ConfirmationModal/ConfirmationModal';
import { useSocket } from '../../Shared/Contexts/SocketContext';
import { useToast } from '../../Shared/Contexts/ToastContext';
import useApiSWR from '../../Shared/Hooks/useApiSWR';
import { TTL } from '../../Shared/Utils/cacheStorage';

const REFS_FALLBACK = { projets: [], operations: [], sous_projets: [], activites: [], statuts: [], structure: [] };

export default function Collaborateurs() {
  const {
    data: agents = [],
    loading,
    revalidate: revalidateAgents,
    mutate: mutateAgents,
  } = useApiSWR(
    'agents:gestion',
    () => fetch('/api/agents/gestion').then(r => r.json()).then(d => d.data || []),
    { ttl: TTL.STATS, fallbackData: [], refreshInterval: 3000 }
  );

  const { data: refs = REFS_FALLBACK } = useApiSWR(
    'parametres:references',
    () => fetch('/api/parametres/references').then(r => r.json()),
    { ttl: TTL.DROPDOWNS, revalidateOnFocus: false, fallbackData: REFS_FALLBACK }
  );

  const [search, setSearch] = useState('');
  const [projetFilter, setProjetFilter] = useState('');
  const [operationFilter, setOperationFilter] = useState('');
  const [sous_projetFilter, setFileFilter] = useState('');
  const [activiteFilter, setActiviteFilter] = useState('');
  const [statutFilter, setStatutFilter] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // agent object
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const socket = useSocket();
  const addToast = useToast();

  // Real-time updates — invalide le cache SWR et recharge les données fraîches
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      console.log('[RealTime] Mise à jour collaborateurs détectée');
      revalidateAgents();
    };

    socket.on('agent_created', handleUpdate);
    socket.on('agent_updated', handleUpdate);
    socket.on('agent_deleted', handleUpdate);

    return () => {
      socket.off('agent_created', handleUpdate);
      socket.off('agent_updated', handleUpdate);
      socket.off('agent_deleted', handleUpdate);
    };
  }, [socket, revalidateAgents]);

  const handleAgentAdded = newAgent => {
    if (newAgent) mutateAgents(prev => [...(prev || []), newAgent]);
  };

  const handleAgentUpdated = updatedAgent => {
    if (updatedAgent)
      mutateAgents(prev => (prev || []).map(a => a.matricule === updatedAgent.matricule ? updatedAgent : a));
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    fetch(`/api/agents/${deleteTarget.matricule}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        mutateAgents(prev => (prev || []).filter(a => a.matricule !== deleteTarget.matricule));
        setDeleteTarget(null);
        addToast('Collaborateur supprimé avec succès', 'success');
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
  const uniqueSousProjets = [...new Set(
    agents
      .filter(a => (!projetFilter || a.projet === projetFilter) && (!operationFilter || a.operation === operationFilter))
      .map(a => a.sous_projet)
      .filter(Boolean)
  )].sort();
  const uniqueActivites  = [...new Set(
    agents
      .filter(a =>
        (!projetFilter    || a.projet    === projetFilter)    &&
        (!operationFilter || a.operation === operationFilter) &&
        (!sous_projetFilter      || a.sous_projet === sous_projetFilter      ) 
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
    const matchFile      = sous_projetFilter      ? (a.sous_projet || '') === sous_projetFilter      : true;
    const matchActivite  = activiteFilter  ? (a.activite  || '') === activiteFilter  : true;
    const matchStatut    = statutFilter    ? (a.statut    || '') === statutFilter    : true;
    return matchSearch && matchProjet && matchOperation && matchFile && matchActivite && matchStatut;
  });

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAgents = filtered.slice(startIndex, startIndex + itemsPerPage);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, projetFilter, operationFilter, sous_projetFilter, activiteFilter, statutFilter]);

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
        sous_projetFilter={sous_projetFilter}
        onSous_projetFilterChange={v => { setFileFilter(v); setActiviteFilter(''); }}
        sous_projets={uniqueSousProjets}
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
          Chargement des collaborateurs...
        </div>
      ) : (
        <>
          <AgentsTable
            agents={paginatedAgents}
            onEdit={agent => setEditingAgent(agent)}
            onDelete={agent => setDeleteTarget(agent)}
          />
          {totalPages > 1 && (
            <div className="agents-pagination">
              <button 
                className="agents-page-btn" 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => p - 1)}
              >
                <i className="fa-solid fa-chevron-left"></i> Précédent
              </button>
              <span className="agents-page-info">
                Page {currentPage} sur {totalPages}
              </span>
              <button 
                className="agents-page-btn" 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Suivant <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          )}
        </>
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
        title="Supprimer le collaborateur"
        message={
          deleteTarget
            ? `Vous allez supprimer définitivement le collaborateur ${deleteTarget.nom} ${deleteTarget.prenom} (${deleteTarget.matricule}). Cette action est irréversible.`
            : ''
        }
        confirmText={deleting ? 'Suppression...' : 'Supprimer'}
        type="danger"
      />
    </div>
  );
}
