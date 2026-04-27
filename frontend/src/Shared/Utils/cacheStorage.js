/*
 * Fichier : cacheStorage.js
 * Rôle    : Cache persistant LocalStorage avec TTL — couche bas-niveau utilisée
 *           par le hook SWR et les prefetchs. Sérialisation JSON, gestion des
 *           expirations et des erreurs (quota, parse) silencieuse.
 * Module  : mypaie / Shared / Utils
 */

// #region CONSTANTES
const PREFIX = "mypaie:cache:";
const VERSION = "v1";

// TTLs par défaut (millisecondes)
export const TTL = {
  DROPDOWNS: 24 * 60 * 60 * 1000, // 24h — listes statiques (équipes, projets)
  STATS: 5 * 60 * 1000, // 5min — stats agrégées
  HEAVY: 60 * 1000, // 1min — listes lourdes paginées
  SHORT: 30 * 1000, // 30s — données très volatiles
};
// #endregion

// #region HELPERS INTERNES
// Construit la clé namespacée stockée en LocalStorage
function buildKey(key) {
  return `${PREFIX}${VERSION}:${key}`;
}
// #endregion

// #region API PUBLIQUE
// Lit une entrée du cache. Retourne { data, isStale } ou null si absente.
export function readCache(key) {
  try {
    const raw = localStorage.getItem(buildKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const now = Date.now();
    const isStale = !parsed.expiresAt || now > parsed.expiresAt;
    return { data: parsed.data, isStale, storedAt: parsed.storedAt };
  } catch {
    return null;
  }
}

// Écrit une entrée dans le cache avec un TTL donné
export function writeCache(key, data, ttlMs = TTL.STATS) {
  try {
    const payload = {
      data,
      storedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    };
    localStorage.setItem(buildKey(key), JSON.stringify(payload));
  } catch {
    // Ignore quota / serialization errors — la revalidation réseau prendra le relais
  }
}

// Supprime une entrée
export function clearCacheKey(key) {
  try {
    localStorage.removeItem(buildKey(key));
  } catch {
    /* noop */
  }
}

// Purge tout le cache mypaie (utile pour debug / logout)
export function clearAllCache() {
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* noop */
  }
}
// #endregion
