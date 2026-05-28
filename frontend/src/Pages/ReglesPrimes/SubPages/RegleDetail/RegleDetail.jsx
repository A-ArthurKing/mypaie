/*
 * Fichier : RegleDetail.jsx
 * Rôle    : Page de détail d'une règle de prime — décomposée en onglets.
 * Module  : mypaie / Pages / ReglesPrimes / SubPages
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import './RegleDetail.css';
import ConfigurationOnglet from './Onglets/ConfigurationOnglet/ConfigurationOnglet'
import AgentsOnglet from './Onglets/TableauDeBordOnglet/TableauDeBordOnglet'
import useApiSWR from '../../../../Shared/Hooks/useApiSWR';
import { fetchRegle } from '../../../../Shared/Utils/apiFetchers';
import { clearCacheKey, TTL } from '../../../../Shared/Utils/cacheStorage';
import AiSidebar from '../../Components/AiSidebar/AiSidebar';
import { useSocket } from '../../../../Shared/Contexts/SocketContext';

const ONGLETS = [
  { id: 'objectifs', label: 'Configuration',       icon: 'fa-solid fa-sliders' },
  { id: 'agents',    label: 'Tableau de bord',     icon: 'fa-solid fa-users' },
];

export default function RegleDetail() {
  const { regleId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const cacheKey = `regle:${regleId}`;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const socket = useSocket();

  const { data: regle, loading, error, revalidate, isValidating } = useApiSWR(
    regleId ? cacheKey : null,
    () => fetchRegle(regleId),
    { ttl: TTL.HEAVY }
  );

  const erreur = error?.message ?? null;

  // ── Temps réel : rafraîchit la règle dès qu'une modification est détectée ──
  useEffect(() => {
    if (!socket || !regleId) return;
    const handleRegleUpdate = (data) => {
      if (data?.regle_id && String(data.regle_id) !== String(regleId)) return;
      // Rafraîchissement silencieux (sans clearCacheKey pour éviter le loader plein écran)
      revalidate();
    };
    socket.on('regle_updated',         handleRegleUpdate);
    socket.on('regle_configs_updated', handleRegleUpdate);
    return () => {
      socket.off('regle_updated',         handleRegleUpdate);
      socket.off('regle_configs_updated', handleRegleUpdate);
    };
  }, [socket, regleId, revalidate]);

  // L'onglet actif est lu depuis l'URL (?tab=...) ou 'objectifs' par défaut
  const ongletActif = searchParams.get('tab') || 'objectifs';

  const setOngletActif = (id) => {
    setSearchParams({ tab: id });
  };

  const handleRefresh = () => {
    clearCacheKey(cacheKey);
    revalidate();
  };

  if (loading) {
    return (
      <div className="regle-detail">
        <div className="regle-detail__loading">
          <i className="fa-solid fa-spinner fa-spin"></i> Chargement…
        </div>
      </div>
    );
  }

  if (erreur || !regle) {
    return (
      <div className="regle-detail">
        <button className="regle-detail__retour" onClick={() => navigate('/regles-primes')}>
          <i className="fa-solid fa-arrow-left"></i> Retour aux règles
        </button>
        <div className="regle-detail__error">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <p>{erreur || 'Règle introuvable.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="regle-detail-layout" style={{ display: 'flex', position: 'relative', paddingRight: isSidebarOpen ? '300px' : '0', transition: 'padding-right 0.25s ease' }}>
      <div className="regle-detail" style={{ flex: 1, minWidth: 0 }}>
        <button className="regle-detail__retour" onClick={() => navigate('/regles-primes')}>
          <i className="fa-solid fa-arrow-left"></i> Retour aux règles
        </button>

        {/* ── Header ── */}
        <header className="regle-detail__header">
          <div className="regle-detail__header-left">
            <span className="regle-detail__projet">
              {regle.projet || '—'}
              {isValidating && <i className="fa-solid fa-rotate fa-spin regle-detail__sync-icon"></i>}
            </span>
            <h1 className="regle-detail__nom">{regle.nom}</h1>
            <span className="regle-detail__code">{regle.code}</span>
          </div>
          <span className={`regle-detail__badge regle-detail__badge--${regle.actif ? 'actif' : 'inactif'}`}>
            {regle.actif ? 'Actif' : 'Inactif'}
          </span>
        </header>

        {/* ── Onglets ── */}
        <nav className="regle-detail__tabs">
          {ONGLETS.map((o) => (
            <button
              key={o.id}
              className={`regle-detail__tab ${ongletActif === o.id ? 'regle-detail__tab--active' : ''}`}
              onClick={() => setOngletActif(o.id)}
            >
              <i className={o.icon}></i> {o.label}
            </button>
          ))}
        </nav>

        {/* ── Contenu de l'onglet actif ── */}
        <div className="regle-detail__tab-content">
          {ongletActif === 'objectifs' && <ConfigurationOnglet regle={regle} onRefresh={handleRefresh} />}
          {ongletActif === 'agents'    && <AgentsOnglet   regle={regle} onRefresh={handleRefresh} />}
        </div>
      </div>
      
      {!isSidebarOpen && (
        <button className="ai-sidebar-toggle" onClick={() => setIsSidebarOpen(true)}>
          <i className="fa-solid fa-robot"></i> Assistant IA
        </button>
      )}
      
      <AiSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} regleId={regleId} onRefresh={handleRefresh} />
    </div>
  );
}
