import { useState, useEffect } from 'react'
import ConfirmationModal from '../../../../Components/ConfirmationModal/ConfirmationModal'
import './MappingKpis.css'

const API_BASE_URL = '/api'

export default function MappingKpis() {
  const [mappings, setMappings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // States pour le formulaire
  const [sourceName, setSourceName] = useState('')
  const [standardName, setStandardName] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)

  const fetchMappings = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/parametres/mapping-kpis`)
      if (!response.ok) throw new Error('Erreur lors du chargement des mappings KPI')
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
      const response = await fetch(`${API_BASE_URL}/parametres/mapping-kpis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_name: sourceName.trim(),
          standard_name: standardName.trim(),
          description: description.trim()
        })
      })

      if (!response.ok) throw new Error('Erreur lors de la sauvegarde')
      
      // Réinitialiser le formulaire et recharger la liste
      setSourceName('')
      setStandardName('')
      setDescription('')
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
      const response = await fetch(`${API_BASE_URL}/parametres/mapping-kpis/${encodeURIComponent(itemToDelete.source_name)}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Erreur lors de la suppression')
      
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
        <h2 className="mapping-title">Mapping des Indicateurs (KPIs)</h2>
        <p className="mapping-desc">
          Associez les noms bruts des indicateurs issus des sources de données (ex: "avg_call_time", "dmt_brut") 
          vers un nom standard unifié (ex: "DMT"). Ce nom standard sera utilisé dans les grilles de primes.
        </p>
      </div>

      <div className="mapping-content">
        <div className="mapping-form-card">
          <h3 className="card-title">Ajouter / Modifier un KPI</h3>
          <form className="mapping-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="sourceName">Nom source (brut)</label>
              <input
                id="sourceName"
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="Ex: avg_call_time"
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
                placeholder="Ex: DMT"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Durée Moyenne de Traitement"
                rows="2"
                style={{ width: '100%', padding: '0.5rem 0.6rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', resize: 'vertical' }}
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
          <h3 className="card-title">KPIs mappés ({mappings.length})</h3>
          
          {loading && <div className="loading-state">Chargement des données...</div>}
          {error && <div className="error-state"><i className="fa-solid fa-triangle-exclamation" /> {error}</div>}
          
          {!loading && !error && mappings.length === 0 && (
            <div className="empty-state">Aucun KPI mappé pour le moment.</div>
          )}

          {!loading && !error && mappings.length > 0 && (
            <div className="table-responsive">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>KPI Source</th>
                    <th>KPI Standard</th>
                    <th>Description</th>
                    <th className="action-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((item) => (
                    <tr key={item.source_name}>
                      <td className="source-col"><code>{item.source_name}</code></td>
                      <td className="standard-col"><strong>{item.standard_name}</strong></td>
                      <td>{item.description || <span style={{color: 'var(--color-text-muted)', fontStyle: 'italic'}}>—</span>}</td>
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
          message={`Êtes-vous sûr de vouloir supprimer le mapping pour le KPI "${itemToDelete.source_name}" ? Cette action est irréversible.`}
          confirmText="Oui, supprimer"
          cancelText="Annuler"
          type="danger"
        />
      )}
    </div>
  )
}
