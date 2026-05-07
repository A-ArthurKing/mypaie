import React, { useState, useEffect, useCallback, useRef } from 'react';
import './GestionStructure.css';
import { useSocket } from '../../Shared/Contexts/SocketContext';
import HeaderSection from './sections/HeaderSection/HeaderSection';
import StructureExplorer from './sections/StructureExplorer/StructureExplorer';
import LibraryTab from './tabs/LibraryTab/LibraryTab';
import MappingProjets from '../Parametres/Onglets/MappingProjets/MappingProjets';

export default function GestionStructure() {
  const [refs, setRefs] = useState({ projets: [], operations: [], files: [], activites: [], structure: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('cartographie');
  const socket = useSocket();
  const isFirstLoad = useRef(true);

  const fetchRefs = useCallback(async () => {
    if (isFirstLoad.current) setLoading(true);
    try {
      const res = await fetch('/api/parametres/references');
      const data = await res.json();
      setRefs(data);
    } catch (e) {
      console.error('Erreur chargement structure', e);
    } finally {
      setLoading(false);
      isFirstLoad.current = false;
    }
  }, []);

  useEffect(() => { fetchRefs(); }, [fetchRefs]);

  useEffect(() => {
    if (!socket) return;
    socket.on('structure_updated', fetchRefs);
    return () => socket.off('structure_updated');
  }, [socket, fetchRefs]);

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
          <StructureExplorer refs={refs} onRefresh={fetchRefs} />
        ) : activeTab === 'referentiels' ? (
          <LibraryTab refs={refs} onRefresh={fetchRefs} />
        ) : (
          <MappingProjets />
        )}
      </div>
    </div>
  );
}
