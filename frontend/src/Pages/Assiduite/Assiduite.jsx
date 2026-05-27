/*
 * Fichier : Assiduite.jsx
 * Rôle    : Page de gestion de l'assiduité mensuelle des collaborateurs.
 *           Orchestre la sélection du mois, le tableau de bord et le modal de saisie.
 * Dépend  : useAssiduite, AssiduiteHeader, AssiduiteToolbar, AssiduiteTable,
 *           EditAssiduiteModal, ToastContext
 * Module  : mypaie / Pages / Assiduite
 */

// #region IMPORTS
import React, { useState, useMemo, useEffect } from 'react';
import './Assiduite.css';
import useAssiduite from './useAssiduite';
import AssiduiteHeader   from './sections/AssiduiteHeader/AssiduiteHeader';
import AssiduiteToolbar  from './sections/AssiduiteToolbar/AssiduiteToolbar';
import AssiduiteTable    from './sections/AssiduiteTable/AssiduiteTable';
import EditAssiduiteModal from './components/EditAssiduiteModal/EditAssiduiteModal';
import HistoriqueAssiduiteModal from './components/HistoriqueAssiduiteModal/HistoriqueAssiduiteModal';
import AssiduiteCalendarModal from './components/AssiduiteCalendarModal/AssiduiteCalendarModal';
import { useToast } from '../../Shared/Contexts/ToastContext';
import Loader from '../../Shared/UI/Loader/Loader';
// #endregion

const ITEMS_PER_PAGE = 20;

// Normalisation accent-insensible
function normalize(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// #region COMPOSANT
export default function Assiduite() {
  const {
    agents,
    loading,
    selectedMois,
    setSelectedMois,
    saveAssiduite,
    syncAssiduite,
  } = useAssiduite();

  const addToast = useToast();

  const [search,       setSearch]      = useState('');
  const [currentPage,  setCurrentPage] = useState(1);
  const [editingAgent,    setEditingAgent]    = useState(null);
  const [historiqueAgent, setHistoriqueAgent] = useState(null);
  const [isSyncing,       setIsSyncing]       = useState(false);
  const [calendarState,   setCalendarState]   = useState(null); // { agent, focus }

  // Filtrage par recherche textuelle
  const filtered = useMemo(() => {
    if (!search) return agents;
    const q = normalize(search);
    return agents.filter(a =>
      [a.matricule, a.nom, a.prenom, a.projet]
        .some(v => normalize(v).includes(q))
    );
  }, [agents, search]);

  // Pagination
  const totalPages      = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const start           = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedAgents = filtered.slice(start, start + ITEMS_PER_PAGE);

  // Retour page 1 lors d'un changement de filtre ou de mois
  useEffect(() => { setCurrentPage(1); }, [search, selectedMois]);

  const handleEdit = (agent) => setEditingAgent(agent);

  const handleSave = async (matricule, formData) => {
    await saveAssiduite(matricule, formData);
    addToast?.('Assiduité mise à jour avec succès', 'success');
    setEditingAgent(null);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncAssiduite();
      const { updated, skipped_overridden, skipped_no_data, errors } = result.stats || {};
      const msg = `Synchronisation terminée — ${updated} mis à jour, ${skipped_overridden} protégés, ${skipped_no_data} sans données${errors?.length ? `, ${errors.length} erreur(s)` : ''}.`;
      addToast?.(msg, errors?.length ? 'warning' : 'success');
    } catch (err) {
      addToast?.(err.message || 'Erreur lors de la synchronisation', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="assid-page">

      {/* En-tête */}
      <AssiduiteHeader total={agents.length} mois={selectedMois} />

      {/* Barre de filtres */}
      <AssiduiteToolbar
        selectedMois={selectedMois}
        onMoisChange={setSelectedMois}
        search={search}
        onSearchChange={v => { setSearch(v); }}
        total={agents.length}
        filtered={filtered.length}
        onSync={handleSync}
        isSyncing={isSyncing}
      />

      {/* Contenu */}
      {loading
        ? <div className="assid-page__loader"><Loader /></div>
        : (
          <>
            <AssiduiteTable
              agents={paginatedAgents}
              onEdit={handleEdit}
              onHistory={a => setHistoriqueAgent(a)}
              onCalendar={(agent, focus) => setCalendarState({ agent, focus })}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="assid-pagination">
                <button
                  className="assid-page-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  <i className="fa-solid fa-chevron-left" /> Précédent
                </button>
                <span className="assid-page-info">
                  Page {currentPage} sur {totalPages}
                  &nbsp;<span className="assid-page-info__sub">({filtered.length} résultats)</span>
                </span>
                <button
                  className="assid-page-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  Suivant <i className="fa-solid fa-chevron-right" />
                </button>
              </div>
            )}
          </>
        )
      }

      {/* Modal édition */}
      <EditAssiduiteModal
        isOpen={!!editingAgent}
        onClose={() => setEditingAgent(null)}
        agent={editingAgent}
        selectedMois={selectedMois}
        onSave={handleSave}
      />

      {/* Modal historique */}
      <HistoriqueAssiduiteModal
        isOpen={!!historiqueAgent}
        onClose={() => setHistoriqueAgent(null)}
        agent={historiqueAgent}
        selectedMois={selectedMois}
      />

      {/* Modal calendrier journalier */}
      <AssiduiteCalendarModal
        isOpen={!!calendarState}
        onClose={() => setCalendarState(null)}
        agent={calendarState?.agent}
        selectedMois={selectedMois}
        focus={calendarState?.focus}
      />

    </div>
  );
}
// #endregion
