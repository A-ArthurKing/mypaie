/*
 * Fichier : CreateRegleModal.jsx
 * Rôle    : Modal de création, duplication et édition d'une règle de primes
 *           avec sélection de la structure, de la périodicité et du statut.
 * Dépend  : SocketContext, ToastContext, CreateRegleModal.css
 * Module  : mypaie / Pages / ReglesPrimes / Components
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useSocket } from '../../../../Shared/Contexts/SocketContext';
import { useToast } from '../../../../Shared/Contexts/ToastContext';
import CustomSelect from '../../../../Shared/CustomSelect/CustomSelect';
import './CreateRegleModal.css';

const MODES_PRORATA = [
  { key: 'jours',   label: 'Par jours ouvrés',      icon: 'fa-solid fa-calendar-day' },
  { key: 'heures',  label: 'Par heures effectuées', icon: 'fa-solid fa-clock' },
  { key: 'aucun',   label: 'Aucun prorata',          icon: 'fa-solid fa-circle-check' },
];

const BASES_HORAIRES = [169, 176, 191];

export default function CreateRegleModal({ onClose, onCreated, regleToEdit, regleToDuplicate }) {
  const existingConfigTemps = regleToEdit?.grille_objectifs?.config_temps
    || regleToDuplicate?.grille_objectifs?.config_temps;

  const [formData, setFormData] = useState({
    nom: regleToEdit?.nom || (regleToDuplicate ? `${regleToDuplicate.nom} (Copie)` : ''),
    id_structure: regleToEdit?.id_structure || regleToDuplicate?.id_structure || '',
    periodicite: regleToEdit?.periodicite || regleToDuplicate?.periodicite || 'mensuelle',
    description: regleToEdit?.description || regleToDuplicate?.description || '',
    grille_objectifs: regleToDuplicate?.grille_objectifs || null
  });

  // ── État local pour la configuration Temps & Prorata ──────────────────────
  const [configTemps, setConfigTemps] = useState({
    jours_ouvres:        existingConfigTemps?.jours_ouvres        ?? 22,
    base_horaire:        existingConfigTemps?.base_horaire        ?? 191,
    mode_prorata:        existingConfigTemps?.mode_prorata        ?? 'jours',
    seuil_minimum_jours: existingConfigTemps?.seuil_minimum_jours ?? null,
  });
  const [showConfigTemps, setShowConfigTemps] = useState(false);

  const socket = useSocket();
  const addToast = useToast();

  // États pour les sélections individuelles (UI uniquement pour trouver l'id_structure)
  const [selections, setSelections] = useState({
    projet_id: '',
    id_operation: '',
    id_sous_projet: '',
    id_activite: ''
  });

  const [refs, setReferences] = useState({
    projets: [],
    operations: [],
    sous_projets: [],
    activites: [],
    statuts: [],
    structure: []
  });

  useEffect(() => {
    const fetchRefs = () => {
      fetch('/api/parametres/references')
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(data => {
          setReferences(data);
          const targetId = regleToEdit?.id_structure || regleToDuplicate?.id_structure;
          if (targetId) {
            const mapped = data.structure.find(s => s.id === targetId);
            if (mapped) {
              setSelections({
                projet_id: String(mapped.id_projet || ''),
                id_operation: String(mapped.id_operation || ''),
                id_sous_projet: String(mapped.id_sous_projet || ''),
                id_activite: String(mapped.id_activite || '')
              });
            }
          }
        })
        .catch(err => {
          console.error("[CreateRegleModal] Erreur fetch /api/parametres/references:", err);
        });
    };

    fetchRefs();

    if (socket) {
      socket.on('structure_updated', fetchRefs);
      return () => socket.off('structure_updated', fetchRefs);
    }
  }, [regleToEdit, regleToDuplicate, socket]);

  // Convertit les sélections string (venant des <select>) en entiers pour comparaison stricte
  const projId   = Number(selections.projet_id)   || 0;
  const opId     = Number(selections.id_operation) || 0;
  const sousProjetId   = Number(selections.id_sous_projet)      || 0;
  const activId  = Number(selections.id_activite)  || 0;

  // Cascade : Sous-projets disponibles pour le projet sélectionné
  const filteredSousProjets = useMemo(() => {
    if (!projId) return [];
    const sousProjetIds = new Set(
      (refs.structure || [])
        .filter(s => s.id_projet === projId && s.id_sous_projet !== null)
        .map(s => s.id_sous_projet)
    );
    return (refs.sous_projets || []).filter(f => sousProjetIds.has(f.id));
  }, [refs.structure, refs.sous_projets, projId]);

  // Cascade : Opérations disponibles pour le projet + sous-projet
  const filteredOperations = useMemo(() => {
    if (!projId) return [];
    const opIds = new Set(
      (refs.structure || [])
        .filter(s => 
          s.id_projet === projId && 
          (sousProjetId ? s.id_sous_projet === sousProjetId : true) && 
          s.id_operation !== null
        )
        .map(s => s.id_operation)
    );
    return (refs.operations || []).filter(o => opIds.has(o.id));
  }, [refs.structure, refs.operations, projId, sousProjetId]);

  // Cascade : Activités disponibles pour projet + sous-projet + opération
  const filteredActivites = useMemo(() => {
    if (!projId || !opId) return [];
    const actIds = new Set(
      (refs.structure || [])
        .filter(s =>
          s.id_projet === projId &&
          (sousProjetId ? s.id_sous_projet === sousProjetId : true) &&
          s.id_operation === opId &&
          s.id_activite !== null
        )
        .map(s => s.id_activite)
    );
    return (refs.activites || []).filter(a => actIds.has(a.id));
  }, [refs.structure, refs.activites, projId, sousProjetId, opId]);

  const handleSelectionChange = (e) => {
    const { name, value } = e.target;
    const newSelections = { ...selections, [name]: value };
    
    // Reset les enfants si le parent change
    if (name === 'projet_id')      { newSelections.id_sous_projet = ''; newSelections.id_operation = ''; newSelections.id_activite = ''; }
    if (name === 'id_sous_projet') { newSelections.id_operation = ''; newSelections.id_activite = ''; }
    if (name === 'id_operation')   { newSelections.id_activite = ''; }

    setSelections(newSelections);

    // Trouver l'id_structure correspondant à la combinaison actuelle (comparaison entiers)
    const nProjId  = Number(newSelections.projet_id)   || 0;
    const nOpId    = Number(newSelections.id_operation) || 0;
    const nsousProjetId  = Number(newSelections.id_sous_projet)      || 0;
    const nActId   = Number(newSelections.id_activite)  || 0;

    const match = (refs.structure || []).find(s =>
      s.id_projet   === nProjId &&
      s.id_operation === nOpId &&
      (s.id_sous_projet     ?? 0) === nsousProjetId &&
      (s.id_activite ?? 0) === nActId
    );
    
    setFormData(prev => ({ ...prev, id_structure: match?.id || '' }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = regleToEdit ? `/api/regles/${regleToEdit.id}` : '/api/regles';
    const method = regleToEdit ? 'PUT' : 'POST';

    // Fusionner config_temps dans grille_objectifs
    const grilleAvecConfig = {
      ...(formData.grille_objectifs || {}),
      config_temps: configTemps,
    };

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...formData, grille_objectifs: grilleAvecConfig }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la sauvegarde');
      }

      if (onCreated) onCreated();
      else onClose();
      // Le toast de succès est géré par le parent (onCreated callback)
    } catch (err) {
      console.error('Erreur API:', err);
      addToast('Impossible de sauvegarder la règle pour le moment.', 'error');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{regleToEdit ? 'Modifier la règle' : 'Créer une nouvelle règle'}</h2>
          <button className="modal-close" onClick={onClose} title="Fermer">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="nom">Nom de la règle *</label>
              <input 
                type="text" 
                id="nom" 
                name="nom" 
                required 
                placeholder="Ex: Prime de productivité" 
                value={formData.nom}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="projet_id">Projet cible</label>
              <CustomSelect id="projet_id" name="projet_id" value={selections.projet_id} onChange={handleSelectionChange} placeholder={`-- Sélectionner un projet (${refs.projets.length} disponible(s)) --`} options={refs.projets.map(p => ({ value: p.id, label: p.libelle }))} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="id_sous_projet">
                  Sous-projet {!selections.projet_id && <span style={{color:'var(--color-text-muted)',fontWeight:'normal'}}>(sélectionner Projet d'abord)</span>}
                </label>
                <CustomSelect id="id_sous_projet" name="id_sous_projet" value={selections.id_sous_projet} onChange={handleSelectionChange} isDisabled={!selections.projet_id} placeholder={`-- ${filteredSousProjets.length} sous-projet(s) --`} options={filteredSousProjets.map(f => ({ value: f.id, label: f.libelle }))} />
              </div>
              <div className="form-group">
                <label htmlFor="id_operation">
                  Opération {!selections.id_sous_projet && <span style={{color:'var(--color-text-muted)',fontWeight:'normal'}}>(sélectionner Sous-projet d'abord)</span>}
                </label>
                <CustomSelect id="id_operation" name="id_operation" value={selections.id_operation} onChange={handleSelectionChange} isDisabled={!selections.id_sous_projet && !selections.projet_id} placeholder={`-- ${filteredOperations.length} opération(s) --`} options={filteredOperations.map(o => ({ value: o.id, label: o.libelle }))} />
              </div>
              <div className="form-group">
                <label htmlFor="id_activite">
                  Activité {!selections.id_operation && <span style={{color:'var(--color-text-muted)',fontWeight:'normal'}}>(sélectionner Opération d'abord)</span>}
                </label>
                <CustomSelect id="id_activite" name="id_activite" value={selections.id_activite} onChange={handleSelectionChange} isDisabled={!selections.id_operation} placeholder={`-- ${filteredActivites.length} activité(s) --`} options={filteredActivites.map(a => ({ value: a.id, label: a.libelle }))} />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="periodicite">Périodicité</label>
              <CustomSelect id="periodicite" name="periodicite" value={formData.periodicite} onChange={handleChange} options={[ { value: "mensuelle", label: "Mensuelle" }, { value: "trimestrielle", label: "Trimestrielle" }, { value: "annuelle", label: "Annuelle" } ]} />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea 
                id="description" 
                name="description" 
                rows="3" 
                placeholder="Description et objectifs de la règle..."
                value={formData.description}
                onChange={handleChange}
              ></textarea>
            </div>

            {/* ── Section Configuration Temps & Prorata ─────────────────── */}
            <div className="crm-config-temps">
              <button
                type="button"
                className="crm-config-temps__toggle"
                onClick={() => setShowConfigTemps(v => !v)}
              >
                <i className="fa-solid fa-clock"></i>
                Configuration Temps &amp; Prorata
                <span className="crm-config-temps__summary">
                  {configTemps.mode_prorata === 'aucun'
                    ? 'Sans prorata'
                    : configTemps.mode_prorata === 'heures'
                    ? `${configTemps.base_horaire} h · par heures`
                    : `${configTemps.jours_ouvres} j · par jours`}
                </span>
                <i className={`fa-solid fa-chevron-${showConfigTemps ? 'up' : 'down'} crm-config-temps__chevron`}></i>
              </button>

              {showConfigTemps && (
                <div className="crm-config-temps__body">

                  {/* Mode prorata */}
                  <div className="crm-ct-field">
                    <label className="crm-ct-label">Mode de calcul du prorata</label>
                    <div className="crm-ct-modes">
                      {MODES_PRORATA.map(m => (
                        <button
                          key={m.key}
                          type="button"
                          className={`crm-ct-mode${configTemps.mode_prorata === m.key ? ' crm-ct-mode--active' : ''}`}
                          onClick={() => setConfigTemps(p => ({ ...p, mode_prorata: m.key }))}
                        >
                          <i className={m.icon}></i> {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Jours ouvrés + Base horaire */}
                  <div className="crm-ct-row">
                    <div className="crm-ct-field">
                      <label className="crm-ct-label">Jours ouvrés du mois</label>
                      <div className="crm-ct-input-group">
                        <input
                          type="number"
                          className="crm-ct-input"
                          min={1}
                          max={31}
                          value={configTemps.jours_ouvres}
                          onChange={e => setConfigTemps(p => ({ ...p, jours_ouvres: parseInt(e.target.value, 10) || 22 }))}
                        />
                        <span className="crm-ct-unit">j</span>
                      </div>
                    </div>

                    {configTemps.mode_prorata === 'heures' && (
                      <div className="crm-ct-field">
                        <label className="crm-ct-label">Base horaire mensuelle</label>
                        <div className="crm-ct-input-group">
                          <div className="crm-ct-presets">
                            {BASES_HORAIRES.map(b => (
                              <button
                                key={b}
                                type="button"
                                className={`crm-ct-preset${configTemps.base_horaire === b ? ' crm-ct-preset--active' : ''}`}
                                onClick={() => setConfigTemps(p => ({ ...p, base_horaire: b }))}
                              >{b} h</button>
                            ))}
                            <input
                              type="number"
                              className="crm-ct-input crm-ct-input--sm"
                              min={1} max={300}
                              placeholder="Autre…"
                              value={BASES_HORAIRES.includes(configTemps.base_horaire) ? '' : configTemps.base_horaire}
                              onChange={e => {
                                const n = parseInt(e.target.value, 10);
                                if (!isNaN(n) && n > 0) setConfigTemps(p => ({ ...p, base_horaire: n }));
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Seuil minimum */}
                  <div className="crm-ct-field crm-ct-field--seuil">
                    <label className="crm-ct-label">
                      <input
                        type="checkbox"
                        checked={configTemps.seuil_minimum_jours !== null}
                        onChange={e => setConfigTemps(p => ({
                          ...p,
                          seuil_minimum_jours: e.target.checked ? 15 : null
                        }))}
                        style={{ marginRight: '6px' }}
                      />
                      Seuil minimum de présence
                    </label>
                    {configTemps.seuil_minimum_jours !== null && (
                      <div className="crm-ct-input-group" style={{ marginTop: '6px' }}>
                        <input
                          type="number"
                          className="crm-ct-input"
                          min={1}
                          max={31}
                          value={configTemps.seuil_minimum_jours}
                          onChange={e => setConfigTemps(p => ({ ...p, seuil_minimum_jours: parseInt(e.target.value, 10) || 1 }))}
                        />
                        <span className="crm-ct-unit">j minimum pour obtenir la prime</span>
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>

          </div>{/* /.modal-body */}

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-submit">
              {regleToEdit ? 'Enregistrer les modifications' : 'Créer la règle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
