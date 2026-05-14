/*
 * Fichier : KpiRegistry.jsx
 * Rôle    : Onglet KPI Registry — catalogue des KPIs standards avec toggle actif/inactif.
 *           Permet de visualiser tous les KPIs par univers, voir leurs mappings,
 *           et activer/désactiver chaque KPI d'un simple clic (sans toucher au code ETL).
 * Dépend  : KpiRegistry.css, SocketContext, ToastContext
 * Module  : mypaie / Pages / Parametres / Onglets / KpiRegistry
 */
import { useState, useEffect, useMemo } from 'react'
import { useToast } from '../../../../Shared/Contexts/ToastContext'
import { useSocket } from '../../../../Shared/Contexts/SocketContext'
import './KpiRegistry.css'

const API_BASE = '/api'
const UNIVERS_LABELS = { PERF: 'Performance', QUALITE: 'Qualité', HEURES: 'Heures' }

export default function KpiRegistry() {
  const addToast = useToast()
  const socket = useSocket()
  const [kpis, setKpis] = useState([])
  const [loading, setLoading] = useState(true)
  const [togglingCode, setTogglingCode] = useState(null)
  const [filterText, setFilterText] = useState('')
  const [filterUnivers, setFilterUnivers] = useState('ALL')

  /* ── Fetch ─────────────────────────────────────────────────────── */
  const fetchKpis = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/parametres/kpis-registry`)
      if (!res.ok) throw new Error('Erreur chargement KPIs')
      const data = await res.json()
      setKpis(data.data || [])
    } catch (e) {
      addToast({ type: 'error', message: e.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchKpis() }, [])

  /* ── Socket temps réel ─────────────────────────────────────────── */
  useEffect(() => {
    if (!socket) return
    const handler = () => fetchKpis()
    socket.on('kpi_registry_updated', handler)
    return () => socket.off('kpi_registry_updated', handler)
  }, [socket])

  /* ── Toggle actif ──────────────────────────────────────────────── */
  const handleToggle = async (code) => {
    setTogglingCode(code)
    try {
      const res = await fetch(`${API_BASE}/parametres/kpis-registry/${code}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!res.ok) throw new Error('Erreur mise à jour')
      const data = await res.json()
      setKpis(prev =>
        prev.map(k => k.code === code ? { ...k, actif: data.actif ? 1 : 0 } : k)
      )
      addToast({
        type: data.actif ? 'success' : 'info',
        message: `KPI ${code} ${data.actif ? 'activé' : 'désactivé'} — pris en compte au prochain ETL`
      })
    } catch (e) {
      addToast({ type: 'error', message: e.message })
    } finally {
      setTogglingCode(null)
    }
  }

  /* ── Filtrage ──────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    const q = filterText.toLowerCase()
    return kpis.filter(k =>
      (filterUnivers === 'ALL' || k.univers === filterUnivers) &&
      (q === '' || k.code.toLowerCase().includes(q) || k.libelle.toLowerCase().includes(q))
    )
  }, [kpis, filterText, filterUnivers])

  /* ── Stats ─────────────────────────────────────────────────────── */
  const stats = useMemo(() => ({
    total:    kpis.length,
    actifs:   kpis.filter(k => k.actif).length,
    inactifs: kpis.filter(k => !k.actif).length,
    mappes:   kpis.filter(k => k.nb_mappings > 0).length,
  }), [kpis])

  /* ── Groupement par univers ────────────────────────────────────── */
  const grouped = useMemo(() => {
    const g = {}
    for (const k of filtered) {
      if (!g[k.univers]) g[k.univers] = []
      g[k.univers].push(k)
    }
    return g
  }, [filtered])

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div className="kr-container">

      {/* Header */}
      <div className="kr-header">
        <div className="kr-header__icon">
          <i className="fa-solid fa-sliders" />
        </div>
        <div className="kr-header__text">
          <h2 className="kr-header__title">KPI Registry</h2>
          <p className="kr-header__desc">
            Activez ou désactivez chaque indicateur — l'ETL applique le changement au prochain run, sans modifier le code.
          </p>
        </div>
        <div className="kr-header__actions">
          <div className="kr-filter-wrapper">
            <i className="fa-solid fa-magnifying-glass" />
            <input
              className="kr-filter-input"
              type="text"
              placeholder="Filtrer..."
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
            />
          </div>
          <select
            className="kr-filter-select"
            value={filterUnivers}
            onChange={e => setFilterUnivers(e.target.value)}
          >
            <option value="ALL">Tous les univers</option>
            {Object.entries(UNIVERS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="kr-stats">
          <div className="kr-stat">
            <span className="kr-stat__value">{stats.total}</span>
            <span className="kr-stat__label">Total KPIs</span>
          </div>
          <div className="kr-stat kr-stat--active">
            <span className="kr-stat__value">{stats.actifs}</span>
            <span className="kr-stat__label">Actifs</span>
          </div>
          <div className="kr-stat kr-stat--inactive">
            <span className="kr-stat__value">{stats.inactifs}</span>
            <span className="kr-stat__label">Inactifs</span>
          </div>
          <div className="kr-stat">
            <span className="kr-stat__value">{stats.mappes}</span>
            <span className="kr-stat__label">Mappés</span>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="kr-loading">
          <i className="fa-solid fa-spinner fa-spin" />
          <span>Chargement du catalogue KPI…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="kr-empty">
          <i className="fa-solid fa-circle-xmark" />
          <span>Aucun KPI ne correspond aux filtres</span>
        </div>
      ) : (
        Object.entries(UNIVERS_LABELS).map(([univers, label]) => {
          const items = grouped[univers]
          if (!items?.length) return null
          return (
            <div key={univers} className="kr-univers-section">
              <div className="kr-univers-header">
                <span className={`kr-univers-badge kr-univers-badge--${univers}`}>{univers}</span>
                <h3>{label}</h3>
                <span className="kr-univers-count">{items.length} KPI{items.length > 1 ? 's' : ''}</span>
              </div>
              <div className="kr-kpi-grid">
                {items.map(kpi => (
                  <KpiCard
                    key={kpi.code}
                    kpi={kpi}
                    toggling={togglingCode === kpi.code}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

/* ── KpiCard ─────────────────────────────────────────────────────── */
function KpiCard({ kpi, toggling, onToggle }) {
  const isActive = Boolean(kpi.actif)
  return (
    <div className={`kr-kpi-card ${!isActive ? 'kr-kpi-card--inactive' : ''}`}>
      <div className="kr-kpi-card__top">
        <span className="kr-kpi-card__code">{kpi.code}</span>
        <div className="kr-kpi-card__info">
          <p className="kr-kpi-card__name">{kpi.libelle}</p>
          <div className="kr-kpi-card__meta">
            {kpi.unite && <span>{kpi.unite}</span>}
            {kpi.tech_key && <span>{kpi.tech_key}</span>}
          </div>
        </div>
      </div>

      <div className={`kr-kpi-card__mappings ${kpi.nb_mappings === 0 ? 'kr-kpi-card__mappings--none' : ''}`}>
        <i className="fa-solid fa-link" />
        {kpi.nb_mappings > 0
          ? `${kpi.nb_mappings} mapping${kpi.nb_mappings > 1 ? 's' : ''} configuré${kpi.nb_mappings > 1 ? 's' : ''}`
          : 'Aucun mapping — non utilisé par l\'ETL'
        }
      </div>

      <div className="kr-toggle-wrapper">
        <span className="kr-toggle-label">Inclure dans l'ETL</span>
        <label className={`kr-toggle ${toggling ? 'kr-toggle--loading' : ''}`}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={() => !toggling && onToggle(kpi.code)}
            disabled={toggling}
          />
          <span className="kr-toggle__track">
            <span className="kr-toggle__thumb" />
          </span>
          <span className={`kr-toggle__status kr-toggle__status--${isActive ? 'active' : 'inactive'}`}>
            {toggling ? '…' : isActive ? 'Actif' : 'Inactif'}
          </span>
        </label>
      </div>
    </div>
  )
}
