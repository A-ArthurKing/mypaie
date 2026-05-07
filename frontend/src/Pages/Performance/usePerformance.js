/*
 * Fichier : usePerformance.js
 * Rôle    : Hook Performance — version Stale-While-Revalidate.
 *           Gère les données de performance PVCP avec extraction JSON.
 * Module  : mypaie / Pages / Performance
 */

import { useState, useMemo } from "react";
import useApiSWR from "../../Shared/Hooks/useApiSWR";
import { TTL } from "../../Shared/Utils/cacheStorage";
import {
  fetchPerformancePvcp,
  formatDateOnly,
} from "../../Shared/Utils/apiFetchers";

export default function usePerformance() {
  const [filtres, setFiltres] = useState({
    dateDebut: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
    dateFin: new Date(),
    agent: "",
    granularity: "total", // total, month, week
  });
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const perfKey = useMemo(() => {
    const d1 = formatDateOnly(filtres.dateDebut);
    const d2 = formatDateOnly(filtres.dateFin);
    return `perf:pvcp:${d1}_${d2}:${filtres.agent}:${filtres.granularity}:${offset}:${LIMIT}`;
  }, [filtres, offset]);

  const perfSWR = useApiSWR(
    perfKey,
    () => fetchPerformancePvcp(filtres, LIMIT, offset),
    { ttl: TTL.STATS, fallbackData: { data: [], total: 0 } },
  );

  const appliquerFiltres = (nouveauxFiltres) => {
    setFiltres((prev) => ({ ...prev, ...nouveauxFiltres }));
    setOffset(0);
  };

  return {
    lignes: perfSWR.data?.data ?? [],
    total: perfSWR.data?.total ?? 0,
    loading: perfSWR.loading,
    refreshing: perfSWR.isValidating,
    erreur: perfSWR.error,
    filtres,
    appliquerFiltres,
    setOffset,
    offset,
    limit: LIMIT,
  };
}
