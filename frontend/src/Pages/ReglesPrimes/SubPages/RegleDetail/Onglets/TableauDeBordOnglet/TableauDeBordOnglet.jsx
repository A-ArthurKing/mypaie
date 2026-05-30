/*
 * Fichier : TableauDeBordOnglet.jsx
 * Rôle    : Onglet "Tableau de bord" — liste les agents SIRH rattachés à la règle
 *           (filtrés par projet/opération) avec recherche et filtre.
 * Module  : mypaie / Pages / ReglesPrimes / SubPages / Onglets
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './TableauDeBordOnglet.css';
import ToolbarSection from './Sections/ToolbarSection/ToolbarSection';
import AgentCard from './Sections/AgentCard/AgentCard';
import KpiInfoModal from '../../../../../../Components/KpiInfoModal/KpiInfoModal';
import { useSocket } from '../../../../../../Shared/Contexts/SocketContext';

// ─── Helpers de Normalisation ────────────────────────────────────────────────

/** Nettoie une chaîne pour comparaison (accents, espaces, majuscules) */
const normalizeStr = (str) => {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/[\s._-]/g, '')        // Supprime espaces et ponctuations
    .trim();
};

/** Parse une valeur cible qui peut contenir des unités (%, €, etc) */
const parseTargetValue = (val) => {
  if (val === null || val === undefined || val === '') return null;
  // Supprime tout ce qui n'est pas chiffre, point ou virgule
  const cleaned = val.toString().replace(/[^0-9.,-]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

// ─── Helpers KPI (hors composant, fonctions pures) ───────────────────────────

/** Sens d'optimisation par metric source : lower_better ou higher_better */
const METRIC_DIRECTION = {
  dmt:                  'lower_better',   // plus court = mieux
  taux_conversion_calc: 'higher_better',
  taux_conversion:      'higher_better',
  tx_mea:               'lower_better',
  chiffre_affaire:      'higher_better',
  note_globale:         'higher_better',
  heure_hp:             'higher_better',
  heure_ht:             'higher_better',
  heure_hf:             'higher_better',
  heure_hc:             'higher_better',
  heure_total:          'higher_better',
  in_call_nbr:          'higher_better',
  nb_appels:            'higher_better',
  booking_nbr:          'higher_better',
  nb_ventes:            'higher_better',
  csat_moyen:           'higher_better',
  csat:                 'higher_better',
  nb_csat:              'higher_better',
  avg_nbr:              'higher_better',
  logged_min:           'higher_better',
  temps_production:     'higher_better',
  temps_appel:          'higher_better',
};

/**
 * Résout la clé metric (dmt | cvr | tx_mea | avg_ca | qualite | heures)
 * depuis un indicateur. Utilise `ind.metric_key` (nouveau système)
 * ou un matching par nom normalisé (legacy).
 */
function resolveMetricKey(ind) {
  if (ind.metric_key) return ind.metric_key;
  
  const nom = (ind.nom || '').toLowerCase().replace(/[\s._-]/g, '');
  if (nom.includes('dmt') || nom.includes('durée') || nom.includes('traitement')) return 'dmt';
  if (nom.includes('cvr') || nom.includes('convers')) return 'taux_conversion_calc';
  if (nom.includes('mea')) return 'tx_mea';
  if (nom.includes('avg') || nom.includes('ca') || nom.includes('nbr') || nom.includes('chiffre')) return 'chiffre_affaire';
  if (nom.includes('qualit')) return 'note_globale';
  if (nom.includes('heure')) return 'heure_hp';
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

// ─── Helpers formatage KPI (cartes agent) ────────────────────────────────────

// (Déplacés dans AgentCard.jsx)

// ─────────────────────────────────────────────────────────────────────────────

export default function TableauDeBordOnglet({ regle }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchAgent, setSearchAgent] = useState('');
  const [filterStatut, setFilterStatut] = useState('tous');
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [statutRefs, setStatutRefs] = useState([]);
  const [kpiRefsFlat, setKpiRefsFlat] = useState({});
  const socket = useSocket();

  // État local pour gérer les modifications temporaires (optimistic UI)
  const [localAgentsData, setLocalAgentsData] = useState({});

  // Unification des données (nouveau système Step 4)
  const [unifiedMap, setUnifiedMap] = useState({});
  const [loadingUnified, setLoadingUnified] = useState(false);

  // Affichage DMT : 's' = secondes brutes, 'min' = Xm XXs
  const [dmtUnit, setDmtUnit] = useState('s');

  // Mois sélectionné (format 'YYYY-MM'), initialisé au mois courant
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Calcul des bornes pour le mois sélectionné
  const selectedMonthRange = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const monthStr = String(month).padStart(2, '0');
    const label = new Date(year, month - 1, 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
    return {
      date_debut: `${year}-${monthStr}-01`,
      date_fin: `${year}-${monthStr}-${lastDay}`,
      label
    };
  }, [selectedMonth]);

  useEffect(() => {
    // Charger les statuts + refs KPIs
    fetch('/api/parametres/references')
      .then(res => res.json())
      .then(data => {
        setStatutRefs(data.statuts || []);
        // Flatten kpis grouped by univers → { tech_key: kpiRef }
        const flat = {};
        Object.values(data.kpis || {}).forEach(group => {
          group.forEach(k => { if (k.tech_key) flat[k.tech_key] = k; });
        });
        setKpiRefsFlat(flat);
      })
      .catch(err => console.error("Erreur statuts:", err));

    if (!regle?.id) return;
    fetchAgents();
  }, [regle?.id]);

  // ─── Fetch agents (extrait pour être réutilisé par socket) ───────────────
  const fetchAgents = useCallback(() => {
    if (!regle?.id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/regles/${regle.id}/agents`)
      .then(res => res.json())
      .then(data => {
        setAgents(data.data || []);
        // Initialiser localAgentsData avec les données de la DB
        const initialData = {};
        (data.data || []).forEach(a => {
          initialData[a.matricule] = { 
            id_statut: a.id_statut, 
            statut: a.statut, 
            sanction: a.sanction 
          };
        });
        // Initialiser aussi les champs assiduité vides par défaut
        (data.data || []).forEach(a => {
          initialData[a.matricule] = {
            ...initialData[a.matricule],
            abs_injust:  '',
            retards:     '',
            abs_just:    '',
            cp_css:      '',
            super_bonus: '',
          };
        });
        setLocalAgentsData(initialData);
      })
      .catch(() => setError("Impossible de contacter le SIRH."))
      .finally(() => setLoading(false));
  }, [regle?.id]);

  // ─── Temps réel : re-fetch agents dès qu'une modification est détectée ───
  useEffect(() => {
    if (!socket || !regle?.id) return;
    const handleAgentChange = (data) => {
      // agent_data_updated contient regle_id — filtrer si possible
      if (data?.regle_id && String(data.regle_id) !== String(regle.id)) return;
      fetchAgents();
    };
    socket.on('agent_data_updated', handleAgentChange);
    socket.on('agent_updated',      handleAgentChange);
    socket.on('agent_created',      handleAgentChange);
    socket.on('agent_deleted',      handleAgentChange);
    return () => {
      socket.off('agent_data_updated', handleAgentChange);
      socket.off('agent_updated',      handleAgentChange);
      socket.off('agent_created',      handleAgentChange);
      socket.off('agent_deleted',      handleAgentChange);
    };
  }, [socket, regle?.id, fetchAgents]);

  // Fetch unifié (Heures + Qualité + Performance + Virtuels)
  useEffect(() => {
    if (agents.length === 0 || !regle?.id) return;
    
    const { date_debut, date_fin } = selectedMonthRange;
    const matricules = agents.map(a => a.matricule).filter(Boolean).join(',');

    setLoadingUnified(true);
    fetch(`/api/regles/${regle.id}/calcul?date_debut=${date_debut}&date_fin=${date_fin}&matricules=${matricules}`)
      .then(res => res.json())
      .then(data => setUnifiedMap(data.data || {}))
      .catch(err => console.error('[TableauDeBord] Erreur calcul unifié:', err))
      .finally(() => setLoadingUnified(false));

  }, [agents, selectedMonthRange, regle?.id, JSON.stringify(regle?.grille_objectifs)]);

  // ─── Calcul Assiduité & Malus ──────────────────────────────────────────────

  /** Résoud la valeur réelle depuis les maps de state selon la clé metric */
  const getRealValue = (metricKey, mat) => {
    const m = String(mat);
    const agentData = unifiedMap[m] || {};
    const kpis = agentData.kpis || {};
    
    if (!metricKey) return null;

    const lowerKey = metricKey.toLowerCase();

    // 0. Recherche dans detail_kpis (structure retournée par /calcul)
    const detailKpis = agentData.detail_kpis || [];
    const fromDetail = detailKpis.find(k => k.metric_key === metricKey)
                    || detailKpis.find(k => (k.metric_key || '').toLowerCase() === lowerKey);
    if (fromDetail && fromDetail.valeur_reelle !== null && fromDetail.valeur_reelle !== undefined) {
      return fromDetail.valeur_reelle;
    }

    // 1. Recherche directe (case-sensitive)
    if (kpis[metricKey] !== undefined) return kpis[metricKey];

    // 2. Recherche insensible à la casse
    const upperKey = metricKey.toUpperCase();
    if (kpis[lowerKey] !== undefined) return kpis[lowerKey];
    if (kpis[upperKey] !== undefined) return kpis[upperKey];

    // 3. Mappings historiques et spécifiques
    switch (lowerKey) {
      case 'dmt':                  return kpis.dmt ?? kpis.DMT ?? null;
      case 'taux_conversion_calc': 
      case 'is_converted':
      case 'cvr':                  return kpis.cvr ?? kpis.TAUX_CONVERSION ?? null;
      case 'avg_ca':
      case 'avg_nbr':              return kpis.avg_nbr ?? kpis.avg_ca ?? null;
      case 'chiffre_affaire':      
      case 'revenue_amt_eur':      
      case 'net_booking_rental_amt_eur': return kpis.CHIFFRE_AFFAIRE ?? kpis.chiffre_affaire ?? null;
      case 'note_qualite_globale': 
      case 'note_globale':         
      case 'qualite':              return kpis.NOTE_QUALITE ?? kpis.note_qualite ?? null;
      case 'heure_total':          return kpis.HEURE_TOTAL ?? kpis.heure_total ?? null;
      case 'tx_mea':               return kpis.tx_mea ?? kpis.TX_MEA ?? null;
      case 'nb_appels':            return kpis.nb_appels ?? kpis.NB_APPELS ?? null;
      case 'nb_ventes':            return kpis.nb_ventes ?? kpis.NB_VENTES ?? null;
      default:                     return null;
    }
  };

  /**
   * Calcule le facteur assiduité (0 | 0.5 | 1) selon les règles configurées
   * dans grille_objectifs.regles_assiduite, ordonnées par sévérité décroissante.
   *
   * Règle 100% perte : abs_injust >= seuil.abs ET/OU retards >= seuil.retards
   * Règle 50% perte  : idem avec seuils inférieurs
   * Défaut           : facteur = 1 (aucune perte)
   */
  const calculateAssiduite = (matricule) => {
    const d = localAgentsData[matricule] || {};
    const abs_injust = parseInt(d.abs_injust) || 0;
    const retards    = parseInt(d.retards)    || 0;
    const abs_just   = parseInt(d.abs_just)   || 0;
    const cp_css     = parseInt(d.cp_css)     || 0;

    const config     = regle?.grille_objectifs?.config_temps || {};
    const jours_ouvres = parseInt(config.jours_ouvres) || 22;

    // Jours non travaillés = abs injust + abs just + CP/CSS (retards exclus)
    const jours_non_travailles = abs_injust + abs_just + cp_css;

    // Règles d'assiduité triées par sévérité (plus restrictif en premier)
    const regles = [...(regle?.grille_objectifs?.regles_assiduite || [])].sort(
      (a, b) => (b.abs + b.retards) - (a.abs + a.retards)
    );

    // Détermine le facteur (0 = perte totale, 0.5 = moitié, 1 = intégral)
    let facteur = 1;
    for (const r of regles) {
      const perte = parseFloat(r.perte_pct ?? (r.label?.includes('100') ? 100 : r.label?.includes('50') ? 50 : 0)) / 100;
      const condition = abs_injust >= r.abs || retards >= r.retards;
      if (condition) {
        facteur = 1 - perte;
        break;
      }
    }

    // Malus % = facteur × (jours travaillés / jours ouvrés) - 1
    const jours_travailles = Math.max(0, jours_ouvres - jours_non_travailles);
    const coeff_prorata    = jours_ouvres > 0 ? jours_travailles / jours_ouvres : 1;
    const malus_pct        = facteur === 0 ? -1 : (facteur * coeff_prorata) - 1;

    return {
      abs_injust,
      retards,
      abs_just,
      cp_css,
      jours_ouvres,
      jours_non_travailles,
      jours_travailles,
      facteur,
      malus_pct,   // valeur entre -1 et 0 (ex: -0.045 = -4.5%)
    };
  };

  /**
   * Calcule le montant final de la prime en appliquant assiduité + score KPI + Primes Extra.
   * Formule Excel : = (Prime_Brute * Points/100 * (1 + Malus%)) + Somme(Primes_Additionnelles)
   */
  const calculateMontantFinal = (matricule, currentStatut, hasSanction, kpiResults, assiduite) => {
    const data = localAgentsData[matricule] || {};
    const grille = regle?.grille_objectifs || {};
    
    if (hasSanction === 'Oui' || assiduite.facteur === 0 || kpiResults.isEliminated || kpiResults.hasMissingData) {
      return { prime: 0, super_bonus: 0, extra_primes: [], total_extra: 0, isEliminated: kpiResults.isEliminated, hasMissingData: kpiResults.hasMissingData };
    }
    
    const score_pct = kpiResults.total_points / 100;
    const global_mult = kpiResults.globalMultiplier || 1;
    
    const prime_points = kpiResults.montant > 0 
      ? Math.round(kpiResults.montant * score_pct * (1 + assiduite.malus_pct) * global_mult)
      : 0;
      
    // Le montant de prime total inclut aussi les KPIs en mode montant direct
    let prime = prime_points + Math.round((kpiResults.total_montant_direct || 0) * (1 + assiduite.malus_pct) * global_mult);
      
    const super_bonus = kpiResults.montant_sb > 0
      ? Math.round(kpiResults.montant_sb * score_pct * (1 + assiduite.malus_pct) * global_mult)
      : 0;

    // Calcul des primes additionnelles configurées à l'étape 5
    const extra_primes_config = grille.primes_additionnelles || [];
    const extra_primes = extra_primes_config.map(p => {
      let montant = 0;
      if (p.type === 'fixe') {
        montant = parseFloat(p.montant_defaut) || 0;
      } else if (p.type === 'conditionnelle') {
        const realVal = getRealValue(p.metric_key, matricule);
        if (realVal !== null && p.conditions) {
          // Trouver le palier le plus élevé atteint
          // On trie les conditions par seuil décroissant pour s'arrêter au premier atteint
          const sorted = [...p.conditions].sort((a, b) => b.seuil - a.seuil);
          const match = sorted.find(c => realVal >= c.seuil);
          if (match) {
            if (match.type_montant === 'pourcentage') {
              // Calculer un pourcentage du réel
              montant = Math.round(realVal * (parseFloat(match.montant) / 100));
            } else {
              // Montant fixe (par défaut)
              montant = parseFloat(match.montant) || 0;
            }
          }
        }
      } else {
        // Saisie manuelle récupérée depuis localAgentsData (si stockée)
        montant = parseFloat(data[p.id]) || 0;
      }
      return { ...p, montant };
    });

    const total_extra = extra_primes.reduce((acc, p) => acc + p.montant, 0);

    return { prime, super_bonus, extra_primes, total_extra };
  };

  // ─── Helpers internes : postes ────────────────────────────────────────────

  /**
   * Trouve la configuration de statut (provenant de la grille active) pour un agent.
   * Priorité au matching par libellé exact, puis par mots-clés.
   */
  const findStatutConfigForAgent = (currentStatutLabel) => {
    const statutsCfg = regle?.grille_objectifs?.statuts || [];
    if (statutsCfg.length === 0) return null;
    
    const labelNorm = normalizeStr(currentStatutLabel);
    
    // 1. Recherche par libellé exact
    const match = statutsCfg.find(s => normalizeStr(s.nom) === labelNorm);
    if (match) return match;
    
    // 2. Recherche par mots-clés (Senior, Confirmé, Débutant)
    const keywords = ['senior', 'confirm', 'debut'];
    for (const kw of keywords) {
      if (labelNorm.includes(kw)) {
        const keywordMatch = statutsCfg.find(s => normalizeStr(s.nom).includes(kw));
        if (keywordMatch) return keywordMatch;
      }
    }
    
    // 3. Fallback sur le premier statut défini
    return statutsCfg[0];
  };

  // Fonction pour calculer les montants cibles (prime & super bonus) d'un agent
  const calculateMontantsCibles = (agentMatricule, currentStatut, hasSanction) => {
    if (hasSanction === 'Oui') return { montant: 0, montant_sb: 0 };

    const statutCfg = findStatutConfigForAgent(currentStatut);
    if (!statutCfg) return { montant: 0, montant_sb: 0 };

    return {
      montant:    parseFloat(statutCfg.prime_brute) || 0,
      montant_sb: parseFloat(statutCfg.montant_sb) || 0,
    };
  };

  /**
   * Calcule le taux d'atteinte et les points gagnés pour chaque indicateur
   * configuré dans grille_objectifs, en croisant avec les données réelles
   * (dmtMap, qualiteMap, heuresMap) de l'agent pour le mois sélectionné.
   */
  const calculateKpiResults = (agentMatricule, currentStatut, hasSanction) => {
    if (hasSanction === 'Oui') {
      return { montant: 0, montant_sb: 0, hasSanction: true, kpis: [], total_points: 0, isEliminated: true };
    }

    const { montant, montant_sb } = calculateMontantsCibles(agentMatricule, currentStatut, hasSanction);
    const grille  = regle?.grille_objectifs;

    if (!grille?.indicateurs?.length || !grille?.statuts?.length) {
      return { montant, montant_sb, hasSanction: false, kpis: [], total_points: 0, isEliminated: false };
    }

    // 1. Trouver le statut de l'agent dans la config de la grille
    const statutCfg = findStatutConfigForAgent(currentStatut);
    const cibles    = statutCfg?.cibles || {};
    const paliers   = grille.paliers || [];

    let isEliminated = false;
    let globalMultiplier = 1;
    let hasMissingData = false;

    const kpis = grille.indicateurs.map(ind => {
      const metricKey = resolveMetricKey(ind);
      const type_ponderation = ind.type_ponderation || 'bonus';

      // Lecture de l'objectif : par ID strict, sinon fallback par metric key
      let rawObj = cibles[ind.id];

      if (rawObj === undefined || rawObj === null || rawObj === '') {
        const foundKey = Object.keys(cibles).find(k => {
          const targetInd = grille.indicateurs.find(i => i.id === k);
          return targetInd && resolveMetricKey(targetInd) === metricKey;
        });
        if (foundKey) rawObj = cibles[foundKey];
      }

      let objectif    = parseTargetValue(rawObj);
      const reel      = metricKey ? getRealValue(metricKey, agentMatricule) : null;
      const direction = ind.direction || METRIC_DIRECTION[metricKey] || 'higher_better';
      const weight    = parseFloat(ind.poids) || 0;

      if (reel === null) {
        hasMissingData = true;
      }

      if (objectif !== null && (ind.type === 'pourcentage' || ['cvr', 'tx_mea', 'qualite'].includes(metricKey))) {
        if (objectif > 0 && objectif <= 1) objectif = objectif * 100;
      }

      let taux_atteinte = null;
      let points_gagnes = 0;
      let montant_gagne = 0;
      let impact_desc = '';
      
      const mode_prime = ind.mode_prime || 'score_global';

      if (mode_prime === 'montant_direct') {
        if (reel != null && reel >= 0 && ind.paliers_valeur && ind.paliers_valeur.length > 0) {
          const sortedPV = [...ind.paliers_valeur].sort((a, b) => (a.seuil_min ?? 0) - (b.seuil_min ?? 0));
          const palier = sortedPV.find(p => reel >= (p.seuil_min ?? 0) && (p.seuil_max === null || p.seuil_max === '' || reel <= p.seuil_max));
          if (palier) {
            if (palier.type_montant === 'pourcentage_kpi') {
               montant_gagne = reel * (parseFloat(palier.montant) / 100);
            } else {
               montant_gagne = parseFloat(palier.montant) || 0;
            }
            impact_desc = `${Math.round(montant_gagne).toLocaleString('fr-FR')} DH`;
          } else {
            impact_desc = '0 DH';
          }
        } else {
           impact_desc = '—';
        }
      } else if (mode_prime === 'pourcentage_valeur') {
        if (reel != null && reel >= 0) {
          montant_gagne = reel * (weight / 100);
          impact_desc = `${Math.round(montant_gagne).toLocaleString('fr-FR')} DH`;
        }
      } else {
        // Mode classique : score global
        if (objectif != null && reel != null && objectif > 0 && reel >= 0) {
          let tauxBrut = (direction === 'lower_better') ? (reel === 0 ? 1.5 : objectif / reel) : (reel / objectif);
          taux_atteinte = Math.min(tauxBrut, 1.5);
          const atteintPct = taux_atteinte * 100;

          // --- Logique par Type de Pondération ---
          if (type_ponderation === 'eliminatoire') {
            if (atteintPct < 100) {
              isEliminated = true;
              impact_desc = 'ÉLIMINATOIRE';
            }
          } 
          else if (type_ponderation === 'coefficient') {
            if (atteintPct < 100) {
              const reduction = weight / 100;
              globalMultiplier *= (1 - reduction);
              impact_desc = `-${weight}% Global`;
            }
          }
          else {
            let applyPct = 0;
            if (paliers.length > 0) {
              const sortedPaliers = [...paliers].sort((a, b) => (a.seuil_atteinte ?? 999) - (b.seuil_atteinte ?? 999));
              for (let i = 0; i < sortedPaliers.length; i++) {
                const p = sortedPaliers[i];
                if (p.seuil_atteinte !== null && atteintPct < p.seuil_atteinte) {
                  applyPct = p.pourcentage_paiement;
                  break;
                } else if (p.seuil_atteinte === null) {
                  applyPct = p.pourcentage_paiement;
                }
              }
            } else {
              applyPct = Math.min(taux_atteinte, 1) * 100;
            }

            if (type_ponderation === 'malus') {
              const malus_factor = Math.max(0, 1 - (applyPct / 100));
              points_gagnes = -Math.round(malus_factor * weight);
            } else {
              points_gagnes = Math.round((applyPct / 100) * weight);
            }
          }
        }
      }

      return {
        id: ind.id,
        nom: ind.nom || kpiRefsFlat[metricKey]?.libelle || ind.metric_key || 'KPI',
        categorie: ind.categorie,
        type_ponderation,
        mode_prime,
        metricKey,
        objectif,
        reel,
        taux_atteinte,
        points_max: (type_ponderation === 'bonus' || type_ponderation === 'malus') ? weight : 0,
        points_gagnes,
        montant_gagne,
        impact_desc,
        is_formula: kpiRefsFlat[metricKey]?.is_formula || false,
        formula:    kpiRefsFlat[metricKey]?.formula    || null,
        source_db:  kpiRefsFlat[metricKey]?.source_db  || null,
        kpi_libelle: kpiRefsFlat[metricKey]?.libelle   || ind.nom,
      };
    });

    const total_points = kpis.reduce((acc, k) => acc + (k.points_gagnes ?? 0), 0);
    const total_montant_direct = kpis.reduce((acc, k) => acc + (k.montant_gagne ?? 0), 0);

    return { 
      montant, 
      montant_sb, 
      hasSanction: false, 
      kpis, 
      total_points: Math.max(0, total_points), 
      total_montant_direct,
      isEliminated,
      globalMultiplier,
      hasMissingData
    };
  };

  const handleUpdateLocalData = (matricule, field, value) => {
    // Mise à jour locale (optimistic)
    const currentData = localAgentsData[matricule] || { id_statut: null, statut: 'Confirmé', sanction: 'Non' };
    let newData = { ...currentData, [field]: value };
    
    setLocalAgentsData(prev => ({
      ...prev,
      [matricule]: newData
    }));

    // Persistance en base
    fetch(`/api/regles/${regle.id}/agents/${matricule}/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newData)
    }).catch(err => console.error("Erreur sauvegarde agent:", err));
  };

  const globalStats = useMemo(() => {
    if (!agents.length) return null;
    let eligible = 0;
    let nonEligible = 0;
    let totalMasse = 0;

    agents.forEach(a => {
      const data = localAgentsData[a.matricule] || { statut: 'Confirmé', sanction: 'Non' };
      const isElig = data.sanction !== 'Oui';
      if (isElig) eligible++; else nonEligible++;

      const kpiResults = calculateKpiResults(a.matricule, data.statut, data.sanction);
      const assiduite  = calculateAssiduite(a.matricule);
      const results    = calculateMontantFinal(a.matricule, data.statut, data.sanction, kpiResults, assiduite);
      totalMasse += (results.prime || 0) + (results.super_bonus || 0) + (results.total_extra || 0);
    });

    const avgPrime = eligible > 0 ? totalMasse / eligible : 0;
    return { total: agents.length, eligible, nonEligible, totalMasse, avgPrime };
  }, [agents, localAgentsData, unifiedMap]);

  const filtered = agents.filter(a => {
    const fullName = `${a.prenom} ${a.nom} ${a.matricule}`.toLowerCase();
    const matchSearch = fullName.includes(searchAgent.toLowerCase());
    if (!matchSearch) return false;

    if (filterStatut === 'tous') return true;

    const data = localAgentsData[a.matricule] || { sanction: a.sanction };
    const isEligible = data.sanction !== 'Oui';
    return filterStatut === 'eligible' ? isEligible : !isEligible;
  });

  /** Formate une valeur DMT (en secondes) selon l'unité choisie */
  const formatDmt = (sec) => {
    if (sec == null) return '—';
    if (dmtUnit === 'min') {
      return `${Math.floor(sec / 60)}m\u00a0${String(Math.round(sec % 60)).padStart(2, '0')}s`;
    }
    return `${Math.round(sec)}s`;
  };

  /** Gère l'affichage sélectif des formules dans la modale */
  const handleShowFormula = (typeOrData) => {
    // Accepte un objet formula directement (KPI dynamiques)
    if (typeof typeOrData === 'object' && typeOrData !== null) {
      setModalData(typeOrData);
      setShowFormulaModal(true);
      return;
    }
    const type = typeOrData;
    const allFormulas = {
      prime_brute: {
        title: "Montant de la prime hors Super Bonus",
        formula: "=SIERREUR((Montant_Cible * Points_KPI / 100) * (1 + Malus%); \"\")",
        sourceTable: "Base MySQL (matrice_primes.grille_objectifs)",
        metrics: "Montant Cible (H13), Points KPI (AF13), Malus Assiduité (AO13)"
      },
      total_sb: {
        title: "Super Bonus (si configuré)",
        formula: "=SIERREUR((Montant_SB_Cible * Points_KPI / 100) * (1 + Malus%); \"\")",
        sourceTable: "Base MySQL (matrice_primes.grille_objectifs)",
        metrics: "Montant SB Cible (H13), Points KPI (AF13), Malus Assiduité (AO13)"
      },
      total_prime: {
        title: "Total avec Super Bonus",
        formula: "=Montant_Prime_hors_SB + Super_Bonus (Calculé ou Manuel)",
        sourceTable: "Calculé dynamiquement",
        metrics: "montant_final, montant_sb_cible"
      },
      points_final: {
        title: "Nombre de points Final",
        formula: "=Nb_de_points_Initial * (1 + Malus%)",
        sourceTable: "Calculé dynamiquement",
        metrics: "total_points, malus_pct"
      },
      malus_assiduite: {
        title: "Malus Assiduité (%)",
        formula: "=Facteur_Assiduité × (Jours_Travaillés / Jours_Ouvrés) - 1",
        sourceTable: "Config Variables (Assiduité & Temps)",
        metrics: "Facteur (1/0.5/0 basé sur Abs/Retards), Jours Ouvrés, Jours Non Travaillés"
      },
      jours_non_travailles: {
        title: "Jours Non Travaillés",
        formula: "=Abs. injust. + Abs. just. + CP/CSS",
        sourceTable: "Calculé dynamiquement",
        metrics: "abs_injust, abs_just, cp_css"
      },
      jours_travailles: {
        title: "Jours Travaillés",
        formula: "=Jours_Ouvrés - Jours_Non_Travaillés",
        sourceTable: "Calculé dynamiquement",
        metrics: "jours_ouvres, jours_non_travailles"
      }
    };
    setModalData(allFormulas[type]);
    setShowFormulaModal(true);
  };

  const fmtDH = (v) => v.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' DH';

  return (
    <div className="agents-onglet">
      {!loading && !error && globalStats && (
        <div className="tdb-stats-bar">
          <div className="tdb-stat">
            <i className="fa-solid fa-users"></i>
            <span className="tdb-stat__value">{globalStats.total}</span>
            <span className="tdb-stat__label">Agents</span>
          </div>
          <div className="tdb-stat tdb-stat--success">
            <i className="fa-solid fa-circle-check"></i>
            <span className="tdb-stat__value">{globalStats.eligible}</span>
            <span className="tdb-stat__label">Éligibles</span>
          </div>
          <div className="tdb-stat tdb-stat--danger">
            <i className="fa-solid fa-ban"></i>
            <span className="tdb-stat__value">{globalStats.nonEligible}</span>
            <span className="tdb-stat__label">Non éligibles</span>
          </div>
          <div className="tdb-stat tdb-stat--accent tdb-stat--wide">
            <i className="fa-solid fa-money-bill-wave"></i>
            <span className="tdb-stat__value">{fmtDH(globalStats.totalMasse)}</span>
            <span className="tdb-stat__label">Masse totale des primes</span>
          </div>
          <div className="tdb-stat tdb-stat--wide">
            <i className="fa-solid fa-chart-line"></i>
            <span className="tdb-stat__value">{fmtDH(globalStats.avgPrime)}</span>
            <span className="tdb-stat__label">Prime moy. / éligible</span>
          </div>
        </div>
      )}
      <ToolbarSection
        searchAgent={searchAgent}
        setSearchAgent={setSearchAgent}
        filterStatut={filterStatut}
        setFilterStatut={setFilterStatut}
      />

      {loading && (
        <div className="agents-onglet__state">
          <i className="fa-solid fa-spinner fa-spin"></i>
          <p>Chargement des agents depuis le SIRH…</p>
        </div>
      )}

      {error && (
        <div className="agents-onglet__state agents-onglet__state--error">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="agents-onglet__state">
          <i className="fa-solid fa-users-slash"></i>
          <p>Aucun agent trouvé{searchAgent ? ` pour "${searchAgent}"` : ' pour cette opération'}.</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="agents-dashboard-wrapper">
          <div className="agents-onglet__toolbar-row">
            <div className="agents-onglet__count">
              {filtered.length} agent{filtered.length > 1 ? 's' : ''}
            </div>
            <div className="agents-onglet__month-picker">
              <i className="fa-regular fa-calendar"></i>
              <label htmlFor="ao-month-select" className="agents-onglet__month-label">Données du mois :</label>
              <input
                id="ao-month-select"
                type="month"
                className="agents-onglet__month-input"
                value={selectedMonth}
                max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
                onChange={e => setSelectedMonth(e.target.value)}
              />
              <button
                className="agents-table__dmt-unit-toggle"
                onClick={() => setDmtUnit(u => u === 's' ? 'min' : 's')}
                title="Basculer affichage DMT : secondes / minutes"
              >DMT {dmtUnit === 's' ? 's <> mn' : 'mn <> s'}</button>
            </div>
          </div>
          <div className="agents-dashboard">
            {filtered.map((a, i) => {
              const data         = localAgentsData[a.matricule] || { statut: 'Confirmé', sanction: 'Non', abs_injust: 0, retards: 0, abs_just: 0, cp_css: 0 };
              const kpiResults   = calculateKpiResults(a.matricule, data.statut, data.sanction);
              const assiduite    = calculateAssiduite(a.matricule);
              const results      = calculateMontantFinal(a.matricule, data.statut, data.sanction, kpiResults, assiduite);
              const montantFinal = results.prime;
              const calcSB       = results.super_bonus;
              const totalExtra   = results.total_extra;
              const extraPrimes  = results.extra_primes;
              
              // Total = Prime scorée + Super Bonus + Primes additionnelles
              const totalPrime   = (montantFinal || 0) + (calcSB || 0) + totalExtra;
              
              const ptsFinal     = (kpiResults.total_points * (1 + assiduite.malus_pct)).toFixed(1);
              const anyLoading   = loadingUnified;

              return (
                <AgentCard
                  key={a.matricule || i}
                  agent={a}
                  data={data}
                  kpiResults={kpiResults}
                  assiduite={assiduite}
                  results={results}
                  montantFinal={montantFinal}
                  calcSB={calcSB}
                  extraPrimes={extraPrimes}
                  totalPrime={totalPrime}
                  ptsFinal={ptsFinal}
                  anyLoading={anyLoading}
                  dmtUnit={dmtUnit}
                  unifiedKpis={unifiedMap[String(a.matricule)] || {}}
                  handleUpdateLocalData={handleUpdateLocalData}
                  handleShowFormula={handleShowFormula}
                />
              );
            })}
          </div>
        </div>
      )}

      <KpiInfoModal 
        isOpen={showFormulaModal}
        onClose={() => setShowFormulaModal(false)}
        data={modalData}
      />

      {/* ── Règles appliquées manuellement ── */}
      {(() => {
        const reglesMetier = regle?.grille_objectifs?.regles_metier || [];
        if (reglesMetier.length === 0) return null;
        const TYPE_META = {
          disqualifiant:      { icon: 'fa-ban',           cls: 'tdb-regle--disqualifiant' },
          malus_conditionnel: { icon: 'fa-circle-minus',  cls: 'tdb-regle--malus' },
          prorata:            { icon: 'fa-calendar-days', cls: 'tdb-regle--prorata' },
        };
        return (
          <div className="tdb-regles-metier">
            <div className="tdb-regles-metier__header">
              <i className="fa-solid fa-gavel"></i>
              Règles appliquées manuellement
            </div>
            <p className="tdb-regles-metier__desc">
              Ces conditions ne sont pas calculées automatiquement. Elles doivent être vérifiées et appliquées
              par le responsable lors de la validation des primes.
            </p>
            <ul className="tdb-regles-metier__list">
              {reglesMetier.map((r, i) => {
                const { icon, cls } = TYPE_META[r.type] || { icon: 'fa-circle-info', cls: '' };
                return (
                  <li key={i} className={`tdb-regle ${cls}`}>
                    <i className={`fa-solid ${icon}`}></i>
                    <span>{r.description}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })()}
    </div>
  );
}

