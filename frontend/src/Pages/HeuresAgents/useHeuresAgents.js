/*
 * Fichier : useHeuresAgents.js
 * Rôle    : Hook personnalisé — gère les appels API Flask pour les heures agents
 *           et les équipes distinctes. Expose état de chargement, erreur et données.
 * Module  : mypaie / Pages / HeuresAgents
 */

// #region IMPORTS
import { useState, useCallback, useEffect } from "react";
// #endregion

// #region CONSTANTES
const API_BASE = "/api";
const LIMIT_PAR_PAGE = 1000;
// #endregion

// #region HELPERS DATE
// Retourne le premier jour du mois courant au format YYYY-MM-DD
function premierJourDuMois() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// Retourne le dernier jour du mois courant au format YYYY-MM-DD
function dernierJourDuMois() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}
// #endregion

// #region HOOK
function useHeuresAgents() {
  // #region STATE
  const [lignes, setLignes] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [equipes, setEquipes] = useState([]);
  const [projets, setProjets] = useState([]);

  // Filtres initialisés sur le mois courant par défaut
  const [filtres, setFiltres] = useState({
    dateDebut: premierJourDuMois(),
    dateFin: dernierJourDuMois(),
    matricule: "",
    equipe: "",
    projet: "",
  });
  // #endregion

  // #region CHARGEMENT METADONNEES (Equipes, Projets)
  // Chargement des listes de référence au montage
  useEffect(() => {
    // Equipes
    fetch(`${API_BASE}/heures/equipes`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((body) => setEquipes(body.data ?? []))
      .catch((err) => console.error("Erreur chargement équipes :", err));

    // Projets
    fetch(`${API_BASE}/heures/projets`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((body) => setProjets(body.data ?? []))
      .catch((err) => console.error("Erreur chargement projets :", err));
  }, []);
  // #endregion

  // #region AUTO-LOAD MOIS COURANT
  // Déclenchement automatique du chargement au montage avec les filtres du mois courant
  useEffect(() => {
    chargerHeures(
      {
        dateDebut: premierJourDuMois(),
        dateFin: dernierJourDuMois(),
        matricule: "",
        equipe: "",
        projet: "",
      },
      0,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // #endregion

  // #region CHARGEMENT DONNEES
  // Requête paginée avec les filtres actifs dès qu'un critère ou l'offset change
  const chargerHeures = useCallback(async (filtresActifs, newOffset = 0) => {
    setLoading(true);
    setErreur(null);

    // Construction des paramètres de requête en excluant les valeurs vides
    const params = new URLSearchParams();
    if (filtresActifs.dateDebut)
      params.set("date_debut", filtresActifs.dateDebut);
    if (filtresActifs.dateFin) params.set("date_fin", filtresActifs.dateFin);
    if (filtresActifs.matricule)
      params.set("matricule", filtresActifs.matricule);
    if (filtresActifs.equipe) params.set("equipe", filtresActifs.equipe);
    if (filtresActifs.projet) params.set("projet", filtresActifs.projet);
    params.set("limit", String(LIMIT_PAR_PAGE));
    params.set("offset", String(newOffset));

    try {
      const response = await fetch(`${API_BASE}/heures?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Erreur ${response.status} : ${response.statusText}`);
      }

      const body = await response.json();
      setLignes(body.data ?? []);
      setTotal(body.total ?? 0);
      setOffset(newOffset);
    } catch (err) {
      setErreur(
        "Impossible de récupérer les données. Vérifiez que le serveur Flask est actif.",
      );
      console.error("Erreur useHeuresAgents :", err);
    } finally {
      setLoading(false);
    }
  }, []);
  // #endregion

  // #region ACTIONS EXPOSEES
  // Application de nouveaux filtres — réinitialise l'offset à 0
  function appliquerFiltres(nouveauxFiltres) {
    setFiltres(nouveauxFiltres);
    chargerHeures(nouveauxFiltres, 0);
  }

  // Changement de page en conservant les filtres actifs
  function changerPage(newOffset) {
    setOffset(newOffset);
    chargerHeures(filtres, newOffset);
  }
  // #endregion

  return {
    lignes,
    total,
    offset,
    limit: LIMIT_PAR_PAGE,
    loading,
    erreur,
    equipes,
    projets,
    filtresDefaut: filtres,
    appliquerFiltres,
    changerPage,
  };
}
// #endregion

export default useHeuresAgents;
