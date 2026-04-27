/*
 * Fichier : useApiSWR.js
 * Rôle    : Hook Stale-While-Revalidate maison — affiche le cache instantanément
 *           puis revalide en arrière-plan. Déduplique les requêtes en vol et
 *           revalide au retour sur l'onglet (visibilitychange).
 * Module  : mypaie / Shared / Hooks
 */

// #region IMPORTS
import { useState, useEffect, useRef, useCallback } from "react";
import { readCache, writeCache, TTL } from "../Utils/cacheStorage";
// #endregion

// #region DEDUPLICATION GLOBALE
// Évite les appels concurrents sur la même clé (remount, double useEffect en StrictMode)
const inFlight = new Map();

function dedupedFetch(key, fetcher) {
  if (inFlight.has(key)) return inFlight.get(key);
  const promise = Promise.resolve()
    .then(() => fetcher())
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, promise);
  return promise;
}
// #endregion

// #region HOOK
/**
 * @param {string|null} key       Clé de cache unique (null = désactive le hook)
 * @param {Function}    fetcher   Fonction async retournant les données
 * @param {object}      options   { ttl, revalidateOnFocus, revalidateOnMount, fallbackData }
 */
export default function useApiSWR(key, fetcher, options = {}) {
  const {
    ttl = TTL.STATS,
    revalidateOnFocus = true,
    revalidateOnMount = true,
    fallbackData = null,
  } = options;

  // État initial : on lit le cache de façon synchrone pour un rendu instantané
  const initialCache = key ? readCache(key) : null;

  const [data, setData] = useState(initialCache?.data ?? fallbackData);
  const [error, setError] = useState(null);
  // loading = vrai uniquement si on n'a aucune donnée à afficher
  const [loading, setLoading] = useState(key ? !initialCache : false);
  // isValidating = vrai pendant un refresh en arrière-plan (UI non bloquée)
  const [isValidating, setIsValidating] = useState(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Revalidation manuelle ou auto
  const revalidate = useCallback(async () => {
    if (!key) return;
    setIsValidating(true);
    setError(null);
    try {
      const fresh = await dedupedFetch(key, () => fetcherRef.current());
      setData(fresh);
      writeCache(key, fresh, ttl);
    } catch (err) {
      setError(err);
      // On garde la donnée stale affichée — pas de blocage UI
    } finally {
      setLoading(false);
      setIsValidating(false);
    }
  }, [key, ttl]);

  // Revalidation au montage / changement de clé
  useEffect(() => {
    if (!key || !revalidateOnMount) return;
    // Si cache présent et frais : pas besoin de revalider
    const cached = readCache(key);
    if (cached && !cached.isStale) {
      setData(cached.data);
      setLoading(false);
      return;
    }
    revalidate();
  }, [key, revalidateOnMount, revalidate]);

  // Revalidation au retour sur l'onglet (utilisateur revient après pause)
  useEffect(() => {
    if (!key || !revalidateOnFocus) return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        const cached = readCache(key);
        // On revalide seulement si le cache est devenu stale
        if (!cached || cached.isStale) revalidate();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [key, revalidateOnFocus, revalidate]);

  return { data, error, loading, isValidating, revalidate, mutate: setData };
}
// #endregion

// #region UTILITAIRE STANDALONE — prefetch (App boot)
// Préchauffe le cache pour une clé donnée, sans React. Utilisé au démarrage de l'app.
export async function prefetchSWR(key, fetcher, ttl = TTL.STATS) {
  if (!key) return;
  const cached = readCache(key);
  if (cached && !cached.isStale) return cached.data;
  try {
    const fresh = await dedupedFetch(key, fetcher);
    writeCache(key, fresh, ttl);
    return fresh;
  } catch {
    return cached?.data ?? null;
  }
}
// #endregion
