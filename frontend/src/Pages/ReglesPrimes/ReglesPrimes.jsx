/*
 * Fichier : ReglesPrimes.jsx
 * Rôle    : Page principale du générateur de règles de primes.
 *           Orchestration de l'état + routage. Le rendu est délégué aux sections.
 * Module  : mypaie / Pages / ReglesPrimes
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import './ReglesPrimes.css';
import HeaderSection from './Sections/HeaderSection/HeaderSection';
import ReglesGridSection from './Sections/ReglesGridSection/ReglesGridSection';
import CreateRegleModal from './Components/CreateRegleModal/CreateRegleModal';
import RegleDetail from './SubPages/RegleDetail/RegleDetail';
import ConfirmationModal from '../../Components/ConfirmationModal/ConfirmationModal';
import { useSocket } from '../../Shared/Contexts/SocketContext';
import { useToast } from '../../Shared/Contexts/ToastContext';
import useApiSWR from '../../Shared/Hooks/useApiSWR';
import { fetchRegles } from '../../Shared/Utils/apiFetchers';
import { clearCacheKey, TTL } from '../../Shared/Utils/cacheStorage';

export default function ReglesPrimes() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [duplicateTarget, setDuplicateTarget] = useState(null);
  const navigate = useNavigate();
  const socket = useSocket();
  const addToast = useToast();

  const CACHE_KEY = 'regles:list';

  const { data: regles = [], loading, revalidate } = useApiSWR(
    CACHE_KEY,
    fetchRegles,
    { ttl: TTL.HEAVY }
  );

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      console.log('[RealTime] Mise à jour des règles détectée');
      clearCacheKey(CACHE_KEY);
      revalidate();
    };

    socket.on('regle_created', handleUpdate);
    socket.on('regle_updated', handleUpdate);
    socket.on('regle_deleted', handleUpdate);

    return () => {
      socket.off('regle_created', handleUpdate);
      socket.off('regle_updated', handleUpdate);
      socket.off('regle_deleted', handleUpdate);
    };
  }, [socket, revalidate]);

  const invalidateAndRefresh = useCallback(() => {
    clearCacheKey(CACHE_KEY);
    revalidate();
  }, [revalidate]);

  const handleSaveSuccess = () => {
    setIsModalOpen(false);
    setEditTarget(null);
    setDuplicateTarget(null);
    invalidateAndRefresh();
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditTarget(null);
    setDuplicateTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/regles/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erreur lors de la suppression');
      setDeleteTarget(null);
      invalidateAndRefresh();
      addToast('Règle supprimée avec succès', 'success');
    } catch (err) {
      setDeleteTarget(null);
      addToast(err.message || 'Erreur lors de la suppression', 'error');
    }
  };

  return (
    <Routes>
      <Route index element={
        <div className="regles-primes">
          <HeaderSection onCreateClick={() => setIsModalOpen(true)} />
          <ReglesGridSection
            regles={regles}
            loading={loading}
            onCardClick={(id) => navigate(`/regles-primes/${id}`)}
            onEdit={(id) => {
              const regle = regles.find(r => r.id === id);
              setEditTarget(regle);
              setIsModalOpen(true);
            }}
            onDuplicate={async (id) => {
              try {
                const regle = regles.find(r => r.id === id);
                setDuplicateTarget(regle || await fetch(`/api/regles/${id}`).then(r => r.json()));
                setIsModalOpen(true);
              } catch (e) {
                console.error("Erreur chargement règle à dupliquer", e);
              }
            }}
            onDelete={(regle) => setDeleteTarget(regle)}
          />
          {isModalOpen && (
            <CreateRegleModal 
              onClose={handleCloseModal} 
              onCreated={handleSaveSuccess} 
              regleToEdit={editTarget}
              regleToDuplicate={duplicateTarget}
            />
          )}
          <ConfirmationModal
            isOpen={!!deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleDelete}
            title="Supprimer la règle"
            message={`Voulez-vous vraiment supprimer la règle "${deleteTarget?.nom}" ? Cette action est irréversible.`}
            confirmText="Supprimer"
          />
        </div>
      } />
      <Route path=":regleId" element={<RegleDetail />} />
    </Routes>
  );
}
