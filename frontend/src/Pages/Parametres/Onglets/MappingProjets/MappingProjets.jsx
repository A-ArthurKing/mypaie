import { useState, useEffect } from 'react'
import ConfirmationModal from '../../../../Components/ConfirmationModal/ConfirmationModal'
import './MappingProjets.css'

// Utilisation du proxy Vite (pas de port hardcodé)
const API_BASE_URL = '/api'

function MappingProjets() {
  const [mappings, setMappings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // States pour le formulaire
  const [sourceName, setSourceName] = useState('')
  const [standardName, setStandardName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)

  const fetchMappings = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/parametres/mapping-projets`)
      if (!response.ok) throw new Error('Erreur lors du chargement des mappings')
      const data = await response.json()
      setMappings(data.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMappings()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!sourceName.trim() || !standardName.trim()) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`${API_BASE_URL}/parametres/mapping-projets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_name: sourceName.trim(),
          standard_name: standardName.trim()
        })
      })

      if (!response.ok) throw new Error('Erreur lors de la sauvegarde')
      
      // Réinitialiser le formulaire et recharger la liste
      setSourceName('')
      setStandardName('')
      await fetchMappings()
    } catch (err) {
      alert(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (item) => {
    setSourceName(item.source_name)
    setStandardName(item.standard_name)
    // On scroll vers le formulaire pour que l'utilisateur voie qu'il est en mode édition
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
      const response = await fetch(`${API_BASE_URL}/parametres/mapping-projets/${encodeURIComponent(itemToDelete.source_name)}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Erreur lors de la suppression')
      
      // Mettre à jour l'état local directement
      setMappings(prev => prev.filter(m => m.source_name !== itemToDelete.source_name))
    } catch (err) {
      alert(err.message)
    } finally {
      setItemToDelete(null)
    }
  }

  return (
    <div className="mapping-projets">
      <div className="mapping-header">
        <h2 className="mapping-title">Mapping des Projets</h2>
        <p className="mapping-desc">
          Associez les noms bruts issus de BigQuery (ex: "PV_SE", "PVSE") à un nom standard unifié (ex: "PV SE").
          Cela permet de consolider les données dans le module de Performance.
        </p>
      </div>

      <div className="mapping-content">
        <div className="mapping-form-card">
          <h3 className="card-title">Ajouter / Modifier un mapping</h3>
          <form className="mapping-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="sourceName">Nom source (brut)</label>
              <input
                id="sourceName"
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="Ex: PV_SE"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="standardName">Nom standard (unifié)</label>
              <input
                id="standardName"
                type="text"
                value={standardName}
                onChange={(e) => setStandardName(e.target.value)}
                placeholder="Ex: PV SE"
                required
              />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isSubmitting || !sourceName.trim() || !standardName.trim()}
            >
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        </div>

        <div className="mapping-list-card">
          <h3 className="card-title">Mappings actifs ({mappings.length})</h3>
          
          {loading && <div className="loading-state">Chargement des données...</div>}
          {error && <div className="error-state"><i className="fa-solid fa-triangle-exclamation" /> {error}</div>}
          
          {!loading && !error && mappings.length === 0 && (
            <div className="empty-state">Aucun mapping configuré pour le moment.</div>
          )}

          {!loading && !error && mappings.length > 0 && (
            <div className="table-responsive">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>Nom brut (Source)</th>
                    <th>Nom standard</th>
                    <th className="action-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((item) => (
                    <tr key={item.source_name}>
                      <td className="source-col"><code>{item.source_name}</code></td>
                      <td className="standard-col"><strong>{item.standard_name}</strong></td>
                      <td className="action-col">
                        <button 
                          className="btn-icon btn-edit" 
                          onClick={() => handleEdit(item)}
                          title="Modifier"
                          style={{ marginRight: '8px' }}
                        >
                          <i className="fa-solid fa-pen" />
                        </button>
                        <button 
                          className="btn-icon btn-delete" 
                          onClick={() => handleDelete(item)}
                          title="Supprimer"
                        >
                          <i className="fa-solid fa-trash-can" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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

export default MappingProjets