/*
 * Fichier : GestionStructure.jsx
 * Rôle    : Page principale de gestion de la structure organisationnelle.
 *           Orchestre les 3 onglets : Cartographie, Référentiels et Mapping des projets.
 * Dépend  : SocketContext, sections/Cartographie, tabs/Referentiels, tabs/MappingProjets
 * Module  : mypaie / Pages / GestionStructure
 */
import React, { useState, useEffect } from 'react';
import './GestionStructure.css';
import { useSocket } from '../../Shared/Contexts/SocketContext';
import HeaderSection from './sections/HeaderSection/HeaderSection';
import Cartographie from './sections/Cartographie/Cartographie';
import Referentiels from './tabs/Referentiels/Referentiels';
import MappingProjets from './tabs/MappingProjets/MappingProjets';
import useApiSWR from '../../Shared/Hooks/useApiSWR';
import { TTL } from '../../Shared/Utils/cacheStorage';

const REFS_FALLBACK = { projets: [], operations: [], sous_projets: [], activites: [], structure: [], kpis: {} };

export default function GestionStructure() {
  const {
    data: refs = REFS_FALLBACK,
    loading,
    revalidate,
  } = useApiSWR(
    'parametres:references',
    () => fetch('/api/parametres/references').then(r => r.json()),
    { ttl: TTL.DROPDOWNS, fallbackData: REFS_FALLBACK }
  );

  const [activeTab, setActiveTab] = useState('cartographie');
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;
    socket.on('structure_updated', revalidate);
    return () => socket.off('structure_updated', revalidate);
  }, [socket, revalidate]);

  return (
    <div className="gs-page">
      <HeaderSection />

      <nav className="gs-tabs-nav">
        <button
          className={`gs-tab-btn ${activeTab === 'cartographie' ? 'gs-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('cartographie')}
        >
          <i className="fa-solid fa-sitemap"></i>
          Cartographie des projets
        </button>
        <button
          className={`gs-tab-btn ${activeTab === 'referentiels' ? 'gs-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('referentiels')}
        >
          <i className="fa-solid fa-book-bookmark"></i>
          Référentiels
        </button>
        <button
          className={`gs-tab-btn ${activeTab === 'mapping' ? 'gs-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('mapping')}
        >
          <i className="fa-solid fa-code-merge"></i>
          Mapping des projets
        </button>
      </nav>

      <div className="gs-content">
        {loading ? (
          <div className="gs-loading">
            <i className="fa-solid fa-circle-notch fa-spin"></i>
            Chargement de la structure...
          </div>
        ) : activeTab === 'cartographie' ? (
          <Cartographie refs={refs} onRefresh={revalidate} />
        ) : activeTab === 'referentiels' ? (
          <Referentiels refs={refs} onRefresh={revalidate} />
        ) : (
          <MappingProjets />
        )}
      </div>
    </div>
  );
}
