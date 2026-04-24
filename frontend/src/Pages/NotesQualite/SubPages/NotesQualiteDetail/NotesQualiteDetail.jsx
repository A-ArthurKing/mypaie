/*
 * Fichier : NotesQualiteDetail.jsx
 * Rôle    : Vue détail d'un projet qualité — agrégation par agent avec panneau dépliable.
 * Module  : mypaie / Pages / NotesQualite / SubPages
 */

import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ResumeProjet from './Sections/ResumeProjet/ResumeProjet'
import ListeAgents from './Sections/ListeAgents/ListeAgents'
import './NotesQualiteDetail.css'

// Utilitaire : calcule la moyenne d'un tableau de nombres
function moyenne(arr) {
  if (!arr.length) return 0
  return arr.reduce((s, v) => s + Number(v || 0), 0) / arr.length
}

function NotesQualiteDetail({ lignes }) {
  const { projetId } = useParams()
  const navigate = useNavigate()
  const [recherche, setRecherche] = useState('')
  const [agentDeplie, setAgentDeplie] = useState(null)

  const decodedProjet = useMemo(() => projetId ? decodeURIComponent(projetId) : null, [projetId])

  // Filtrage sur le projet courant
  const lignesProjet = useMemo(() => {
    if (!decodedProjet) return []
    return lignes.filter(l => (l.Projet || '(Sans projet)') === decodedProjet)
  }, [lignes, decodedProjet])

  // Calcul du résumé global du projet (Typologies et Sous-Typologies)
  const statsSummary = useMemo(() => {
    if (!lignesProjet.length) return null

    const totalNote = lignesProjet.reduce((acc, l) => acc + Number(l.Note_Sous_Item), 0)
    const itemsMap = new Map()

    for (const l of lignesProjet) {
      const item = l.Item_Global || '(Sans item)'
      const sub = l.Sous_Item || '(Sans sous-item)'
      const note = Number(l.Note_Sous_Item)

      if (!itemsMap.has(item)) {
        itemsMap.set(item, { toutes: [], sousItems: new Map() })
      }
      const itemEntry = itemsMap.get(item)
      itemEntry.toutes.push(note)

      if (!itemEntry.sousItems.has(sub)) {
        itemEntry.sousItems.set(sub, [])
      }
      itemEntry.sousItems.get(sub).push(note)
    }

    return {
      moyenne_globale: totalNote / lignesProjet.length,
      nb_total: lignesProjet.length,
      items: Array.from(itemsMap.entries()).map(([name, data]) => ({
        name,
        moyenne: moyenne(data.toutes),
        sousItems: Array.from(data.sousItems.entries()).map(([subName, subNotes]) => ({
          name: subName,
          moyenne: moyenne(subNotes)
        })).sort((a, b) => a.name.localeCompare(b.name))
      })).sort((a, b) => a.name.localeCompare(b.name))
    }
  }, [lignesProjet])

  // Liste canonique des items du projet (ordre alphabétique, généralement 3 catégories)
  const itemsCanon = useMemo(() => {
    const set = new Set()
    for (const l of lignesProjet) set.add(l.Item_Global || '(Sans item)')
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [lignesProjet])

  // Agrégation par agent : note globale + note par Item_Global + sous-items groupés pour le panneau
  const agentsStats = useMemo(() => {
    const map = new Map()
    for (const l of lignesProjet) {
      const agent = l.Agent || '(Sans agent)'
      if (!map.has(agent)) {
        map.set(agent, { agent, toutes: [], parItem: new Map(), sousItemsParItem: new Map() })
      }
      const entry = map.get(agent)
      entry.toutes.push(Number(l.Note_Sous_Item))

      const item = l.Item_Global || '(Sans item)'
      if (!entry.parItem.has(item)) entry.parItem.set(item, [])
      entry.parItem.get(item).push(Number(l.Note_Sous_Item))

      // Groupement des lignes brutes par item pour le panneau
      if (!entry.sousItemsParItem.has(item)) entry.sousItemsParItem.set(item, [])
      entry.sousItemsParItem.get(item).push(l)
    }

    // Transformation finale : on mappe sur itemsCanon pour avoir un ordre stable
    return Array.from(map.values()).map(e => ({
      agent: e.agent,
      noteGlobale: moyenne(e.toutes),
      nbEvals: e.toutes.length,
      notesItems: itemsCanon.map(item => {
        const notes = e.parItem.get(item)
        return notes ? { item, moyenne: moyenne(notes), nb: notes.length } : { item, moyenne: null, nb: 0 }
      }),
      // Tableau ordonné des groupes item → sous-items pour l'affichage du panneau
      groupesPanel: itemsCanon
        .filter(item => e.sousItemsParItem.has(item))
        .map(item => ({
          item,
          moyenneItem: moyenne(e.parItem.get(item)),
          lignes: e.sousItemsParItem.get(item),
        })),
    })).sort((a, b) => b.noteGlobale - a.noteGlobale)
  }, [lignesProjet, itemsCanon])

  // Filtrage texte sur la liste des agents
  const agentsFiltres = useMemo(() => {
    if (recherche.length < 2) return agentsStats
    const s = recherche.toLowerCase()
    return agentsStats.filter(a => a.agent.toLowerCase().includes(s))
  }, [agentsStats, recherche])

  // Template CSS grid : colonne agent + N colonnes items + colonne globale
  const gridTemplate = `minmax(200px, 1.2fr) repeat(${itemsCanon.length}, minmax(110px, 1fr)) 120px`

  if (!decodedProjet) return null

  return (
    <div className="nq-detail">
      <div className="nq-detail__nav">
        <button className="nq-detail__retour" onClick={() => navigate('/qualite')}>
          <i className="fa-solid fa-arrow-left" /> Retour
        </button>
        <div className="nq-detail__search-bar">
          <i className="fa-solid fa-magnifying-glass" />
          <input
            type="text"
            placeholder="Rechercher un agent..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
          {recherche && <button className="nq-detail__clear" onClick={() => setRecherche('')}>×</button>}
        </div>
        <div className="nq-detail__title">
          <i className="fa-solid fa-folder-open" />
          <span>{decodedProjet}</span>
          <span className="nq-detail__count">{agentsFiltres.length} agents</span>
        </div>
      </div>

      <ResumeProjet statsSummary={statsSummary} />
      
      <ListeAgents 
        decodedProjet={decodedProjet}
        navigate={navigate}
        recherche={recherche}
        setRecherche={setRecherche}
        agentsFiltres={agentsFiltres}
        itemsCanon={itemsCanon}
        gridTemplate={gridTemplate}
        agentDeplie={agentDeplie}
        setAgentDeplie={setAgentDeplie}
      />
    </div>
  )
}

export default NotesQualiteDetail

