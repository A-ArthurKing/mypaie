/*
 * Fichier : CreateRegleModal.jsx
 * Rôle    : Modal de création, duplication et édition d'une règle de primes
 *           avec sélection de la structure, de la périodicité et du statut.
 * Dépend  : SocketContext, ToastContext, CreateRegleModal.css
 * Module  : mypaie / Pages / ReglesPrimes / Components
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../../../../Shared/Contexts/ToastContext';
import './CreateRegleModal.css';

export default function CreateRegleModal({ onClose, onCreated, regleToEdit, regleToDuplicate }) {
  const [formData, setFormData] = useState({
    nom: regleToEdit?.nom || (regleToDuplicate ? `${regleToDuplicate.nom} (Copie)` : ''),
    id_structure: regleToEdit?.id_structure || regleToDuplicate?.id_structure || '',
    periodicite: regleToEdit?.periodicite || regleToDuplicate?.periodicite || 'mensuelle',
    description: regleToEdit?.description || regleToDuplicate?.description || '',
    grille_objectifs: regleToDuplicate?.grille_objectifs || null
  });

  const socket = useSocket();
  const addToast = useToast();

  // États pour les sélections individuelles (UI uniquement pour trouver l'id_structure)
  const [selections, setSelections] = useState({
    projet_id: '',
    id_operation: '',
    id_file: '',
    id_activite: ''
  });

  const [refs, setReferences] = useState({
    projets: [],
    operations: [],
    files: [],
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
                id_file: String(mapped.id_file || ''),
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
  const fileId   = Number(selections.id_file)      || 0;
  const activId  = Number(selections.id_activite)  || 0;

  // Cascade : Opérations disponibles pour le projet sélectionné
  const filteredOperations = useMemo(() => {
    if (!projId) return [];
    const opIds = new Set(
      refs.structure
        .filter(s => s.id_projet === projId)
        .map(s => s.id_operation)
    );
    return refs.operations.filter(o => opIds.has(o.id));
  }, [refs.structure, refs.operations, projId]);

  // Cascade : Files disponibles pour le projet + opération sélectionnés
  const filteredFiles = useMemo(() => {
    if (!projId || !opId) return [];
    const fileIds = new Set(
      refs.structure
        .filter(s => s.id_projet === projId && s.id_operation === opId && s.id_file !== null)
        .map(s => s.id_file)
    );
    return refs.files.filter(f => fileIds.has(f.id));
  }, [refs.structure, refs.files, projId, opId]);

  // Cascade : Activités disponibles pour projet + opération (+ file si sélectionné)
  const filteredActivites = useMemo(() => {
    if (!projId || !opId) return [];
    const actIds = new Set(
      refs.structure
        .filter(s =>
          s.id_projet === projId &&
          s.id_operation === opId &&
          (fileId ? s.id_file === fileId : true) &&
          s.id_activite !== null
        )
        .map(s => s.id_activite)
    );
    return refs.activites.filter(a => actIds.has(a.id));
  }, [refs.structure, refs.activites, projId, opId, fileId]);

  const handleSelectionChange = (e) => {
    const { name, value } = e.target;
    const newSelections = { ...selections, [name]: value };
    
    // Reset les enfants si le parent change
    if (name === 'projet_id')    { newSelections.id_operation = ''; newSelections.id_file = ''; newSelections.id_activite = ''; }
    if (name === 'id_operation') { newSelections.id_file = ''; newSelections.id_activite = ''; }
    if (name === 'id_file')      { newSelections.id_activite = ''; }

    setSelections(newSelections);

    // Trouver l'id_structure correspondant à la combinaison actuelle (comparaison entiers)
    const nProjId  = Number(newSelections.projet_id)   || 0;
    const nOpId    = Number(newSelections.id_operation) || 0;
    const nFileId  = Number(newSelections.id_file)      || 0;
    const nActId   = Number(newSelections.id_activite)  || 0;

    const match = refs.structure.find(s =>
      s.id_projet   === nProjId &&
      s.id_operation === nOpId &&
      (s.id_file     ?? 0) === nFileId &&
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

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
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
              <select id="projet_id" name="projet_id" value={selections.projet_id} onChange={handleSelectionChange}>
                <option value="">-- Sélectionner un projet ({refs.projets.length} disponible(s)) --</option>
                {refs.projets.map(p => <option key={p.id} value={p.id}>{p.libelle}</option>)}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="id_operation">
                  Opération {!selections.projet_id && <span style={{color:'var(--color-text-muted)',fontWeight:'normal'}}>(sélectionner Projet d'abord)</span>}
                </label>
                <select 
                  id="id_operation" 
                  name="id_operation" 
                  value={selections.id_operation} 
                  onChange={handleSelectionChange}
                  disabled={!selections.projet_id}
                >
                  <option value="">-- {filteredOperations.length} opération(s) --</option>
                  {filteredOperations.map(o => <option key={o.id} value={o.id}>{o.libelle}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="id_file">
                  File {!selections.id_operation && <span style={{color:'var(--color-text-muted)',fontWeight:'normal'}}>(sélectionner Opération d'abord)</span>}
                </label>
                <select 
                  id="id_file" 
                  name="id_file" 
                  value={selections.id_file} 
                  onChange={handleSelectionChange}
                  disabled={!selections.id_operation}
                >
                  <option value="">-- {filteredFiles.length} file(s) --</option>
                  {filteredFiles.map(f => <option key={f.id} value={f.id}>{f.libelle}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="id_activite">
                  Activité {!selections.id_operation && <span style={{color:'var(--color-text-muted)',fontWeight:'normal'}}>(sélectionner Opération d'abord)</span>}
                </label>
                <select 
                  id="id_activite" 
                  name="id_activite" 
                  value={selections.id_activite} 
                  onChange={handleSelectionChange}
                  disabled={!selections.id_operation}
                >
                  <option value="">-- {filteredActivites.length} activité(s) --</option>
                  {filteredActivites.map(a => <option key={a.id} value={a.id}>{a.libelle}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="periodicite">Périodicité</label>
              <select id="periodicite" name="periodicite" value={formData.periodicite} onChange={handleChange}>
                <option value="mensuelle">Mensuelle</option>
                <option value="trimestrielle">Trimestrielle</option>
                <option value="annuelle">Annuelle</option>
              </select>
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
          </div>

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
