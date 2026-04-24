/*
 * Fichier : HeuresAgentsGrid.jsx
 * Rôle    : Vue principale (Grille) — Filtres + Cartes KPI.
 * Module  : mypaie / Pages / HeuresAgents / SubPages
 */

import { useNavigate } from 'react-router-dom'
import FiltresSection from './Sections/FiltresSection/FiltresSection'
import CartesProjetSection from './Sections/CartesProjetSection/CartesProjetSection'

function HeuresAgentsGrid({ lignes, total, loading, erreur, equipes, projets, filtresDefaut, appliquerFiltres }) {
  const navigate = useNavigate()

  return (
    <>
      <FiltresSection
        equipes={equipes}
        projets={projets}
        onApply={appliquerFiltres}
        loading={loading}
        defaultDateDebut={filtresDefaut.dateDebut}
        defaultDateFin={filtresDefaut.dateFin}
      />

      <div className="ha-statut">
        {!loading && (
          <span>
            {total > 0
              ? <><span className="ha-statut__count">{total.toLocaleString('fr-FR')}</span> ligne(s) chargée(s)</>
              : 'Aucun résultat'}
          </span>
        )}
      </div>

      <CartesProjetSection
        lignes={lignes}
        loading={loading}
        erreur={erreur}
        onSelectProjet={(projet) => navigate(encodeURIComponent(projet))}
      />
    </>
  )
}

export default HeuresAgentsGrid
