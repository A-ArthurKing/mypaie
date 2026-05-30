/*
 * Fichier : FormulaGenerator.js
 * Rôle    : Fonctions partagées pour générer les formules (algo/humain)
 *           à partir d'une grille d'objectifs et de sa configuration temps.
 */

export const KPI_LABELS = {
  abs_injustifie: 'absences injustifiées',
  abs_justifie:   'absences justifiées',
  retard:         'retards',
  cp_css:         'congés payés (CNSS)',
};

// ── Générateur de formule algorithmique (pseudo-code) ──────────────────────
export function buildFormuleAlgo(data, configTemps) {
  const { indicateurs = [], statuts = [], paliers = [], primes_additionnelles = [] } = data;
  const {
    mode_prorata    = 'aucun',
    jours_ouvres    = 22,
    base_horaire    = 191,
    seuil_minimum_jours,
    malus_assiduite = [],
  } = configTemps || {};

  const lines = [];
  let etape = 1;

  // ── Étape 1 : Statuts ──
  lines.push({ type: 'comment', text: `── Étape ${etape++} : Identification du niveau (depuis ref_employes.statut)` });
  if (statuts.length > 0) {
    statuts.forEach(s => {
      lines.push({ type: 'keyword', text: `SI statut == "${s.nom}":` });
      lines.push({ type: 'assign',  text: `    prime_brute = ${s.prime_brute} DH` });
      const cibleEntries = Object.entries(s.cibles || {});
      if (cibleEntries.length > 0) {
        const ciblesStr = cibleEntries.map(([kpiId, val]) => {
          const ind = indicateurs.find(i => i.id === kpiId);
          return `${ind?.nom || ind?.metric_key || kpiId} = ${val}`;
        }).join(', ');
        lines.push({ type: 'assign', text: `    cibles = { ${ciblesStr} }` });
      }
    });
  } else {
    lines.push({ type: 'plain', text: '// Aucun statut défini' });
  }

  // Séparer les indicateurs selon leur mode
  const indsScore        = indicateurs.filter(i => !i.mode_prime || i.mode_prime === 'score_global');
  const indsMontant      = indicateurs.filter(i => i.mode_prime === 'montant_direct');

  // ── Étape 2 : Score global (indicateurs score_global uniquement) ──
  lines.push({ type: 'blank' });
  if (indsScore.length > 0) {
    lines.push({ type: 'comment', text: `── Étape ${etape++} : Score global (sur 100 pts) — ${indsScore.length} indicateur(s)` });
    lines.push({ type: 'assign', text: 'score_global = 0' });

    const sortedPaliers = [...paliers].sort((a, b) => (a.seuil_atteinte ?? 999) - (b.seuil_atteinte ?? 999));
    if (sortedPaliers.length > 0) {
      const palierDesc = sortedPaliers.map(p =>
        p.seuil_atteinte != null ? `< ${p.seuil_atteinte}% → ${p.pourcentage_paiement}%pp` : `≥ seuil → ${p.pourcentage_paiement}%pp`
      ).join(' | ');
      lines.push({ type: 'comment', text: `   Paliers d'atteinte : ${palierDesc}` });
    }

    indsScore.forEach(ind => {
      const dir   = ind.direction === 'lower_better' ? 'cible / réel × 100' : 'réel / cible × 100';
      const sign  = ind.type_ponderation === 'malus' ? '-' : '+';
      const label = ind.nom || ind.metric_key || ind.id;
      lines.push({ type: 'assign', text: `score_global ${sign}= ${ind.poids}pts × palier( ${label}: atteinte = ${dir} ) / 100` });
    });
  } else {
    lines.push({ type: 'comment', text: `── Étape ${etape++} : Score global — aucun indicateur en mode score` });
    lines.push({ type: 'assign', text: 'score_global = 100   ← tous les indicateurs sont en montant direct' });
  }

  // ── Étape 3 : Prime de base (score) ──
  lines.push({ type: 'blank' });
  lines.push({ type: 'comment', text: `── Étape ${etape++} : Prime de base (score KPI)` });
  lines.push({ type: 'assign',  text: 'score_global = max(0, score_global)' });
  lines.push({ type: 'assign',  text: 'prime_base = prime_brute × (score_global / 100)' });

  // ── Étape bonus : Indicateurs montant_direct ──
  if (indsMontant.length > 0) {
    lines.push({ type: 'blank' });
    lines.push({ type: 'comment', text: `── Étape ${etape++} : Primes à montant direct — ${indsMontant.length} indicateur(s)` });
    indsMontant.forEach(ind => {
      const label = ind.nom || ind.metric_key || ind.id;
      lines.push({ type: 'comment', text: `   ${label} — ${(ind.paliers_valeur || []).length} tranche(s)` });
      (ind.paliers_valeur || []).forEach(pv => {
        const borneMin = pv.seuil_min ?? 0;
        const borneMax = pv.seuil_max != null ? pv.seuil_max : '∞';
        const montantStr = pv.type_montant === 'pourcentage'
          ? `prime_brute × ${pv.montant}%`
          : `${pv.montant} DH`;
        lines.push({ type: 'keyword', text: `SI ${borneMin} ≤ ${label} < ${borneMax} :` });
        lines.push({ type: 'assign',  text: `    prime_base += ${montantStr}` });
      });
    });
  }

  // ── Étape 4 : Malus assiduité ──
  if (malus_assiduite.length > 0) {
    lines.push({ type: 'blank' });
    lines.push({ type: 'comment', text: `── Étape ${etape++} : Malus assiduité (règle la plus restrictive retenue)` });
    malus_assiduite.forEach(rule => {
      if (rule.type === 'total') {
        lines.push({ type: 'keyword', text: `SI ${rule.kpi} ${rule.operateur} ${rule.seuil} :` });
        lines.push({ type: 'danger',  text: `    prime_base = 0   ← suppression totale` });
      } else {
        const facteur = (1 - (rule.malus_pct || 0) / 100).toFixed(2);
        lines.push({ type: 'keyword', text: `SI ${rule.kpi} ${rule.operateur} ${rule.seuil} :` });
        lines.push({ type: 'warn',    text: `    prime_base = prime_base × ${facteur}   ← -${rule.malus_pct}%` });
      }
    });
  }

  // ── Étape N : Prorata ──
  lines.push({ type: 'blank' });
  lines.push({ type: 'comment', text: `── Étape ${etape++} : Prorata de présence` });
  if (mode_prorata === 'jours') {
    if (seuil_minimum_jours) {
      lines.push({ type: 'keyword', text: `SI jours_travailles < ${seuil_minimum_jours} :` });
      lines.push({ type: 'danger',  text: `    prime_finale = 0   ← seuil minimum non atteint` });
    }
    lines.push({ type: 'assign', text: `prime_finale = prime_base × (jours_travailles / ${jours_ouvres})` });
  } else if (mode_prorata === 'heures') {
    if (seuil_minimum_jours) {
      lines.push({ type: 'keyword', text: `SI heures_reelles < ${seuil_minimum_jours} :` });
      lines.push({ type: 'danger',  text: `    prime_finale = 0   ← seuil minimum non atteint` });
    }
    lines.push({ type: 'assign', text: `prime_finale = prime_base × (heures_reelles / ${base_horaire})` });
  } else {
    lines.push({ type: 'assign', text: `prime_finale = prime_base   ← pas de prorata` });
  }

  // ── Primes additionnelles ──
  if (primes_additionnelles.length > 0) {
    lines.push({ type: 'blank' });
    lines.push({ type: 'comment', text: `── Bonus : Primes additionnelles` });
    primes_additionnelles.forEach(p => {
      if (p.type === 'fixe') {
        lines.push({ type: 'assign', text: `prime_finale += ${p.montant_defaut} DH   ← ${p.nom || '(sans nom)'}` });
      } else {
        (p.conditions || []).forEach(c => {
          lines.push({ type: 'keyword', text: `SI ${p.metric_key || p.nom} >= ${c.seuil} :` });
          lines.push({ type: 'assign',  text: `    prime_finale += ${c.montant} DH` });
        });
      }
    });
  }

  return lines;
}

// ── Générateur de texte explicatif (humain) ────────────────────────────────
export function buildFormuleHumain(data, configTemps) {
  const { indicateurs = [], statuts = [], paliers = [], primes_additionnelles = [] } = data;
  const {
    mode_prorata    = 'aucun',
    jours_ouvres    = 22,
    base_horaire    = 191,
    seuil_minimum_jours,
    malus_assiduite = [],
  } = configTemps || {};

  const blocks = [];

  // 1. Profils et Montants de base
  if (statuts.length > 0) {
    const details = statuts.map(s => {
      const ciblesStr = Object.entries(s.cibles || {}).map(([id, val]) => {
        const ind = indicateurs.find(i => i.id === id);
        return `${ind?.nom || ind?.metric_key || id} : ${val}`;
      }).join(', ');
      return `Pour le niveau **${s.nom}**, la prime de base est de **${s.prime_brute} DH**. Objectifs à atteindre : ${ciblesStr || 'aucun spécifique'}.`;
    });
    blocks.push({
      title: '1. Montants par niveau',
      text: details.join('\n\n')
    });
  }

  // 2. Calcul du Score Global
  const indsScore = indicateurs.filter(i => !i.mode_prime || i.mode_prime === 'score_global');
  if (indsScore.length > 0) {
    const kpiDetails = indsScore.map(i => {
      const dir = i.direction === 'lower_better' ? 'plus la valeur est basse, meilleure est l\'atteinte' : 'plus la valeur est haute, meilleure est l\'atteinte';
      const type = i.type_ponderation === 'malus' ? 'malus (déduit du score)' : 'bonus (ajoute au score)';
      return `• **${i.nom || i.metric_key}** (${i.poids} pts) : ${dir}. C'est un indicateur de type ${type}.`;
    }).join('\n');

    const sortedPaliers = [...paliers].sort((a, b) => (a.seuil_atteinte ?? 999) - (b.seuil_atteinte ?? 999));
    const palierText = sortedPaliers.map(p => 
      p.seuil_atteinte != null 
        ? `Moins de ${p.seuil_atteinte}% d'atteinte → versement de ${p.pourcentage_paiement}% du poids.`
        : `Au-delà du seuil précédent → versement de ${p.pourcentage_paiement}% du poids.`
    ).join(' ');

    blocks.push({
      title: '2. Performance et Paliers',
      text: `Le score final est la somme des contributions de ${indsScore.length} indicateurs :\n${kpiDetails}\n\n**Barème de paiement :** ${palierText}`
    });
  }

  // 3. Primes à montant direct
  const indsMontant = indicateurs.filter(i => i.mode_prime === 'montant_direct');
  if (indsMontant.length > 0) {
    const directDetails = indsMontant.map(i => {
      const tranches = (i.paliers_valeur || []).map(pv => {
        const min = pv.seuil_min ?? 0;
        const max = pv.seuil_max != null ? pv.seuil_max : 'infini';
        const val = pv.type_montant === 'pourcentage' ? `${pv.montant}% de la prime brute` : `${pv.montant} DH`;
        return `Entre ${min} et ${max} → **+${val}**`;
      }).join(' | ');
      return `• **${i.nom || i.metric_key}** : ${tranches}`;
    }).join('\n');

    blocks.push({
      title: '3. Primes directes (hors score)',
      text: `Ces indicateurs ajoutent un montant fixe ou proportionnel selon la valeur réelle atteinte :\n${directDetails}`
    });
  }

  // 4. Assiduité et Malus
  if (malus_assiduite.length > 0) {
    const rules = malus_assiduite.map(r => {
      const action = r.type === 'total' ? 'annule totalement la prime' : `réduit la prime de **${r.malus_pct}%**`;
      return `• Si ${KPI_LABELS[r.kpi] || r.kpi} ${r.operateur} ${r.seuil} → ${action}.`;
    }).join('\n');
    blocks.push({
      title: '4. Règles d\'assiduité',
      text: `Des malus s'appliquent sur le montant total calculé (la règle la plus sévère est retenue) :\n${rules}`
    });
  }

  // 5. Prorata de présence
  if (mode_prorata !== 'aucun') {
    const base = mode_prorata === 'jours' ? `${jours_ouvres} jours` : `${base_horaire} heures`;
    const unite = mode_prorata === 'jours' ? 'jours travaillés' : 'heures réelles';
    let detail = `Le montant final est multiplié par le taux de présence : **(${unite} / ${base})**.`;
    if (seuil_minimum_jours) {
      detail += `\n\n⚠️ **Seuil bloquant :** Si la présence est inférieure à **${seuil_minimum_jours} ${mode_prorata === 'jours' ? 'jours' : 'heures'}**, la prime est automatiquement ramenée à **0 DH**.`;
    }
    blocks.push({ title: '5. Prorata et Présence', text: detail });
  }

  // 6. Bonus finaux
  if (primes_additionnelles.length > 0) {
    const bonus = primes_additionnelles.map(p => {
      if (p.type === 'fixe') return `• **${p.nom}** : bonus fixe de **${p.montant_defaut} DH**.`;
      const conds = (p.conditions || []).map(c => `si ${p.metric_key || p.nom} ≥ ${c.seuil} → **+${c.montant} DH**`).join(', ');
      return `• **${p.nom}** : ${conds || 'aucune condition'}.`;
    }).join('\n');
    blocks.push({
      title: '6. Primes additionnelles',
      text: `En toute fin de calcul, les bonus suivants sont ajoutés :\n${bonus}`
    });
  }

  return blocks;
}

