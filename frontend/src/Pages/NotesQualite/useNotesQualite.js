/*
 * Fichier : useNotesQualite.js
 * Rôle    : Hook personnalisé pour gérer la récupération des données Qualité (Eval Plus).
 * Module  : mypaie / Pages / NotesQualite
 */

import { useState, useEffect, useCallback } from "react";
import { readCache, writeCache, TTL } from "../../Shared/Utils/cacheStorage";

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
      const d0 = filtres.dateDebut
        ? filtres.dateDebut.toISOString().split("T")[0]
        : "";
      const d1 = filtres.dateFin
        ? filtres.dateFin.toISOString().split("T")[0]
        : "";
      if (d0) params.append("date_debut", d0 + " 00:00:00");
      if (d1) params.append("date_fin", d1 + " 23:59:59");

      const cacheKey = `qualite:grid:${d0}:${d1}`;
      const cached = readCache(cacheKey);
      if (cached && !cached.isStale) {
        setProjetsStats(cached.data.projets || []);
        setStatsGlobal(cached.data.global || null);
        setLoading(false);
        return;
      }

      // Charger les stats par projet (pour les jauges)
      const resProjets = await fetch(
        `${API_BASE}/qualite/projets?${params.toString()}`,
      );
      const resultProjets = await resProjets.json();

      // Charger les stats globales (typologies)
      const resGlobal = await fetch(
        `${API_BASE}/qualite/stats/global?${params.toString()}`,
      );
      const resultGlobal = await resGlobal.json();

      const projets = resultProjets.data || [];
      const global = resultGlobal;

      writeCache(cacheKey, { projets, global }, TTL.STATS);
      setProjetsStats(projets);
      setStatsGlobal(global);
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
        const d0 = filtres.dateDebut
          ? filtres.dateDebut.toISOString().split("T")[0]
          : "";
        const d1 = filtres.dateFin
          ? filtres.dateFin.toISOString().split("T")[0]
          : "";
        if (d0) params.append("date_debut", d0 + " 00:00:00");
        if (d1) params.append("date_fin", d1 + " 23:59:59");
        params.append("projet", projetId);
        params.append("limit", 5000);

        const cacheKey = `qualite:detail:${projetId}:${d0}:${d1}`;
        const cached = readCache(cacheKey);
        if (cached && !cached.isStale) {
          setLignes(cached.data.lignes || []);
          setTotal(cached.data.total || 0);
          setLoading(false);
          return;
        }

        const res = await fetch(`${API_BASE}/qualite?${params.toString()}`);
        const result = await res.json();
        const lignesData = result.data || [];
        const totalData = result.total || 0;

        writeCache(
          cacheKey,
          { lignes: lignesData, total: totalData },
          TTL.STATS,
        );
        setLignes(lignesData);
        setTotal(totalData);
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
