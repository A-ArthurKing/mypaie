/*
 * Fichier : EspaceCollaborateur.jsx
 * Rôle    : Orchestrateur — gère state, fetch et navigation. Délègue l'affichage
 *           aux sections EcHeaderBar, EcProfilCard, EcGrilleContent.
 * Module  : mypaie / Pages / EspaceCollaborateur
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../Shared/Contexts/AuthContext';
import Loader from '../../Shared/UI/Loader/Loader';
import EcHeaderBar from './Sections/EcHeaderBar/EcHeaderBar';
import EcProfilCard from './Sections/EcProfilCard/EcProfilCard';
import EcGrilleContent from './Sections/EcGrilleContent/EcGrilleContent';
import './EspaceCollaborateur.css';

const EspaceCollaborateur = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchGrille = useCallback(async (silent = false) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
      setError(null);
    }
    try {
      const token = localStorage.getItem('mypaie_auth_token');
      const res = await fetch('/api/collaborateur/ma-grille', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur serveur');
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchGrille(false);
  }, [fetchGrille]);

  const handleRefresh = () => fetchGrille(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="ec-page">
      <EcHeaderBar
        user={user}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        onLogout={handleLogout}
      />

      <main className="ec-main">
        {/* ── Profil ── */}
        <EcProfilCard user={user} agent={data?.agent} />

        {/* ── Chargement initial ── */}
        {isLoading && <Loader message="Chargement de votre grille…" />}

        {/* ── Erreur ── */}
        {!isLoading && error && (
          <div className="ec-error">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>{error}</span>
          </div>
        )}

        {/* ── Pas de grille ── */}
        {!isLoading && !error && data && data.regle === null && (
          <div className="ec-empty-state">
            <i className="fa-solid fa-circle-info"></i>
            <p>{data.message || 'Aucune grille de prime active pour votre structure.'}</p>
          </div>
        )}

        {/* ── Contenu grille ── */}
        {!isLoading && !error && data && data.regle && (
          <EcGrilleContent
            regle={data.regle}
            agent={data.agent}
            kpis={data.kpis}
            prime_brute_estimee={data.prime_brute_estimee}
            periode_calcul={data.periode_calcul}
          />
        )}
      </main>
    </div>
  );
};

export default EspaceCollaborateur;
