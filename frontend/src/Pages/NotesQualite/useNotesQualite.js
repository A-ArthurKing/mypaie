/*
 * Fichier : useNotesQualite.js
 * Rôle    : Hook personnalisé pour gérer la récupération des données Qualité (Eval Plus).
 * Module  : mypaie / Pages / NotesQualite
 */

import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:5569/api"; // Via proxy Vite

export default function useNotesQualite() {
  const [lignes, setLignes] = useState([]); // Pour le détail
  const [projetsStats, setProjetsStats] = useState([]); // Pour la grille
  const [statsGlobal, setStatsGlobal] = useState(null); // Pour le résumé global
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState(null);

  // États des filtres
  const [filtres, setFiltres] = useState({
    dateDebut: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    dateFin: new Date(),
    projet: null,
    agent: "",
  });

  const chargerGrid = useCallback(async () => {
    setLoading(true);
    setErreur(null);
    try {
      const params = new URLSearchParams();
      if (filtres.dateDebut)
        params.append(
          "date_debut",
          filtres.dateDebut.toISOString().split("T")[0] + " 00:00:00",
        );
      if (filtres.dateFin)
        params.append(
          "date_fin",
          filtres.dateFin.toISOString().split("T")[0] + " 23:59:59",
        );

      // Charger les stats par projet (pour les jauges)
      const resProjets = await fetch(
        `${API_BASE}/qualite/projets?${params.toString()}`,
      );
      const resultProjets = await resProjets.json();
      setProjetsStats(resultProjets.data || []);

      // Charger les stats globales (typologies)
      const resGlobal = await fetch(
        `${API_BASE}/qualite/stats/global?${params.toString()}`,
      );
      const resultGlobal = await resGlobal.json();
      setStatsGlobal(resultGlobal);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setLoading(false);
    }
  }, [filtres.dateDebut, filtres.dateFin]);

  const chargerDetail = useCallback(
    async (projetId) => {
      setLoading(true);
      setErreur(null);
      try {
        const params = new URLSearchParams();
        if (filtres.dateDebut)
          params.append(
            "date_debut",
            filtres.dateDebut.toISOString().split("T")[0] + " 00:00:00",
          );
        if (filtres.dateFin)
          params.append(
            "date_fin",
            filtres.dateFin.toISOString().split("T")[0] + " 23:59:59",
          );
        params.append("projet", projetId);
        params.append("limit", 5000);

        const res = await fetch(`${API_BASE}/qualite?${params.toString()}`);
        const result = await res.json();
        setLignes(result.data || []);
        setTotal(result.total || 0);
      } catch (err) {
        setErreur(err.message);
      } finally {
        setLoading(false);
      }
    },
    [filtres.dateDebut, filtres.dateFin],
  );

  const appliquerFiltres = (nouveauxFiltres) => {
    setFiltres((prev) => ({ ...prev, ...nouveauxFiltres }));
  };

  return {
    lignes,
    projetsStats,
    statsGlobal,
    total,
    loading,
    erreur,
    filtres,
    appliquerFiltres,
    chargerGrid,
    chargerDetail,
  };
}
