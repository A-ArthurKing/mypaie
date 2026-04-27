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

export default function ReglesPrimes() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [regles, setRegles] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const handleCreated = () => {
    setIsModalOpen(false);
    fetchRegles();
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
          />
          {isModalOpen && (
            <CreateRegleModal onClose={() => setIsModalOpen(false)} onCreated={handleCreated} />
          )}
        </div>
      } />
      <Route path=":regleId" element={<RegleDetail />} />
    </Routes>
  );
}
