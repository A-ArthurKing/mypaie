import { useState, useEffect } from 'react'
import { useToast } from '../../../../Shared/Contexts/ToastContext'
import ConfirmationModal from '../../../../Components/ConfirmationModal/ConfirmationModal'
import HeaderSection from './Sections/HeaderSection/HeaderSection'
import MappingFormSection from './Sections/MappingFormSection/MappingFormSection'
import MappingTableSection from './Sections/MappingTableSection/MappingTableSection'
import QuickAddKpiModal from './Components/QuickAddKpiModal/QuickAddKpiModal'
import { useSocket } from '../../../../Shared/Contexts/SocketContext'
import './MappingKpis.css'

const API_BASE_URL = '/api'

export default function MappingKpis() {
  const addToast = useToast()
  const [mappings, setMappings] = useState([])
  const [kpiRefs, setKpiRefs] = useState({})
  const [projects, setProjects] = useState([])
  const [tables, setTables] = useState([])
  const [columns, setColumns] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingCols, setLoadingColumns] = useState(false)
  const [error, setError] = useState(null)
  
  // States pour le formulaire
  const [univers, setUnivers] = useState('PERF')
  const [sourceTable, setSourceTable] = useState('')
  const [sourceColumn, setSourceColumn] = useState('')
  const [standardKpiCode, setStandardKpiCode] = useState('')
  const [idProjet, setIdProjet] = useState('') 
  const [isFormula, setIsFormula] = useState(false)
  const [formula, setFormula] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)
  const socket = useSocket()

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Charger les mappings existants
      const resMappings = await fetch(`${API_BASE_URL}/parametres/mapping-kpis`)
      if (!resMappings.ok) throw new Error('Erreur lors du chargement des mappings KPI')
      const dataMappings = await resMappings.json()
      setMappings(dataMappings.data || [])

      // 2. Charger les KPIs de référence + Projets
      const resRefs = await fetch(`${API_BASE_URL}/parametres/references`)
      if (resRefs.ok) {
        const dataRefs = await resRefs.json()
        setKpiRefs(dataRefs.kpis || {})
        setProjects(dataRefs.projets || [])
      }

      // 3. Charger les tables BigQuery
      const resTables = await fetch(`${API_BASE_URL}/parametres/introspection/tables`)
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
    
    socket.on('mapping_kpis_updated', () => {
      console.log('[RealTime] Mapping KPIs mis à jour détecté');
      fetch(`${API_BASE_URL}/parametres/mapping-kpis`)
        .then(res => res.json())
        .then(data => setMappings(data.data || []));
    });

    socket.on('kpi_standards_updated', () => {
      console.log('[RealTime] Référentiel KPIs mis à jour');
      fetch(`${API_BASE_URL}/parametres/references`)
        .then(res => res.json())
        .then(data => setKpiRefs(data.kpis || {}));
    });

    return () => {
      socket.off('mapping_kpis_updated');
      socket.off('kpi_standards_updated');
    };
  }, [socket]);

  // Charger les colonnes quand la table change
  useEffect(() => {
    if (!sourceTable) {
      setColumns([]);
      return;
    }
    setLoadingColumns(true);
    fetch(`${API_BASE_URL}/parametres/introspection/columns?table=${sourceTable}`)
      .then(res => res.json())
      .then(data => setColumns(data.data || []))
      .catch(err => console.error("Erreur colonnes:", err))
      .finally(() => setLoadingColumns(false));
  }, [sourceTable]);

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Validation : Table source + (Colonne OU Formule) + KPI Standard
    if (!sourceTable || (!sourceColumn && !isFormula) || (isFormula && !formula.trim()) || !standardKpiCode) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`${API_BASE_URL}/parametres/mapping-kpis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          univers,
          source_table: sourceTable,
          source_column: isFormula ? null : sourceColumn,
          is_formula: isFormula,
          formula: isFormula ? formula : null,
          standard_kpi_code: standardKpiCode,
          id_projet: idProjet || null,
          description: description.trim()
        })
      })

      if (!response.ok) throw new Error('Erreur lors de la sauvegarde')
      
      setSourceTable('')
      setSourceColumn('')
      setStandardKpiCode('')
      setIdProjet('')
      setIsFormula(false)
      setFormula('')
      setDescription('')
      await fetchData()
      addToast('Mapping KPI enregistré avec succès', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (item) => {
    setUnivers(item.univers)
    setSourceTable(item.source_table)
    setIsFormula(!!item.is_formula)
    setFormula(item.formula || '')
    // On attend que les colonnes chargent (via useEffect) puis on mettra la colonne
    // Note: il y a un risque de race condition, mais pour un MVP c'est okay
    setTimeout(() => setSourceColumn(item.source_column), 500)
    setStandardKpiCode(item.standard_kpi_code)
    setIdProjet(item.id_projet || '')
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
      const response = await fetch(`${API_BASE_URL}/parametres/mapping-kpis/${itemToDelete.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Erreur lors de la suppression')
      
      setMappings(prev => prev.filter(m => m.id !== itemToDelete.id))
      addToast('Mapping supprimé', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setItemToDelete(null)
    }
  }

  return (
    <div className="mk-tab-container">
      <HeaderSection />

      <div className="mk-tab-content">
        <MappingFormSection 
          univers={univers}
          setUnivers={setUnivers}
          sourceTable={sourceTable}
          setSourceTable={setSourceTable}
          sourceColumn={sourceColumn}
          setSourceColumn={setSourceColumn}
          standardKpiCode={standardKpiCode}
          setStandardKpiCode={setStandardKpiCode}
          idProjet={idProjet}
          setIdProjet={setIdProjet}
          isFormula={isFormula}
          setIsFormula={setIsFormula}
          formula={formula}
          setFormula={setFormula}
          description={description}
          setDescription={setDescription}
          isSubmitting={isSubmitting}
          handleSubmit={handleSubmit}
          kpiRefs={kpiRefs}
          tables={tables}
          columns={columns}
          loadingCols={loadingCols}
          projects={projects}
          onQuickAdd={() => setShowQuickAdd(true)}
        />

        <MappingTableSection 
          mappings={mappings}
          loading={loading}
          error={error}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
          kpiRefs={kpiRefs}
        />
      </div>

      <QuickAddKpiModal 
        isOpen={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        univers={univers}
      />
      
      {itemToDelete && (
        <ConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={confirmDelete}
          title="Confirmer la suppression"
          message={`Êtes-vous sûr de vouloir supprimer le mapping pour le KPI "${itemToDelete.source_name}" ? Cette action est irréversible.`}
          confirmText="Oui, supprimer"
          cancelText="Annuler"
          type="danger"
        />
      )}
    </div>
  )
}
