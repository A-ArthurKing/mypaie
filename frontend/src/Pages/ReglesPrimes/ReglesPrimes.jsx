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

export default function ReglesPrimes() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [regles, setRegles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const navigate = useNavigate();

  const fetchRegles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/regles');
      if (!res.ok) throw new Error('Erreur API');
      const data = await res.json();
      setRegles(data);
    } catch (e) {
      setRegles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegles();
  }, [fetchRegles]);

  const handleSaveSuccess = () => {
    setIsModalOpen(false);
    setEditTarget(null);
    fetchRegles();
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/regles/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      fetchRegles();
    } catch {
      setDeleteTarget(null);
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
            onDelete={(regle) => setDeleteTarget(regle)}
          />
          {isModalOpen && (
            <CreateRegleModal 
              onClose={handleCloseModal} 
              onCreated={handleSaveSuccess} 
              regleToEdit={editTarget}
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
