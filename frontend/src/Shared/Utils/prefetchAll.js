/*
 * Fichier : prefetchAll.js
 * Rôle    : Préchauffe le cache LocalStorage au démarrage de l'application.
 *           Les dropdowns (équipes, projets) et les stats du mois courant
 *           seront déjà disponibles à l'ouverture des pages.
 * Module  : mypaie / Shared / Utils
 */

// #region IMPORTS
import { prefetchSWR } from "../Hooks/useApiSWR";
import { TTL } from "./cacheStorage";
import {
  fetchEquipes,
  fetchProjetsHeures,
  fetchProjetsQualite,
  fetchStatsGlobalQualite,
  fetchPerformancePvcp,
  formatDateStart,
  formatDateEnd,
  formatDateOnly,
} from "./apiFetchers";
// #endregion

// #region HELPERS
function moisCourantRange() {
  const d = new Date();
  const debut = new Date(d.getFullYear(), d.getMonth(), 1);
  const fin = new Date();
  return { debut, fin };
}
// #endregion

// #region BOOT
// Précharge tout en parallèle, sans bloquer l'UI ni propager d'erreurs
export function prefetchAll() {
  const { debut, fin } = moisCourantRange();
  const d1 = formatDateOnly(debut);
  const d2 = formatDateOnly(fin);
  const dateRangeKey = `${d1}_${d2}`;

  const tasks = [
    prefetchSWR("heures:equipes", fetchEquipes, TTL.DROPDOWNS),
    prefetchSWR("heures:projets", fetchProjetsHeures, TTL.DROPDOWNS),
    prefetchSWR(
      `qualite:projets:${dateRangeKey}`,
      () => fetchProjetsQualite(formatDateStart(debut), formatDateEnd(fin)),
      TTL.STATS,
    ),
    prefetchSWR(
      `qualite:global:${dateRangeKey}`,
      () => fetchStatsGlobalQualite(formatDateStart(debut), formatDateEnd(fin)),
      TTL.STATS,
    ),
    prefetchSWR(
      `perf:pvcp:${dateRangeKey}::0`,
      () => fetchPerformancePvcp({ dateDebut: debut, dateFin: fin }, 500, 0),
      TTL.STATS,
    ),
  ];

  // Fire & forget — aucune erreur ne remonte
  Promise.allSettled(tasks);
}
// #endregion
