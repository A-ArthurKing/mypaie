/*
 * Fichier : useAssiduite.js
 * Rôle    : Hook de données pour la page Assiduité — charge la liste des agents
 *           avec leurs données du mois sélectionné, expose les helpers de mutation
 *           et se synchronise en temps réel via SocketIO.
 * Dépend  : useApiSWR, SocketContext, ToastContext
 * Module  : mypaie / Pages / Assiduite
 */

// #region IMPORTS
import { useState, useCallback, useEffect } from 'react';
import useApiSWR from '../../Shared/Hooks/useApiSWR';
import { useSocket } from '../../Shared/Contexts/SocketContext';
import { TTL } from '../../Shared/Utils/cacheStorage';
// #endregion

// #region HOOK

/**
 * Gère les données d'assiduité pour un mois donné.
 * Retourne la liste des agents, les helpers de mise à jour et les états de chargement.
 */
export default function useAssiduite() {

  // Mois sélectionné — format YYYY-MM, initialisé au mois courant
  const [selectedMois, setSelectedMois] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const cacheKey = `assiduite:${selectedMois}`;

  const {
    data: agents = [],
    loading,
    revalidate,
    mutate,
  } = useApiSWR(
    cacheKey,
    () => fetch(`/api/assiduite?mois=${selectedMois}`)
          .then(r => r.json())
          .then(d => d.data || []),
    { ttl: TTL.STATS, fallbackData: [] }
  );

  const socket = useSocket();

  // Synchronisation temps réel — recharge quand assiduite_updated ou agent_created
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => revalidate();
    socket.on('assiduite_updated', handleUpdate);
    socket.on('agent_created',     handleUpdate);
    socket.on('agent_deleted',     handleUpdate);
    return () => {
      socket.off('assiduite_updated', handleUpdate);
      socket.off('agent_created',     handleUpdate);
      socket.off('agent_deleted',     handleUpdate);
    };
  }, [socket, revalidate]);

  /**
   * Sauvegarde les données d'assiduité d'un agent via PUT /api/assiduite/:matricule.
   * Mise à jour optimiste côté client avant la réponse du serveur.
   */
  const saveAssiduite = useCallback(async (matricule, formData) => {
    const payload = { mois: selectedMois, ...formData };

    // Mise à jour optimiste
    mutate(prev => prev.map(a =>
      a.matricule === matricule ? { ...a, ...formData } : a
    ));

    const token = localStorage.getItem('mypaie_auth_token') || '';
    const res = await fetch(`/api/assiduite/${encodeURIComponent(matricule)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // En cas d'échec, réatteindre le serveur pour restaurer l'état réel
      revalidate();
      const err = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
      throw new Error(err.error || 'Erreur lors de la sauvegarde');
    }

    return res.json();
  }, [selectedMois, mutate, revalidate]);

  return {
    agents,
    loading,
    selectedMois,
    setSelectedMois,
    saveAssiduite,
    revalidate,
  };
}
// #endregion
