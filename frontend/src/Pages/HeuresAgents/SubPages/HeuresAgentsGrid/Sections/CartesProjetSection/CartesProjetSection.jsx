/*
 * Fichier : CartesProjetSection.jsx
 * Rôle    : Section affichant les données d'heures agrégées par projet sous forme de cartes.
 *           Regroupe les lignes brutes par projet et calcule les totaux par agent.
 * Module  : mypaie / Pages / HeuresAgents / Sections
 */

// #region IMPORTS
import { useMemo } from 'react'
import CarteProjet from '../../../../Components/CarteProjet/CarteProjet'
import './CartesProjetSection.css'
// #endregion

// #region COMPOSANT
function CartesProjetSection({ lignes = [], loading = false, erreur = null, onSelectProjet }) {

  // #region AGREGATION
  // Regroupement des lignes par projet et somme des heures par agent
  const projets = useMemo(() => {
    const map = {}

    for (const ligne of lignes) {
      const proj = ligne.projet ?? '(Sans projet)'
      if (!map[proj]) map[proj] = {}

      const mat = ligne.matricule ?? '__inconnu__'
      if (!map[proj][mat]) {
        map[proj][mat] = {
          matricule: ligne.matricule,
          LastName:  ligne.LastName,
          FirstName: ligne.FirstName,
          Equipe:    ligne.Equipe,
          heure_ht:    0,
          heure_hp:    0,
          heure_hc:    0,
          heure_hf:    0,
          heure_total: 0,
        }
      }

      map[proj][mat].heure_ht    += Number(ligne.heure_ht)    || 0
      map[proj][mat].heure_hp    += Number(ligne.heure_hp)    || 0
      map[proj][mat].heure_hc    += Number(ligne.heure_hc)    || 0
      map[proj][mat].heure_hf    += Number(ligne.heure_hf)    || 0
      map[proj][mat].heure_total += Number(ligne.heure_total) || 0
    }

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b, 'fr'))
      .map(([projet, agentsMap]) => {
        const agents = Object.values(agentsMap)
          .sort((a, b) => (a.LastName ?? '').localeCompare(b.LastName ?? '', 'fr'))
        const totalHt     = agents.reduce((s, a) => s + a.heure_ht,    0)
        const totalHp     = agents.reduce((s, a) => s + a.heure_hp,    0)
        const totalHeures = agents.reduce((s, a) => s + a.heure_total, 0)
        return { projet, agents, totalHt, totalHp, totalHeures }
      })
  }, [lignes])
  // #endregion

  // #region RENDERING

  if (erreur) {
    return (
      <div className="ha-etat ha-etat--erreur">
        <i className="fa-solid fa-circle-exclamation ha-etat__icon" aria-hidden="true" />
        <span className="ha-etat__message">{erreur}</span>
      </div>
    )
  }

  if (projets.length === 0 && !loading) {
    return (
      <div className="ha-etat">
        <i className="fa-solid fa-folder-open ha-etat__icon" aria-hidden="true" />
        <span className="ha-etat__message">Aucun projet trouvé pour cette période.</span>
      </div>
    )
  }

  return (
    <div className="cartes-projet-grid">
      {projets.map(p => (
        <CarteProjet
          key={p.projet}
          projet={p.projet}
          agents={p.agents}
          totalHt={p.totalHt}
          totalHp={p.totalHp}
          totalHeures={p.totalHeures}
          onSelect={onSelectProjet}
        />
      ))}
    </div>
  )
  // #endregion
}
// #endregion

export default CartesProjetSection
