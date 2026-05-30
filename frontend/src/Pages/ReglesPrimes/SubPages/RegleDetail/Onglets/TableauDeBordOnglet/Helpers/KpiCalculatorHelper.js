/**
 * Fichier : KpiCalculatorHelper.js
 * Rôle    : Fonctions pures pour le calcul des primes, des malus et de l'assiduité 
 *           dans le tableau de bord des règles de primes.
 */

/** Nettoie une chaîne pour comparaison (accents, espaces, majuscules) */
export const normalizeStr = (str) => {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s._-]/g, '')
    .trim();
};

/** Parse une valeur cible qui peut contenir des unités (%, €, etc) */
export const parseTargetValue = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const cleaned = val.toString().replace(/[^0-9.,-]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

/** Sens d'optimisation par metric source : lower_better ou higher_better */
export const METRIC_DIRECTION = {
  dmt:                  'lower_better',
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
 * Résout la clé metric depuis un indicateur.
 * Si metric_key est renseigné (KPI brut BigQuery), on l'utilise directement.
 * Pas de transformation — le metric_key est la clé exacte telle que stockée dans la grille.
 */
export function resolveMetricKey(ind) {
  if (ind.metric_key) return ind.metric_key;
  return null;
}

/**
 * Résoud la valeur réelle d'un KPI pour un agent.
 * Source unique : detail_kpis retourné par le backend (calcul unifié BigQuery).
 */
export const getRealValue = (metricKey, mat, unifiedMap) => {
  const agentData = unifiedMap[String(mat)] || {};
  const detailKpis = agentData.detail_kpis || [];

  if (!metricKey) return null;

  const lowerKey = metricKey.toLowerCase();
  const entry = detailKpis.find(k => k.metric_key === metricKey)
             || detailKpis.find(k => (k.metric_key || '').toLowerCase() === lowerKey);

  if (entry && entry.valeur_reelle !== null && entry.valeur_reelle !== undefined) {
    return entry.valeur_reelle;
  }

  return null;
};

export const findStatutConfigForAgent = (currentStatutLabel, regle) => {
  const statutsCfg = regle?.grille_objectifs?.statuts || [];
  if (statutsCfg.length === 0) return null;
  
  const labelNorm = normalizeStr(currentStatutLabel);
  const match = statutsCfg.find(s => normalizeStr(s.nom) === labelNorm);
  if (match) return match;
  
  const keywords = ['senior', 'confirm', 'debut'];
  for (const kw of keywords) {
    if (labelNorm.includes(kw)) {
      const keywordMatch = statutsCfg.find(s => normalizeStr(s.nom).includes(kw));
      if (keywordMatch) return keywordMatch;
    }
  }
  return statutsCfg[0];
};

export const calculateMontantsCibles = (agentMatricule, currentStatut, hasSanction, regle) => {
  if (hasSanction === 'Oui') return { montant: 0, montant_sb: 0 };
  const statutCfg = findStatutConfigForAgent(currentStatut, regle);
  if (!statutCfg) return { montant: 0, montant_sb: 0 };

  return {
    montant:    parseFloat(statutCfg.prime_brute) || 0,
    montant_sb: parseFloat(statutCfg.montant_sb) || 0,
  };
};

export const calculateAssiduite = (matricule, localAgentsData, regle) => {
  const d = localAgentsData[matricule] || {};
  const abs_injust = parseInt(d.abs_injust) || 0;
  const retards    = parseInt(d.retards)    || 0;
  const abs_just   = parseInt(d.abs_just)   || 0;
  const cp_css     = parseInt(d.cp_css)     || 0;

  const config     = regle?.grille_objectifs?.config_temps || {};
  const jours_ouvres = parseInt(config.jours_ouvres) || 22;
  const jours_non_travailles = abs_injust + abs_just + cp_css;

  const regles = [...(regle?.grille_objectifs?.regles_assiduite || [])].sort(
    (a, b) => (b.abs + b.retards) - (a.abs + a.retards)
  );

  let facteur = 1;
  for (const r of regles) {
    const perte = parseFloat(r.perte_pct ?? (r.label?.includes('100') ? 100 : r.label?.includes('50') ? 50 : 0)) / 100;
    const condition = abs_injust >= r.abs || retards >= r.retards;
    if (condition) {
      facteur = 1 - perte;
      break;
    }
  }

  const jours_travailles = Math.max(0, jours_ouvres - jours_non_travailles);
  const coeff_prorata    = jours_ouvres > 0 ? jours_travailles / jours_ouvres : 1;
  const malus_pct        = facteur === 0 ? -1 : (facteur * coeff_prorata) - 1;

  return { abs_injust, retards, abs_just, cp_css, jours_ouvres, jours_non_travailles, jours_travailles, facteur, malus_pct };
};

export const calculateKpiResults = (agentMatricule, currentStatut, hasSanction, regle, unifiedMap, kpiRefsFlat) => {
  if (hasSanction === 'Oui') {
    return { montant: 0, montant_sb: 0, hasSanction: true, kpis: [], total_points: 0, isEliminated: true };
  }

  const { montant, montant_sb } = calculateMontantsCibles(agentMatricule, currentStatut, hasSanction, regle);
  const grille  = regle?.grille_objectifs;

  if (!grille?.indicateurs?.length || !grille?.statuts?.length) {
    return { montant, montant_sb, hasSanction: false, kpis: [], total_points: 0, isEliminated: false };
  }

  const statutCfg = findStatutConfigForAgent(currentStatut, regle);
  const cibles    = statutCfg?.cibles || {};
  const paliers   = grille.paliers || [];

  let isEliminated = false;
  let globalMultiplier = 1;

  const kpis = grille.indicateurs.map(ind => {
    const metricKey = resolveMetricKey(ind);
    const type_ponderation = ind.type_ponderation || 'bonus';

    let rawObj = cibles[ind.id];
    if (rawObj === undefined || rawObj === null || rawObj === '') {
      const foundKey = Object.keys(cibles).find(k => {
        const targetInd = grille.indicateurs.find(i => i.id === k);
        return targetInd && resolveMetricKey(targetInd) === metricKey;
      });
      if (foundKey) rawObj = cibles[foundKey];
    }

    let objectif    = parseTargetValue(rawObj);
    const reel      = metricKey ? getRealValue(metricKey, agentMatricule, unifiedMap) : null;
    const direction = ind.direction || METRIC_DIRECTION[metricKey] || METRIC_DIRECTION[metricKey?.toLowerCase()] || 'higher_better';
    const weight    = parseFloat(ind.poids) || 0;

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
      if (objectif != null && reel != null && objectif > 0 && reel >= 0) {
        let tauxBrut = (direction === 'lower_better') ? (reel === 0 ? 1.5 : objectif / reel) : (reel / objectif);
        taux_atteinte = Math.min(tauxBrut, 1.5);
        const atteintPct = taux_atteinte * 100;

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
    globalMultiplier 
  };
};

export const calculateMontantFinal = (matricule, currentStatut, hasSanction, kpiResults, assiduite, localAgentsData, regle, unifiedMap) => {
  const data = localAgentsData[matricule] || {};
  const grille = regle?.grille_objectifs || {};
  
  if (hasSanction === 'Oui' || assiduite.facteur === 0 || kpiResults.isEliminated) {
    return { prime: 0, super_bonus: 0, extra_primes: [], total_extra: 0, isEliminated: kpiResults.isEliminated };
  }
  
  const score_pct = kpiResults.total_points / 100;
  const global_mult = kpiResults.globalMultiplier || 1;
  
  const prime_points = kpiResults.montant > 0 
    ? Math.round(kpiResults.montant * score_pct * (1 + assiduite.malus_pct) * global_mult)
    : 0;
    
  let prime = prime_points + Math.round((kpiResults.total_montant_direct || 0) * (1 + assiduite.malus_pct) * global_mult);
    
  const super_bonus = kpiResults.montant_sb > 0
    ? Math.round(kpiResults.montant_sb * score_pct * (1 + assiduite.malus_pct) * global_mult)
    : 0;

  const extra_primes_config = grille.primes_additionnelles || [];
  const extra_primes = extra_primes_config.map(p => {
    let montant = 0;
    if (p.type === 'fixe') {
      montant = parseFloat(p.montant_defaut) || 0;
    } else if (p.type === 'conditionnelle') {
      const realVal = getRealValue(p.metric_key, matricule, unifiedMap);
      if (realVal !== null && p.conditions) {
        const sorted = [...p.conditions].sort((a, b) => b.seuil - a.seuil);
        const match = sorted.find(c => realVal >= c.seuil);
        if (match) {
          if (match.type_montant === 'pourcentage') {
            montant = Math.round(realVal * (parseFloat(match.montant) / 100));
          } else {
            montant = parseFloat(match.montant) || 0;
          }
        }
      }
    } else {
      montant = parseFloat(data[p.id]) || 0;
    }
    return { ...p, montant };
  });

  const total_extra = extra_primes.reduce((acc, p) => acc + p.montant, 0);

  return { prime, super_bonus, extra_primes, total_extra };
};