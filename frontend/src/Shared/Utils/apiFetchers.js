/*
 * Fichier : apiFetchers.js
 * Rôle    : Fonctions de fetch centralisées vers le backend Flask. Utilisées
 *           par useApiSWR. Construisent les URLs et gèrent les erreurs HTTP.
 * Module  : mypaie / Shared / Utils
 */

// #region CONSTANTES
const API_BASE = "/api";
// #endregion

// #region HELPERS
// Convertit un objet de paramètres en query string (ignore null/undefined/empty)
function toQuery(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== "") sp.set(k, String(v));
  });
  return sp.toString();
}

// Wrapper fetch JSON avec gestion d'erreur et token JWT
async function fetchJson(url, options = {}) {
  const token = localStorage.getItem('mypaie_auth_token');
  const headers = {
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const r = await fetch(url, { ...options, headers });
  if (!r.ok) {
    if (r.status === 401) {
      // Déconnexion forcée si token invalide/expiré
      localStorage.removeItem('mypaie_auth_token');
      window.location.href = '/login';
    }
    throw new Error(`HTTP ${r.status} ${r.statusText}`);
  }
  return r.json();
}
// #endregion

// #region FETCHERS — HEURES
export async function fetchEquipes() {
  const body = await fetchJson(`${API_BASE}/heures/equipes`);
  return body.data ?? [];
}

export async function fetchProjetsHeures() {
  const body = await fetchJson(`${API_BASE}/heures/projets`);
  return body.data ?? [];
}

export async function fetchHeures(filtres, limit, offset) {
  const qs = toQuery({
    date_debut: filtres.dateDebut,
    date_fin: filtres.dateFin,
    matricule: filtres.matricule,
    equipe: filtres.equipe,
    projet: filtres.projet,
    limit,
    offset,
  });
  const body = await fetchJson(`${API_BASE}/heures?${qs}`);
  return { data: body.data ?? [], total: body.total ?? 0 };
}
// #endregion

// #region FETCHERS — QUALITE
export async function fetchProjetsQualite(dateDebut, dateFin) {
  const qs = toQuery({ date_debut: dateDebut, date_fin: dateFin });
  const body = await fetchJson(`${API_BASE}/qualite/projets?${qs}`);
  return body.data ?? [];
}

export async function fetchStatsGlobalQualite(dateDebut, dateFin) {
  const qs = toQuery({ date_debut: dateDebut, date_fin: dateFin });
  return fetchJson(`${API_BASE}/qualite/stats/global?${qs}`);
}

export async function fetchDetailQualite(
  dateDebut,
  dateFin,
  projetId,
  limit = 5000,
) {
  const qs = toQuery({
    date_debut: dateDebut,
    date_fin: dateFin,
    projet: projetId,
    limit,
  });
  const body = await fetchJson(`${API_BASE}/qualite?${qs}`);
  return { data: body.data ?? [], total: body.total ?? 0 };
}
// #endregion
// #region FETCHERS — PERFORMANCE (PVCP)
export async function fetchPerformancePvcp(filtres, limit = 20, offset = 0) {
  const qs = toQuery({
    date_debut: formatDateOnly(filtres.dateDebut),
    date_fin: formatDateOnly(filtres.dateFin),
    agent: filtres.agent,
    granularity: filtres.granularity || "total",
    limit,
    offset,
  });
  const body = await fetchJson(`${API_BASE}/performance/pvcp?${qs}`);
  return { data: body.data ?? [], total: body.total ?? 0 };
}
// #endregion
// #region FETCHERS — RÈGLES DE PRIMES
export async function fetchRegles() {
  return fetchJson(`${API_BASE}/regles`);
}

export async function fetchRegle(id) {
  return fetchJson(`${API_BASE}/regles/${id}`);
}

export async function fetchRegleConfigs(regleId) {
  const body = await fetchJson(`${API_BASE}/regles/${regleId}/configs`);
  return body.data ?? [];
}
// #endregion

// #region HELPERS DATE — Format ISO court (YYYY-MM-DD)
export function formatDateOnly(d) {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().split("T")[0];
}

// Format avec heure début/fin de journée pour l'API qualité
export function formatDateStart(d) {
  return `${formatDateOnly(d)} 00:00:00`;
}
export function formatDateEnd(d) {
  return `${formatDateOnly(d)} 23:59:59`;
}
// #endregion
