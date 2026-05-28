/*
 * Fichier : GrilleEditorModal.jsx
 * Rôle    : Modal d'édition d'une grille de notation — configuration des paliers,
 *           couleurs et seuils de déclenchement via Socket.IO.
 * Dépend  : SocketContext, GrilleEditorModal.css
 * Module  : mypaie / Pages / ReglesPrimes / SubPages / RegleDetail / ObjectifsOnglet
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useSocket } from '../../../../../../../../Shared/Contexts/SocketContext';
import KpiInfoModal from '../../../../../../../../Components/KpiInfoModal/KpiInfoModal';

// Sous-composants par étapes
import Step1Statuts from './Steps/Step1Statuts/Step1Statuts';
import Step2Indicateurs from './Steps/Step2Indicateurs/Step2Indicateurs';
import Step3Valeurs from './Steps/Step3Valeurs/Step3Valeurs';
import Step4Paliers from './Steps/Step4Paliers/Step4Paliers';
import Step5ReglesSpeciales from './Steps/Step5ReglesSpeciales/Step5ReglesSpeciales';
import Step6Prorata from './Steps/Step6Prorata/Step6Prorata';

import './GrilleEditorModal.css';

// Palette partagée
const COULEURS_DISPONIBLES = ['#f87171', '#fb923c', '#f59e0b', '#a3e635', '#38bdf8', '#818cf8', '#22c55e'];

const DEFAULT_PALIERS_MODAL = [
  { id: 1, label: 'Insuffisant', seuil_atteinte: 70,   pourcentage_paiement: 0,   couleur: '#f87171', locked: false },
  { id: 2, label: 'Partiel',     seuil_atteinte: 85,   pourcentage_paiement: 50,  couleur: '#f59e0b', locked: false },
  { id: 3, label: 'Correct',     seuil_atteinte: 100,  pourcentage_paiement: 75,  couleur: '#38bdf8', locked: false },
  { id: 4, label: 'Atteint',     seuil_atteinte: null, pourcentage_paiement: 100, couleur: '#22c55e', locked: false },
];

export default function GrilleEditorModal({ isOpen, onClose, onSave, initialData, projet }) {
  const [activeStep, setActiveStep] = useState(1); 
  const [kpiRefs, setKpiRefs] = useState({});
  const [isLoadingRefs, setIsLoadingRefs] = useState(false);
  const [kpiInfoModal, setKpiInfoModal] = useState({ isOpen: false, data: null });
  const socket = useSocket();
  const [data, setData] = useState({
    categories: [],
    indicateurs: [],
    statuts: [],
    paliers: [],
    primes_additionnelles: [] 
  });
  const [configTemps, setConfigTemps] = useState({
    mode_prorata: 'jours',
    jours_ouvres: 22,
    base_horaire: 191,
    seuil_minimum_jours: null,
  });

  useEffect(() => {
    // Charger les KPIs de référence (Standards + Gold BigQuery)
    const fetchRefs = async () => {
      if (!isOpen) return;
      setIsLoadingRefs(true);
      try {
        console.log('[GrilleEditorModal] Chargement des KPIs pour projet:', projet);
        const [resRefs, resGold] = await Promise.all([
          fetch('/api/parametres/references'),
          fetch(`/api/parametres/introspection/gold-kpis${projet ? `?projet=${encodeURIComponent(projet)}` : ''}`)
        ]);

        if (!resRefs.ok || !resGold.ok) throw new Error('Erreur API');

        const dRefs = await resRefs.json();
        const dGold = await resGold.json();
        const kpisMerged = { ...(dRefs.kpis || {}) };

        let finalGoldData = dGold?.data || [];
        if (finalGoldData.length === 0 && projet) {
          const resGlobal = await fetch('/api/parametres/introspection/gold-kpis');
          const dGlobal = await resGlobal.json();
          finalGoldData = dGlobal?.data || [];
        }

        finalGoldData.forEach(g => {
          const universKey = `BigQuery ${g.univers} (Brut)`;
          if (!kpisMerged[universKey]) kpisMerged[universKey] = [];
          kpisMerged[universKey].push({
            id: `bq_${g.kpi_code}_${g.projet}`,
            tech_key: g.kpi_code,
            libelle: g.projet ? `[${g.projet}] ${g.kpi_code}` : g.kpi_code,
            univers: g.univers,
            is_bq_raw: true
          });
        });

        setKpiRefs({ 
          ...kpisMerged,
          "SYSTEM": [{ tech_key: 'test_kpi', libelle: 'Test: KPI de secours (Si vide)', univers: 'SYSTEM' }] 
        });
      } catch (e) {
        console.error("Erreur chargement refs KPIs", e);
        // Test hardcoded KPI if error
        setKpiRefs({ "DEBUG": [{ tech_key: 'debug_kpi', libelle: 'DEBUG KPI (API Error)' }] });
      } finally {
        setIsLoadingRefs(false);
      }
    };

    fetchRefs();

    if (socket) {
      const handleUpdate = () => {
        console.log('[RealTime] Mise à jour des références détectée');
        fetchRefs();
      };
      socket.on('kpi_standards_updated', handleUpdate);
      socket.on('mapping_kpis_updated', handleUpdate);
      return () => {
        socket.off('kpi_standards_updated', handleUpdate);
        socket.off('mapping_kpis_updated', handleUpdate);
      };
    }
  }, [socket, projet, isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Enrichir les paliers existants avec couleur/locked s'ils n'en ont pas
        const enrichedPaliers = (initialData.paliers || []).map((p, i) => ({
          couleur: COULEURS_DISPONIBLES[i % COULEURS_DISPONIBLES.length],
          locked: false,
          ...p,
        }));
        setData({
          categories: initialData.categories || [],
          indicateurs: initialData.indicateurs || [],
          statuts: initialData.statuts || [],
          paliers: enrichedPaliers,
          primes_additionnelles: initialData.primes_additionnelles || []
        });
        if (initialData.config_temps) {
          setConfigTemps(initialData.config_temps);
        }
      } else {
        // Mode création : paliers par défaut calqués sur l'Excel
        setData({
          categories: [],
          indicateurs: [],
          statuts: [],
          paliers: DEFAULT_PALIERS_MODAL,
          primes_additionnelles: []
        });
        setActiveStep(1);
      }
    }
  }, [initialData, isOpen]);

  // Somme des poids Bonus/Malus pour anticiper le dépassement de 100 pts
  const totalPoidsBonus = useMemo(() =>
    data.indicateurs
      .filter(i => !i.type_ponderation || i.type_ponderation === 'bonus' || i.type_ponderation === 'malus')
      .reduce((sum, i) => sum + (parseFloat(i.poids) || 0), 0),
    [data.indicateurs]
  );

  /** Retrouve le KPI ref depuis tech_key dans kpiRefs (tous univers) */
  const getKpiRef = (techKey) => {
    if (!techKey) return null;
    const searchKey = String(techKey).toLowerCase();
    for (const group of Object.values(kpiRefs)) {
      const found = group.find(k => String(k.tech_key).toLowerCase() === searchKey);
      if (found) return found;
    }
    return null;
  };

  /** Extrait les noms de colonnes depuis une formule SQL (ex: table.col → col) */
  const getFormulaMetrics = (formula) => {
    if (!formula) return '';
    const cols = formula.match(/\w+\.([\w]+)/g);
    if (cols) return [...new Set(cols.map(c => c.split('.')[1]))].join(', ');
    return formula;
  };

  /** Ouvre KpiInfoModal pour un KPI formule */
  const openFormulaModal = (kpiRef) => {
    if (!kpiRef?.formula) return;
    setKpiInfoModal({
      isOpen: true,
      data: {
        title: kpiRef.libelle || kpiRef.tech_key,
        formula: kpiRef.formula,
        sourceTable: kpiRef.source_db || 'BigQuery (Perf)',
        metrics: getFormulaMetrics(kpiRef.formula),
        description: kpiRef.description || undefined,
      },
    });
  };

  if (!isOpen) return null;

  // --- Gestion des Statuts (Lignes) ---
  const addStatut = () => {
    setData(prev => ({
      ...prev,
      statuts: [...prev.statuts, { nom: '', prime_brute: '', montant_sb: '', cibles: {} }]
    }));
  };

  const removeStatut = (index) => {
    setData(prev => ({
      ...prev,
      statuts: prev.statuts.filter((_, i) => i !== index)
    }));
  };

  const updateStatut = (index, field, value) => {
    const newStatuts = [...data.statuts];
    newStatuts[index][field] = value;
    setData(prev => ({ ...prev, statuts: newStatuts }));
  };

  // --- Gestion des Indicateurs (Colonnes) ---
  const addIndicator = (categoryName = '') => {
    const id = `kpi_${Date.now()}`;
    setData(prev => ({
      ...prev,
      indicateurs: [...prev.indicateurs, { 
        id, 
        nom: '', 
        categorie: categoryName, 
        type: 'entier', 
        poids: 10, 
        metric_key: '',
        type_ponderation: 'bonus',
        direction: 'higher_better',
        mode_prime: 'score_global',
        paliers_valeur: []
      }]
    }));
  };

  const removeIndicator = (id) => {
    setData(prev => ({
      ...prev,
      indicateurs: prev.indicateurs.filter(ind => ind.id !== id)
    }));
  };

  const updateIndicator = (id, field, value) => {
    setData(prev => {
      const newInds = prev.indicateurs.map(ind => {
        if (ind.id !== id) return ind;
        
        const updated = { ...ind, [field]: value };
        
        // Si on change mode_prime, initialiser paliers_valeur si besoin
        if (field === 'mode_prime' && value === 'montant_direct' && !updated.paliers_valeur?.length) {
          updated.paliers_valeur = [{ seuil_min: 0, seuil_max: null, montant: 0, type_montant: 'fixe' }];
        }

        // Si on change la clé métrique, on pré-remplit les autres champs
        if (field === 'metric_key' && value) {
          // Rechercher la métrique dans toutes les catégories du référentiel
          let found = null;
          Object.values(kpiRefs).forEach(group => {
            const m = group.find(k => k.tech_key === value);
            if (m) found = m;
          });

          // Direction par défaut selon la métrique connue
          const KNOWN_LOWER_BETTER = ['dmt', 'tx_mea', 'temps_appel'];
          if (found) {
            updated.nom = found.libelle;
            // Mapping des types d'unités vers les types d'affichage
            if (found.unite === '%') updated.type = 'pourcentage';
            else if (found.unite === 'EUR' || found.unite === 'DH') updated.type = 'devise';
            else updated.type = 'entier';
            // Auto-remplir la direction
            updated.direction = KNOWN_LOWER_BETTER.includes(value) ? 'lower_better' : 'higher_better';
          }
        }
        
        return updated;
      });
      return { ...prev, indicateurs: newInds };
    });
  };

  // --- Gestion des Paliers de Valeur (tranches montant_direct) ---
  const addPalierValeur = (indId) => {
    setData(prev => ({
      ...prev,
      indicateurs: prev.indicateurs.map(ind => {
        if (ind.id !== indId) return ind;
        const existing = ind.paliers_valeur || [];
        const lastMax = existing.length ? existing[existing.length - 1].seuil_max : 0;
        return {
          ...ind,
          paliers_valeur: [
            ...existing,
            { seuil_min: lastMax ?? 0, seuil_max: null, montant: 0, type_montant: 'fixe' }
          ]
        };
      })
    }));
  };

  const removePalierValeur = (indId, pIdx) => {
    setData(prev => ({
      ...prev,
      indicateurs: prev.indicateurs.map(ind =>
        ind.id !== indId ? ind : {
          ...ind,
          paliers_valeur: (ind.paliers_valeur || []).filter((_, i) => i !== pIdx)
        }
      )
    }));
  };

  const updatePalierValeur = (indId, pIdx, field, value) => {
    setData(prev => ({
      ...prev,
      indicateurs: prev.indicateurs.map(ind => {
        if (ind.id !== indId) return ind;
        const updated = [...(ind.paliers_valeur || [])];
        const parsed = (field === 'type_montant')
          ? value
          : (value === '' || value === null ? null : parseFloat(value));
        updated[pIdx] = { ...updated[pIdx], [field]: parsed };
        return { ...ind, paliers_valeur: updated };
      })
    }));
  };

  // --- Gestion des Catégories ---
  const handleAddCategory = (e) => {
    e.preventDefault();
    if (newCatName.trim() && !data.categories.includes(newCatName.trim())) {
      const cat = newCatName.trim();
      setData(prev => ({ ...prev, categories: [...prev.categories, cat] }));
      setNewCatName('');
    }
  };

  const removeCategory = (cat) => {
    setData(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c !== cat),
      // On reset la catégorie des indicateurs qui y étaient rattachés
      indicateurs: prev.indicateurs.map(ind => ind.categorie === cat ? { ...ind, categorie: '' } : ind)
    }));
  };

  // --- Gestion des Cibles (Valeurs de la grille) ---
  const updateCible = (statutIndex, indicatorId, value) => {
    const newStatuts = [...data.statuts];
    if (!newStatuts[statutIndex].cibles) newStatuts[statutIndex].cibles = {};
    newStatuts[statutIndex].cibles[indicatorId] = value;
    setData(prev => ({ ...prev, statuts: newStatuts }));
  };

  const handleFinalSave = () => {
    onSave({ ...data, config_temps: configTemps });
    onClose();
  };

  // --- Gestion des Paliers ---
  const addPalier = () => {
    setData(prev => {
      const sorted = [...prev.paliers].sort((a, b) => (a.seuil_atteinte ?? 999) - (b.seuil_atteinte ?? 999));
      const last = sorted[sorted.length - 1];
      const avantDernier = sorted[sorted.length - 2];
      const newSeuil = avantDernier?.seuil_atteinte ? Math.min(avantDernier.seuil_atteinte + 5, 99) : 90;
      const newPalier = {
        id: Date.now(),
        label: 'Nouveau palier',
        seuil_atteinte: newSeuil,
        pourcentage_paiement: 80,
        couleur: '#818cf8',
        locked: false,
      };
      // Insérer avant le palier "Atteint" verrouillé final
      return {
        ...prev,
        paliers: last?.locked
          ? [...prev.paliers.filter(p => p.id !== last.id), newPalier, last]
          : [...prev.paliers, newPalier],
      };
    });
  };

  const removePalier = (id) => {
    setData(prev => ({
      ...prev,
      paliers: prev.paliers.filter(p => p.id !== id)
    }));
  };

  const updatePalier = (id, field, value) => {
    setData(prev => ({
      ...prev,
      paliers: prev.paliers.map(p => {
        if (p.id !== id) return p;
        // label et couleur sont des strings, les champs seuil/pct sont numériques
        const isString = field === 'label' || field === 'couleur';
        const parsed = isString ? value : (value === '' ? '' : parseFloat(value));
        return { ...p, [field]: parsed };
      })
    }));
  };

  // --- Gestion des Primes Additionnelles ---
  const addExtraPrime = () => {
    const id = `extra_${Date.now()}`;
    setData(prev => ({
      ...prev,
      primes_additionnelles: [...prev.primes_additionnelles, { 
        id, 
        nom: '', 
        type: 'fixe', 
        montant_defaut: 0,
        metric_key: '',
        conditions: [{ seuil: 0, montant: 0 }] 
      }]
    }));
  };

  const addExtraCondition = (primeId) => {
    setData(prev => ({
      ...prev,
      primes_additionnelles: prev.primes_additionnelles.map(p => 
        p.id === primeId ? { ...p, conditions: [...(p.conditions || []), { seuil: 0, montant: 0 }] } : p
      )
    }));
  };

  const updateExtraCondition = (primeId, condIndex, field, value) => {
    setData(prev => ({
      ...prev,
      primes_additionnelles: prev.primes_additionnelles.map(p => {
        if (p.id !== primeId) return p;
        const newConds = [...(p.conditions || [])];
        newConds[condIndex] = { ...newConds[condIndex], [field]: parseFloat(value) || 0 };
        return { ...p, conditions: newConds };
      })
    }));
  };

  const removeExtraCondition = (primeId, condIndex) => {
    setData(prev => ({
      ...prev,
      primes_additionnelles: prev.primes_additionnelles.map(p => 
        p.id === primeId ? { ...p, conditions: p.conditions.filter((_, i) => i !== condIndex) } : p
      )
    }));
  };

  const removeExtraPrime = (id) => {
    setData(prev => ({
      ...prev,
      primes_additionnelles: prev.primes_additionnelles.filter(p => p.id !== id)
    }));
  };

  const updateExtraPrime = (id, field, value) => {
    setData(prev => ({
      ...prev,
      primes_additionnelles: prev.primes_additionnelles.map(p => 
        p.id === id ? { ...p, [field]: value } : p
      )
    }));
  };

  // --- Barre de visualisation des paliers ---
  const renderVisualBar = () => {
    const sorted = [...data.paliers].sort((a, b) => (a.seuil_atteinte ?? 999) - (b.seuil_atteinte ?? 999));
    const segments = sorted.map((p, i) => {
      const min = i === 0 ? 0 : sorted[i - 1].seuil_atteinte;
      const max = p.seuil_atteinte;
      const width = max !== null ? max - min : 15;
      return { ...p, width };
    });
    const total = segments.reduce((acc, s) => acc + s.width, 0);
    return (
      <div className="ps-bar">
        {segments.map(seg => (
          <div
            key={seg.id}
            className="ps-bar__segment"
            style={{ width: `${(seg.width / total) * 100}%`, background: seg.couleur || '#ccc' }}
          >
            <span className="ps-bar__label">{seg.label || '—'}</span>
            <span className="ps-bar__mult">{seg.pourcentage_paiement}%</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="gem-overlay" onClick={onClose}>
      <div className="gem-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gem-header">
          <div className="gem-title-row">
            <h2>Personnaliser la Grille d'Objectifs</h2>
            <button className="gem-btn-close" onClick={onClose} title="Fermer">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div className="gem-step-indicator">
            <span className={activeStep === 1 ? 'active' : ''} onClick={() => setActiveStep(1)}>1. Statuts</span>
            <span className={activeStep === 2 ? 'active' : ''} onClick={() => setActiveStep(2)}>2. Indicateurs</span>
            <span className={activeStep === 3 ? 'active' : ''} onClick={() => setActiveStep(3)}>3. Valeurs</span>
            <span className={activeStep === 4 ? 'active' : ''} onClick={() => setActiveStep(4)}>4. Paliers</span>
            <span className={activeStep === 5 ? 'active' : ''} onClick={() => setActiveStep(5)}>5. Tranches & Règles Spéciales</span>
            <span className={activeStep === 6 ? 'active' : ''} onClick={() => setActiveStep(6)}>6. Prorata & Présence</span>
          </div>
        </div>

        <div className="gem-body">
          {activeStep === 1 && (
            <Step1Statuts 
              statuts={data.statuts}
              onAdd={addStatut}
              onRemove={removeStatut}
              onUpdate={updateStatut}
            />
          )}

          {activeStep === 2 && (
            <Step2Indicateurs 
              categories={data.categories}
              indicateurs={data.indicateurs}
              kpiRefs={kpiRefs}
              isLoading={isLoadingRefs}
              totalPoidsBonus={totalPoidsBonus}
              onAddCategory={(cat) => setData(prev => ({ ...prev, categories: [...prev.categories, cat] }))}
              onRemoveCategory={removeCategory}
              onAddIndicator={addIndicator}
              onRemoveIndicator={removeIndicator}
              onUpdateIndicator={updateIndicator}
              onAddPalierValeur={addPalierValeur}
              onRemovePalierValeur={removePalierValeur}
              onUpdatePalierValeur={updatePalierValeur}
              openFormulaModal={openFormulaModal}
              getKpiRef={getKpiRef}
            />
          )}

          {activeStep === 3 && (
            <Step3Valeurs 
              statuts={data.statuts}
              indicateurs={data.indicateurs}
              getKpiRef={getKpiRef}
              openFormulaModal={openFormulaModal}
              onUpdateCible={updateCible}
            />
          )}

          {activeStep === 4 && (
            <Step4Paliers 
              paliers={data.paliers}
              colors={COULEURS_DISPONIBLES}
              onAdd={addPalier}
              onRemove={removePalier}
              onUpdate={updatePalier}
            />
          )}

          {activeStep === 5 && (
            <Step5ReglesSpeciales 
              primes={data.primes_additionnelles}
              kpiRefs={kpiRefs}
              onAdd={addExtraPrime}
              onRemove={removeExtraPrime}
              onUpdate={updateExtraPrime}
              onAddCondition={addExtraCondition}
              onRemoveCondition={removeExtraCondition}
              onUpdateCondition={updateExtraCondition}
            />
          )}

          {activeStep === 6 && (
            <Step6Prorata 
              config={configTemps}
              onUpdate={setConfigTemps}
            />
          )}
        </div>

        <div className="gem-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i> Annuler
          </button>
          {activeStep > 1 && (
            <button className="btn gem-btn-outline" onClick={() => setActiveStep(activeStep - 1)}>
              <i className="fa-solid fa-arrow-left"></i> Précédent
            </button>
          )}
          {activeStep < 6 ? (
            <button className="btn btn-primary" onClick={() => setActiveStep(activeStep + 1)}>
              Suivant <i className="fa-solid fa-arrow-right"></i>
            </button>
          ) : (
            <button className="btn btn-success" onClick={handleFinalSave}>
              <i className="fa-solid fa-check"></i> Enregistrer la grille
            </button>
          )}
        </div>
      </div>
      <KpiInfoModal
        isOpen={kpiInfoModal.isOpen}
        onClose={() => setKpiInfoModal({ isOpen: false, data: null })}
        data={kpiInfoModal.data}
      />
    </div>
  );
}
