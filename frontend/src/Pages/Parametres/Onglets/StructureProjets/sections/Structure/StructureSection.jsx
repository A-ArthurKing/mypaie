/*
 * Fichier : StructureSection.jsx
 */
import { useEffect } from 'react'
import { useSocket } from '../../../../../../Shared/Contexts/SocketContext'
import Cartographie from '../../../../../GestionStructure/sections/Cartographie/Cartographie'
import useApiSWR from '../../../../../../Shared/Hooks/useApiSWR'
import { TTL } from '../../../../../../Shared/Utils/cacheStorage'
import './StructureSection.css'

const REFS_FALLBACK = { projets: [], operations: [], sous_projets: [], activites: [], structure: [], kpis: {} }

export default function StructureSection() {
  const {
    data: refs = REFS_FALLBACK,
    loading,
    revalidate,
  } = useApiSWR(
    'parametres:references',
    () => fetch('/api/parametres/references').then(r => r.json()),
    { ttl: TTL.DROPDOWNS, fallbackData: REFS_FALLBACK }
  )

  const socket = useSocket()

  useEffect(() => {
    if (!socket) return
    socket.on('structure_updated', revalidate)
    return () => socket.off('structure_updated', revalidate)
  }, [socket, revalidate])

  return (
    <div className="str-container">
      {/* Contenu */}
      {loading ? (
        <div className="str-loading">
          <i className="fa-solid fa-spinner fa-spin" />
          <span>Chargement de la structure…</span>
        </div>
      ) : (
        <Cartographie refs={refs} onRefresh={revalidate} />
      )}
    </div>
  )
}
