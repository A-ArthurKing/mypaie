/*
 * Fichier : DetailProjetSection.jsx
 * Rôle    : Vue détail d'un projet — tableau complet des agents avec heures agrégées.
 *           Accessible depuis la grille de cartes, bouton retour pour revenir.
 * Module  : mypaie / Pages / HeuresAgents / Sections
 */

// #region IMPORTS
import { useMemo, useState } from 'react'
import './DetailProjetSection.css'
// #endregion

// #region HELPERS
function msEnHeures(ms) {
  if (!ms && ms !== 0) return '—'
  const totalMin = Math.round(Number(ms) / 60000)
  if (isNaN(totalMin)) return '—'
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

const COLONNES = [
  { key: 'matricule',   label: 'Matricule' },
  { key: 'LastName',    label: 'Nom' },
  { key: 'FirstName',   label: 'Prénom' },
  { key: 'Equipe',      label: 'Équipe' },
  { key: 'heure_ht',    label: 'Prévues',    num: true },
  { key: 'heure_hp',    label: 'Travaillées', num: true },
  { key: 'heure_hf',    label: 'H. Form',    num: true },
  { key: 'heure_total', label: 'Total',      num: true, accent: true },
]
// #endregion

// #region COMPOSANT
function DetailProjetSection({ projet, lignes = [], onRetour }) {

  const [triKey, setTriKey]   = useState('LastName')
  const [triDesc, setTriDesc] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [page, setPage] = useState(1)
  const LIGNES_PAR_PAGE = 20

  // Agrégation des lignes brutes du projet par agent
  const agents = useMemo(() => {
    const map = {}
    for (const ligne of lignes) {
      const mat = ligne.matricule ?? '__inconnu__'
      if (!map[mat]) {
        map[mat] = {
          matricule: ligne.matricule,
          LastName:  ligne.LastName,
          FirstName: ligne.FirstName,
          Equipe:    ligne.Equipe,
          heure_ht:    0,
          heure_hp:    0,
          heure_hf:    0,
          heure_total: 0,
        }
      }
      map[mat].heure_ht    += Number(ligne.heure_ht)    || 0
      map[mat].heure_hp    += Number(ligne.heure_hp)    || 0
      map[mat].heure_hf    += Number(ligne.heure_hf)    || 0
      map[mat].heure_total += Number(ligne.heure_total) || 0
    }
    return Object.values(map)
  }, [lignes])

  // Filtrage par recherche
  const agentsFiltrés = useMemo(() => {
    if (recherche.trim().length < 3) return agents
    const search = recherche.toLowerCase()
    return agents.filter(a => 
      String(a.matricule ?? '').toLowerCase().includes(search) ||
      String(a.LastName ?? '').toLowerCase().includes(search) ||
      String(a.FirstName ?? '').toLowerCase().includes(search) ||
      String(a.Equipe ?? '').toLowerCase().includes(search)
    )
  }, [agents, recherche])

  // Tri côté client
  const agentsTries = useMemo(() => {
    return [...agentsFiltrés].sort((a, b) => {
      const va = a[triKey] ?? ''
      const vb = b[triKey] ?? ''
      if (va < vb) return triDesc ? 1 : -1
      if (va > vb) return triDesc ? -1 : 1
      return 0
    })
  }, [agentsFiltrés, triKey, triDesc])

  // Pagination
  const nbPages = Math.ceil(agentsTries.length / LIGNES_PAR_PAGE)
  const agentsPagines = useMemo(() => {
    const debut = (page - 1) * LIGNES_PAR_PAGE
    return agentsTries.slice(debut, debut + LIGNES_PAR_PAGE)
  }, [agentsTries, page])

  // Totaux de pied de tableau
  const totaux = useMemo(() => ({
    heure_ht:    agentsFiltrés.reduce((s, a) => s + a.heure_ht,    0),
    heure_hp:    agentsFiltrés.reduce((s, a) => s + a.heure_hp,    0),
    heure_hf:    agentsFiltrés.reduce((s, a) => s + a.heure_hf,    0),
    heure_total: agentsFiltrés.reduce((s, a) => s + a.heure_total, 0),
  }), [agentsFiltrés])

  function handleTri(key) {
    if (triKey === key) setTriDesc(d => !d)
    else { setTriKey(key); setTriDesc(false) }
    setPage(1) // Reset page on sort
  }

  function handleRecherche(val) {
    setRecherche(val)
    setPage(1) // Reset page on search
  }

  return (
    <div className="detail-projet">

      {/* ── Barre de navigation retour ── */}
      <div className="detail-projet__nav">
        <button className="detail-projet__retour" onClick={onRetour} type="button">
          <i className="fa-solid fa-arrow-left" aria-hidden="true" />
          Retour aux projets
        </button>
        
        <div className="detail-projet__search-bar">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          <input 
            type="text" 
            placeholder="Rechercher (Nom, Matricule, Équipe...)" 
            value={recherche}
            onChange={(e) => handleRecherche(e.target.value)}
          />
          {recherche && (
            <button className="detail-projet__search-clear" onClick={() => handleRecherche('')}>
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="detail-projet__breadcrumb">
          <i className="fa-solid fa-folder-open" aria-hidden="true" />
          <span>{projet}</span>
          <span className="detail-projet__breadcrumb-sep">·</span>
          <span className="detail-projet__breadcrumb-count">{agentsFiltrés.length} agent(s)</span>
        </div>
      </div>

      {/* ── Tableau des agents ── */}
      <div className="detail-projet__table-wrapper">
        <table className="detail-projet__table">
          <thead>
            <tr>
              {COLONNES.map(col => (
                <th
                  key={col.key}
                  className={[
                    col.num ? 'dp-th--num' : '',
                    triKey === col.key ? 'sorted' : '',
                  ].join(' ')}
                  onClick={() => handleTri(col.key)}
                >
                  {col.label}
                  {triKey === col.key
                    ? <i className={`fa-solid ${triDesc ? 'fa-sort-down' : 'fa-sort-up'} dp-sort-icon`} aria-hidden="true" />
                    : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agentsPagines.map(agent => (
              <tr key={agent.matricule ?? agent.LastName}>
                <td className="dp-td--muted">{agent.matricule ?? '—'}</td>
                <td>{agent.LastName ?? '—'}</td>
                <td>{agent.FirstName ?? '—'}</td>
                <td className="dp-td--muted">{agent.Equipe ?? '—'}</td>
                <td className="dp-td--num">{msEnHeures(agent.heure_ht)}</td>
                <td className="dp-td--num">{msEnHeures(agent.heure_hp)}</td>
                <td className="dp-td--num">{msEnHeures(agent.heure_hf)}</td>
                <td className="dp-td--num dp-td--accent">{msEnHeures(agent.heure_total)}</td>
              </tr>
            ))}
            {agentsPagines.length === 0 && (
              <tr>
                <td colSpan={COLONNES.length} className="dp-td--empty">
                  Aucun agent trouvé pour cette recherche
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="detail-projet__tfoot">
              <td colSpan={4} className="dp-tfoot--label">
                <i className="fa-solid fa-sigma" aria-hidden="true" /> Total
              </td>
              <td className="dp-td--num dp-tfoot--val">{msEnHeures(totaux.heure_ht)}</td>
              <td className="dp-td--num dp-tfoot--val">{msEnHeures(totaux.heure_hp)}</td>
              <td className="dp-td--num dp-tfoot--val">{msEnHeures(totaux.heure_hf)}</td>
              <td className="dp-td--num dp-tfoot--val dp-td--accent">{msEnHeures(totaux.heure_total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Pagination ── */}
      {nbPages > 1 && (
        <div className="detail-projet__pagination">
          <button 
            className="dp-pagination__btn" 
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            <i className="fa-solid fa-chevron-left" aria-hidden="true" />
          </button>
          
          <div className="dp-pagination__info">
            Page <strong>{page}</strong> sur {nbPages}
          </div>

          <button 
            className="dp-pagination__btn" 
            disabled={page === nbPages}
            onClick={() => setPage(p => p + 1)}
          >
            <i className="fa-solid fa-chevron-right" aria-hidden="true" />
          </button>
        </div>
      )}

    </div>
  )
}
// #endregion

export default DetailProjetSection
