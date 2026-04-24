/*
 * Fichier : NotesQualiteGrid.jsx
 * Rôle    : Vue grille de la qualité — Cartes KPI par projet.
 */

import { useMemo } from 'react'
import CarteProjetQualite from '../../Components/CarteProjetQualite'

function NotesQualiteGrid({ projetsStats, loading, erreur, onSelectProjet }) {
  
  if (erreur) return <div className="nq-grid-error">Erreur: {erreur}</div>

  return (
    <div className="nq-grid">
      {projetsStats.map(stat => (
        <CarteProjetQualite 
          key={stat.projet}
          projet={stat.projet}
          moyenne={stat.moyenne}
          nbEvaluations={stat.nbEvaluations}
          onClick={() => onSelectProjet(stat.projet)}
        />
      ))}
      {projetsStats.length === 0 && !loading && (
        <div className="nq-empty">Aucun projet trouvé pour cette période.</div>
      )}
    </div>
  )
}

export default NotesQualiteGrid
