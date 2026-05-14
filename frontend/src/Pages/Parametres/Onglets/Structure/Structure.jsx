/*
 * Fichier : Structure.jsx
 * Rôle    : Onglet "Structure organisationnelle" dans Paramètres.
 *           Regroupe en un seul endroit : arborescence Projet→BU→File→Activité (CRUD inline)
 *           et gestion des référentiels (ajout/suppression des entrées).
 * Dépend  : Cartographie, Referentiels (GestionStructure), useApiSWR, SocketContext
 * Module  : mypaie / Pages / Parametres / Onglets / Structure
 */
import { useState, useEffect } from 'react'
import { useSocket } from '../../../../Shared/Contexts/SocketContext'
import Cartographie from '../../../GestionStructure/sections/Cartographie/Cartographie'
import Referentiels from '../../../GestionStructure/tabs/Referentiels/Referentiels'
import useApiSWR from '../../../../Shared/Hooks/useApiSWR'
import { TTL } from '../../../../Shared/Utils/cacheStorage'
import './Structure.css'

const REFS_FALLBACK = { projets: [], operations: [], sous_projets: [], activites: [], structure: [], kpis: {} }

export default function Structure() {
  const {
    data: refs = REFS_FALLBACK,
    loading,
    revalidate,
  } = useApiSWR(
    'parametres:references',
    () => fetch('/api/parametres/references').then(r => r.json()),
    { ttl: TTL.DROPDOWNS, fallbackData: REFS_FALLBACK }
  )

  const [activeTab, setActiveTab] = useState('arborescence')
  const socket = useSocket()

  useEffect(() => {
    if (!socket) return
    socket.on('structure_updated', revalidate)
    return () => socket.off('structure_updated', revalidate)
  }, [socket, revalidate])

  return (
    <div className="str-container">

      {/* Header */}
      <div className="str-header">
        <div className="str-header__icon">
          <i className="fa-solid fa-sitemap" />
        </div>
        <div className="str-header__text">
          <h2 className="str-header__title">Structure organisationnelle</h2>
          <p className="str-header__desc">
            Gérez la hiérarchie Projet → BU → File → Activité et leurs associations.
          </p>
        </div>
      </div>

      {/* Sous-navigation interne */}
      <nav className="str-subnav">
        <button
          className={`str-subnav__btn ${activeTab === 'arborescence' ? 'str-subnav__btn--active' : ''}`}
          onClick={() => setActiveTab('arborescence')}
        >
          <i className="fa-solid fa-diagram-project" />
          Arborescence
        </button>
        <button
          className={`str-subnav__btn ${activeTab === 'referentiels' ? 'str-subnav__btn--active' : ''}`}
          onClick={() => setActiveTab('referentiels')}
        >
          <i className="fa-solid fa-layer-group" />
          Gérer les entrées
        </button>
      </nav>

      {/* Contenu */}
      {loading ? (
        <div className="str-loading">
          <i className="fa-solid fa-spinner fa-spin" />
          <span>Chargement de la structure…</span>
        </div>
      ) : activeTab === 'arborescence' ? (
        <Cartographie refs={refs} onRefresh={revalidate} />
      ) : (
        <Referentiels refs={refs} onRefresh={revalidate} />
      )}
    </div>
  )
}
