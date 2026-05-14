/*
 * Fichier : MappingProjets.jsx
 * Rôle    : Onglet « Mapping des projets » — lie les noms bruts de projets BigQuery
 *           aux projets, sous_projets et activités standards de la plateforme.
 * Dépend  : HeaderSection, MappingFormSection, MappingTableSection, SocketContext, ToastContext
 * Module  : mypaie / Pages / GestionStructure / tabs
 */
import { useState, useEffect } from 'react'
import { useToast } from '../../../../Shared/Contexts/ToastContext'
import ConfirmationModal from '../../../../Components/ConfirmationModal/ConfirmationModal'
import HeaderSection from './Sections/HeaderSection/HeaderSection'
import MappingFormSection from './Sections/MappingFormSection/MappingFormSection'
import MappingTableSection from './Sections/MappingTableSection/MappingTableSection'
import { useSocket } from '../../../../Shared/Contexts/SocketContext'
import './MappingProjets.css'

const API_BASE_URL = '/api'

export default function MappingProjets() {
  const addToast = useToast()
  const [mappings, setMappings] = useState([])
  const [projects, setProjects] = useState([])
  const [sous_projets, setSous_projets] = useState([])
  const [activities, setActivities] = useState([])
  const [tables, setTables] = useState([])
  const [columns, setColumns] = useState([])
  const [uniqueValues, setUniqueValues] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingCols, setLoadingColumns] = useState(false)
  const [loadingValues, setLoadingValues] = useState(false)
  const [error, setError] = useState(null)
  
  // States pour le formulaire
  const [sourceTable, setSourceTable] = useState('')
  const [sourceColumn, setSourceColumn] = useState('')
  const [sourceName, setSourceName] = useState('') // Le nom brut choisi
  const [idProjet, setIdProjet] = useState('') // Le projet standard
  const [idFile, setIdSousProjet] = useState('') // Le file associé
  const [idActivite, setIdActivite] = useState('') // L'activité associée
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)
  const socket = useSocket()

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Charger les mappings existants
      const resMappings = await fetch(`${API_BASE_URL}/parametres/mapping-projets`)
      if (!resMappings.ok) throw new Error('Erreur lors du chargement des mappings')
      const dataMappings = await resMappings.json()
      setMappings(dataMappings.data || [])

      // 2. Charger les projets standards, sous_projets, activités et les tables BigQuery
      const [resRefs, resTables] = await Promise.all([
        fetch(`${API_BASE_URL}/parametres/references`),
        fetch(`${API_BASE_URL}/parametres/introspection/tables`)
      ]);

      if (resRefs.ok) {
        const dataRefs = await resRefs.json()
        setProjects(dataRefs.projets || [])
        setSous_projets(dataRefs.sous_projets || [])
        setActivities(dataRefs.activites || [])
      }
      if (resTables.ok) {
        const dataTables = await resTables.json()
        setTables(dataTables.data || [])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Real-time updates
  useEffect(() => {
    if (!socket) return;
    socket.on('mapping_projets_updated', fetchData);
    return () => socket.off('mapping_projets_updated');
  }, [socket]);

  // Charger les colonnes quand la table change
  useEffect(() => {
    if (!sourceTable) {
      setColumns([]);
      setSourceColumn('');
      return;
    }
    setLoadingColumns(true);
    fetch(`${API_BASE_URL}/parametres/introspection/columns?table=${sourceTable}`)
      .then(res => res.json())
      .then(data => {
        setColumns(data.data || []);
        // Auto-sélection si une colonne contient "projet"
        const projCol = (data.data || []).find(c => c.name.toLowerCase().includes('projet'));
        if (projCol) setSourceColumn(projCol.name);
      })
      .catch(err => console.error("Erreur colonnes:", err))
      .finally(() => setLoadingColumns(false));
  }, [sourceTable]);

  // Charger les valeurs uniques quand la colonne change
  useEffect(() => {
    if (!sourceTable || !sourceColumn) {
      setUniqueValues([]);
      return;
    }
    setLoadingValues(true);
    fetch(`${API_BASE_URL}/parametres/introspection/unique-values?table=${sourceTable}&column=${sourceColumn}`)
      .then(res => res.json())
      .then(data => setUniqueValues(data.data || []))
      .catch(err => console.error("Erreur valeurs:", err))
      .finally(() => setLoadingValues(false));
  }, [sourceTable, sourceColumn]);

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!sourceName.trim() || !idProjet) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`${API_BASE_URL}/parametres/mapping-projets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_name: sourceName.trim(),
          id_projet: idProjet,
          id_sous_projet: idFile || null,
          id_activite: idActivite || null,
          description: description.trim()
        })
      })

      if (!response.ok) throw new Error('Erreur lors de la sauvegarde')
      
      setSourceTable('')
      setSourceColumn('')
      setSourceName('')
      setIdProjet('')
      setIdSousProjet('')
      setIdActivite('')
      setDescription('')
      await fetchData()
      addToast('Mapping projet enregistré avec succès', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (item) => {
    setSourceName(item.source_name)
    setIdProjet(item.id_projet)
    setIdSousProjet(item.id_sous_projet || '')
    setIdActivite(item.id_activite || '')
    setDescription(item.description || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = (item) => {
    setItemToDelete(item);
    setShowConfirmModal(true);
  };

  const confirmDelete = async () => {
    setShowConfirmModal(false);
    if (!itemToDelete) return;

    try {
      const response = await fetch(`${API_BASE_URL}/parametres/mapping-projets/${itemToDelete.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Erreur lors de la suppression')
      await fetchData()
      addToast('Mapping supprimé', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setItemToDelete(null)
    }
  }

  return (
    <div className="mp-tab-container">
      <HeaderSection />

      <div className="mp-tab-content">
        <MappingFormSection 
          sourceTable={sourceTable}
          setSourceTable={setSourceTable}
          sourceColumn={sourceColumn}
          setSourceColumn={setSourceColumn}
          sourceName={sourceName}
          setSourceName={setSourceName}
          idProjet={idProjet}
          setIdProjet={setIdProjet}
          idFile={idFile}
          setIdSousProjet={setIdSousProjet}
          idActivite={idActivite}
          setIdActivite={setIdActivite}
          description={description}
          setDescription={setDescription}
          tables={tables}
          columns={columns}
          uniqueValues={uniqueValues}
          projects={projects}
          sous_projets={sous_projets}
          activities={activities}
          isSubmitting={isSubmitting}
          handleSubmit={handleSubmit}
          loadingCols={loadingCols}
          loadingValues={loadingValues}
        />

        <MappingTableSection 
          mappings={mappings}
          loading={loading}
          error={error}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
        />
      </div>
      
      {itemToDelete && (
        <ConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={confirmDelete}
          title="Confirmer la suppression"
          message={`Êtes-vous sûr de vouloir supprimer le mapping pour "${itemToDelete.source_name}" ? Cette action est irréversible.`}
          confirmText="Oui, supprimer"
          cancelText="Annuler"
          type="danger"
        />
      )}
    </div>
  )
}
