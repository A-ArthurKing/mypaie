/*
 * Fichier : HeuresAgentsDetail.jsx
 * Rôle    : Vue sous-page (Détail) — Récupère le projet via URL et affiche DetailProjetSection.
 * Module  : mypaie / Pages / HeuresAgents / SubPages
 */

import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DetailProjetSection from './Sections/DetailProjetSection/DetailProjetSection'
import StatsHeures from './Sections/StatsHeures/StatsHeures'
import './HeuresAgentsDetail.css'

function HeuresAgentsDetail({ lignes }) {
  const { projetId } = useParams()
  const navigate = useNavigate()
  
  const decodedProjet = useMemo(() => {
    return projetId ? decodeURIComponent(projetId) : null
  }, [projetId])

  const lignesProjet = useMemo(() => {
    if (!decodedProjet) return []
    return lignes.filter(l => (l.projet ?? '(Sans projet)') === decodedProjet)
  }, [lignes, decodedProjet])

  if (!decodedProjet) return null

  return (
    <div className="ha-detail-container">
      <div className="ha-detail-header">
        <button className="ha-detail-retour" onClick={() => navigate('/heures')} type="button">
          <i className="fa-solid fa-arrow-left" aria-hidden="true" />
          Retour aux projets
        </button>
      </div>

      <StatsHeures lignes={lignesProjet} />
      
      <DetailProjetSection
        projet={decodedProjet}
        lignes={lignesProjet}
      />
    </div>
  )
}

export default HeuresAgentsDetail
