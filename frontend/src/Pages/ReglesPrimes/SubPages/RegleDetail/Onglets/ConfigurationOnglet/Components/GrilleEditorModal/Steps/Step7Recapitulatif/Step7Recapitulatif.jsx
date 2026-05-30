/*
 * Fichier : Step7Recapitulatif.jsx
 * Rôle    : Étape 7 du GrilleEditorModal - Récapitulatif auto-généré de la grille.
 *           Synthèse de toute la configuration en :
 *             - Formule algorithmique (pseudo-code)
 *             - Explication en langage naturel
 */
import React, { useMemo, useState } from 'react';
import './Step7Recapitulatif.css';

const KPI_LABELS = {
  abs_injustifie: 'absences injustifiées',
  abs_justifie:   'absences justifiées',
  retard:         'retards',
  cp_css:         'congés payés (CNSS)',
};

// ── Générateur de formule algorithmique (pseudo-code) ──────────────────────
function buildFormuleAlgo(data, configTemps) {
  const { indicateurs = [], statuts = [], paliers = [], primes_additionnelles = [] } = data;
  const {
    mode_prorata    = 'aucun',
    jours_ouvres    = 22,
    base_horaire    = 191,
    seuil_minimum_jours,
    malus_assiduite = [],
  } = configTemps;

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

  lines.push({ type: 'blank' });
  lines.push({ type: 'result', text: `RETOURNE prime_finale` });

  return lines;
}

// ── Générateur langage naturel ─────────────────────────────────────────────
function buildFormuleHumain(data, configTemps) {
  const { indicateurs = [], statuts = [], paliers = [], primes_additionnelles = [] } = data;
  const {
    mode_prorata    = 'aucun',
    jours_ouvres    = 22,
    base_horaire    = 191,
    seuil_minimum_jours,
    malus_assiduite = [],
  } = configTemps;

  const parts = [];
  let step = 1;

  // Statuts
  if (statuts.length > 0) {
    const statutsStr = statuts.map(s => `${s.nom} (${s.prime_brute} DH)`).join(', ');
    parts.push({
      step: step++,
      titre: 'Identification du niveau',
      icon: 'fa-solid fa-user-tag',
      texte: `Le système identifie automatiquement le niveau hiérarchique de chaque agent depuis la base RH. Selon son profil, sa prime brute de référence sera : ${statutsStr}.`,
    });
  }

  // Indicateurs
  if (indicateurs.length > 0) {
    const indsScore   = indicateurs.filter(i => !i.mode_prime || i.mode_prime === 'score_global');
    const indsMontant = indicateurs.filter(i => i.mode_prime === 'montant_direct');

    // Indicateurs en mode score global
    if (indsScore.length > 0) {
      const totalPoids = indsScore.reduce((s, i) => s + (parseFloat(i.poids) || 0), 0);
      const bonus = indsScore.filter(i => !i.type_ponderation || i.type_ponderation === 'bonus');
      const malus = indsScore.filter(i => i.type_ponderation === 'malus');

      let texte = `${indsScore.length} indicateur(s) contribuent au score global (sur ${totalPoids} pts). `;
      if (bonus.length > 0) {
        texte += `Bonus : ${bonus.map(i => `${i.nom || i.metric_key} (${i.poids} pts, ${i.direction === 'lower_better' ? 'sens décroissant — moins c\'est mieux' : 'sens croissant — plus c\'est mieux'})`).join(' ; ')}. `;
      }
      if (malus.length > 0) {
        texte += `Malus (déduits du score) : ${malus.map(i => `${i.nom || i.metric_key} (${i.poids} pts)`).join(' ; ')}. `;
      }
      const sortedPaliers = [...paliers].sort((a, b) => (a.seuil_atteinte ?? 999) - (b.seuil_atteinte ?? 999));
      if (sortedPaliers.length > 0) {
        texte += `Chaque atteinte KPI est traduite via ${sortedPaliers.length} paliers : de "${sortedPaliers[0].label}" (${sortedPaliers[0].pourcentage_paiement}% versé) à "${sortedPaliers[sortedPaliers.length - 1].label}" (${sortedPaliers[sortedPaliers.length - 1].pourcentage_paiement}% versé).`;
      }
      parts.push({ step: step++, titre: 'Évaluation des KPIs — Score global', icon: 'fa-solid fa-chart-line', texte });
    }

    // Indicateurs en montant direct
    if (indsMontant.length > 0) {
      const texte = indsMontant.map(ind => {
        const label  = ind.nom || ind.metric_key || ind.id;
        const nbrTranches = (ind.paliers_valeur || []).length;
        const tranchesStr = (ind.paliers_valeur || []).map(pv => {
          const borneMax    = pv.seuil_max != null ? pv.seuil_max : '∞';
          const montantStr  = pv.type_montant === 'pourcentage'
            ? `${pv.montant}% de la prime brute`
            : `${pv.montant} DH fixe`;
          return `entre ${pv.seuil_min ?? 0} et ${borneMax} → ${montantStr}`;
        }).join(' ; ');
        return `${label} (${nbrTranches} tranche${nbrTranches > 1 ? 's' : ''}) : ${tranchesStr || '—'}.`;
      }).join(' ');

      parts.push({
        step: step++,
        titre: 'Indicateurs à montant direct (tranches)',
        icon: 'fa-solid fa-table-cells',
        texte: `${indsMontant.length} indicateur(s) versent un montant fixe ou proportionnel selon des tranches de valeur, indépendamment du score global. ${texte}`,
      });
    }
  }

  // Calcul prime
  parts.push({
    step: step++,
    titre: 'Calcul de la prime de base',
    icon: 'fa-solid fa-calculator',
    texte: `La prime brute est multipliée par le score global obtenu (ramené sur 100), pour produire la prime de performance. Un score de 100% verse la prime brute intégralement ; un score de 50% en verse la moitié.`,
  });

  // Malus assiduité
  if (malus_assiduite.length > 0) {
    const rulesStr = malus_assiduite.map(r => {
      const kpiLabel = KPI_LABELS[r.kpi] || r.kpi;
      const effet = r.type === 'total' ? 'la prime est entièrement supprimée' : `la prime est réduite de ${r.malus_pct}%`;
      return `si le nombre de ${kpiLabel} est ${r.operateur} ${r.seuil}, ${effet}`;
    }).join(' ; ');

    parts.push({
      step: step++,
      titre: 'Règles de présence & assiduité',
      icon: 'fa-solid fa-calendar-xmark',
      texte: `L'assiduité peut impacter la prime selon ${malus_assiduite.length} règle(s) configurée(s) : ${rulesStr}. La règle la plus restrictive est appliquée en priorité.`,
    });
  }

  // Prorata
  if (mode_prorata !== 'aucun') {
    let texte = mode_prorata === 'jours'
      ? `La prime obtenue est ramenée au prorata de la présence réelle de l'agent : montant × (jours effectivement travaillés / ${jours_ouvres} jours ouvrés de référence). Les absences et congés réduisent automatiquement le taux.`
      : `La prime est ramenée au prorata des heures réellement pointées par l'agent : montant × (heures réelles / ${base_horaire}h de référence mensuelle).`;

    if (seuil_minimum_jours) {
      texte += ` En dessous de ${seuil_minimum_jours} ${mode_prorata === 'heures' ? 'heures' : 'jours'} de présence, aucune prime n'est versée.`;
    }
    parts.push({ step: step++, titre: 'Prorata de présence', icon: 'fa-solid fa-clock-rotate-left', texte });
  } else {
    parts.push({
      step: step++,
      titre: 'Pas de prorata',
      icon: 'fa-solid fa-circle-check',
      texte: 'La prime est versée en totalité, sans déduction liée au temps de présence ou aux absences.',
    });
  }

  // Primes additionnelles
  if (primes_additionnelles.length > 0) {
    parts.push({
      step: step++,
      titre: 'Primes additionnelles',
      icon: 'fa-solid fa-plus-circle',
      texte: `${primes_additionnelles.length} prime(s) additionnelle(s) peuvent s'ajouter au montant final selon des conditions spécifiques : ${primes_additionnelles.map(p => p.nom || '(sans nom)').join(', ')}.`,
    });
  }

  return parts;
}

// ── Composant principal ─────────────────────────────────────────────────────
export default function Step7Recapitulatif({ data, configTemps }) {
  const [activeTab, setActiveTab] = useState('algo');

  const lignesAlgo   = useMemo(() => buildFormuleAlgo(data, configTemps),   [data, configTemps]);
  const partiesHumain = useMemo(() => buildFormuleHumain(data, configTemps), [data, configTemps]);

  const totalPoids = data.indicateurs.reduce((s, i) => s + (parseFloat(i.poids) || 0), 0);

  const stats = [
    { value: data.statuts.length,                        label: 'Niveau(x)',       icon: 'fa-solid fa-layer-group' },
    { value: data.indicateurs.length,                    label: 'Indicateur(s)',   icon: 'fa-solid fa-chart-bar' },
    { value: totalPoids,                                  label: 'Points total',    icon: 'fa-solid fa-star' },
    { value: data.paliers.length,                        label: 'Palier(s)',       icon: 'fa-solid fa-stairs' },
    { value: configTemps.malus_assiduite?.length || 0,   label: 'Règle(s) présence', icon: 'fa-solid fa-shield-halved' },
    { value: data.primes_additionnelles?.length || 0,    label: 'Bonus additionnel(s)', icon: 'fa-solid fa-gift' },
  ];

  const renderLine = (line, idx) => {
    if (line.type === 'blank') return <div key={idx} className="gr-line gr-line--blank" />;
    const cls = {
      comment: 'gr-line--comment',
      keyword: 'gr-line--keyword',
      assign:  'gr-line--assign',
      danger:  'gr-line--danger',
      warn:    'gr-line--warn',
      result:  'gr-line--result',
      plain:   '',
    }[line.type] || '';
    return (
      <div key={idx} className={`gr-line ${cls}`}>
        {line.type === 'comment' && <span className="gr-token--comment">// </span>}
        <span>{line.text}</span>
      </div>
    );
  };

  return (
    <div className="gem-step gr-wrap">
      <h4 className="gem-mgmt-title">Récapitulatif &amp; Formule</h4>
      <p className="gem-step-desc">
        Voici la formule consolidée générée automatiquement depuis votre configuration — ce que le moteur appliquera exactement lors du calcul des primes.
      </p>

      {/* Stats */}
      <div className="gr-stats">
        {stats.map((s, i) => (
          <div key={i} className="gr-stat">
            <i className={s.icon}></i>
            <span className="gr-stat__value">{s.value}</span>
            <span className="gr-stat__label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="gr-tabs">
        <button
          type="button"
          className={`gr-tab${activeTab === 'algo' ? ' active' : ''}`}
          onClick={() => setActiveTab('algo')}
        >
          <i className="fa-solid fa-code"></i> Formule algorithmique
        </button>
        <button
          type="button"
          className={`gr-tab${activeTab === 'humain' ? ' active' : ''}`}
          onClick={() => setActiveTab('humain')}
        >
          <i className="fa-solid fa-comment-lines"></i> Langage naturel
        </button>
      </div>

      {/* Panneau algo */}
      {activeTab === 'algo' && (
        <div className="gr-code-block">
          <div className="gr-code-header">
            <span className="gr-code-dot" style={{ background: '#f87171' }} />
            <span className="gr-code-dot" style={{ background: '#f59e0b' }} />
            <span className="gr-code-dot" style={{ background: '#22c55e' }} />
            <span className="gr-code-title">formule_calcul_prime.pseudo</span>
          </div>
          <div className="gr-code-body">
            {lignesAlgo.map((line, idx) => renderLine(line, idx))}
          </div>
        </div>
      )}

      {/* Panneau langage naturel */}
      {activeTab === 'humain' && (
        <div className="gr-prose">
          {partiesHumain.map((part) => (
            <div key={part.step} className="gr-prose__item">
              <div className="gr-prose__badge">
                <i className={part.icon}></i>
                <span>{part.step}</span>
              </div>
              <div className="gr-prose__content">
                <strong className="gr-prose__titre">{part.titre}</strong>
                <p className="gr-prose__texte">{part.texte}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
