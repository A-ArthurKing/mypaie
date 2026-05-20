import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../../../../Shared/Contexts/ToastContext';
import { useSocket } from '../../../../Shared/Contexts/SocketContext';
import HeaderSection from './sections/Header/KpiHeader';
import StatsSection from './sections/Stats/KpiStats';
import GridSection from './sections/Grid/KpiGrid';
import KpiModal from './components/Modal/KpiModal';
import ConfirmationModal from '../../../../Components/ConfirmationModal/ConfirmationModal';
import './IndicateursKpis.css';

const API_BASE = '/api'
const UNIVERS_LABELS = { PERF: 'Performance', QUALITE: 'Qualité', HEURES: 'Heures' }

const customSelectStyles = {
  control: (base, state) => ({
    ...base,
    borderRadius: '8px', borderWidth: '1px',
    borderColor: state.isFocused ? 'var(--color-accent)' : 'var(--color-border)',
    boxShadow: state.isFocused ? '0 0 0 2px var(--color-accent-soft)' : 'none',
    '&:hover': { borderColor: state.isFocused ? 'var(--color-accent)' : 'var(--color-accent-border)' },
    fontSize: '0.85rem', minHeight: '36px', height: '36px'
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '0 8px'
  }),
  indicatorsContainer: (base) => ({
    ...base,
    height: '34px'
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? 'var(--color-accent)' : state.isFocused ? 'var(--color-accent-soft)' : 'transparent',
    color: state.isSelected ? 'white' : 'var(--color-text-primary)',
    fontSize: '0.85rem', cursor: 'pointer', padding: '6px 10px',
    '&:active': { backgroundColor: 'var(--color-accent)' }
  }),
  singleValue: (base) => ({ ...base, color: 'var(--color-text-primary)', fontWeight: '600' }),
  placeholder: (base) => ({ ...base, color: 'var(--color-text-muted)' }),
  menu: (base) => ({
    ...base,
    zIndex: 9999
  })
}

export default function IndicateursKpis() {
  const addToast = useToast()
  const socket = useSocket()
  
  const [kpis, setKpis] = useState([])
  const [rawBqCodes, setRawBqCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [togglingCode, setTogglingCode] = useState(null)
  
  const [filterText, setFilterText] = useState('')
  const [filterUnivers, setFilterUnivers] = useState('ALL')
  
  const [showModal, setShowModal] = useState(false)
  const [activeTab, setActiveTab] = useState('NORMALIZATION')
  const [editingKpi, setEditingKpi] = useState(null)
  const [formData, setFormData] = useState({ code: '', libelle: '', description: '', univers: 'PERF', type: 'NATIVE', formule: '' })
  const [submitting, setSubmitting] = useState(false)
  const [modalUniversFilter, setModalUniversFilter] = useState('ALL')
  const [isAiSuggesting, setIsAiSuggesting] = useState(false)
  const [aiLastSuggestion, setAiLastSuggestion] = useState(null)

  // États pour les modales de confirmation
  const [deleteKpiTarget, setDeleteKpiTarget] = useState(null)
  const [deleteAliasTarget, setDeleteAliasTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [aliases, setAliases] = useState([])
  const [aliasFormData, setAliasFormData] = useState({ projet: 'INCONNU', code_brut_source: '', code_kpi_officiel: '' })

  const fetchKpis = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/parametres/kpis-registry`)
      if (!res.ok) throw new Error('Erreur chargement KPIs')
      const data = await res.json()
      setKpis(data.data || [])
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchRawCodes = async () => {
    try {
      const res = await fetch(`${API_BASE}/parametres/introspection/gold-kpis`)
      const data = await res.json()
      setRawBqCodes(data.data || [])
    } catch (e) {
      console.error("Erreur BQ", e)
    }
  }

  const fetchAliases = async () => {
    try {
      const res = await fetch(`${API_BASE}/parametres/kpi-aliases`)
      const data = await res.json()
      setAliases(data.data || [])
    } catch (e) {
      console.error("Erreur aliases", e)
    }
  }

  useEffect(() => { 
    fetchKpis()
    fetchRawCodes()
    fetchAliases()
  }, [])

  useEffect(() => {
    if (!socket) return;
    socket.on('kpi_alias_updated', fetchAliases);
    return () => socket.off('kpi_alias_updated', fetchAliases);
  }, [socket]);

  const handleSyncGold = async () => {
    setSyncing(true)
    try {
      const res = await fetch(`${API_BASE}/parametres/introspection/gold-kpis`)
      if (!res.ok) throw new Error('Erreur BQ')
      const goldData = await res.json()
      const discovered = goldData.data || []
      if (discovered.length === 0) {
        addToast('Aucun indicateur trouvé.', 'info')
        return
      }
      addToast(`${discovered.length} indicateurs découverts !`, 'success')
      fetchKpis()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setSyncing(false)
    }
  }

  const handleToggle = async (code) => {
    setTogglingCode(code)
    try {
      const res = await fetch(`${API_BASE}/parametres/kpis-registry/${code}/toggle`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }
      })
      if (!res.ok) throw new Error('Erreur maj')
      const data = await res.json()
      setKpis(prev => prev.map(k => k.code === code ? { ...k, actif: data.actif ? 1 : 0 } : k))
      addToast(`KPI ${code} ${data.actif ? 'activé' : 'désactivé'}`, data.actif ? 'success' : 'info')
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setTogglingCode(null)
    }
  }

  const handleOpenAdd = (type = 'NATIVE') => {
    setEditingKpi(null)
    setActiveTab(type === 'VIRTUAL' ? 'VIRTUAL' : 'NORMALIZATION')
    setModalUniversFilter('ALL')
    setAiLastSuggestion(null)
    setFormData({ code: '', libelle: '', description: '', univers: 'PERF', type: type, formule: '' })
    setShowModal(true)
  }

  const handleOpenEdit = (k) => {
    setEditingKpi(k)
    setActiveTab(k.type === 'VIRTUAL' ? 'VIRTUAL' : 'NORMALIZATION')
    setModalUniversFilter(k.univers)
    setAiLastSuggestion(null)
    setFormData({ code: k.code, libelle: k.libelle, description: k.description || '', univers: k.univers, type: k.type, formule: k.formule || '' })
    setShowModal(true)
  }

  const fetchAiSuggestion = async (code, univers) => {
    setIsAiSuggesting(true)
    try {
      const res = await fetch(`${API_BASE}/parametres/kpis-registry/suggest-label?code=${code}&univers=${univers}`)
      if (!res.ok) throw new Error('Erreur IA')
      const data = await res.json()
      if (data.libelle) {
        setAiLastSuggestion(data.libelle)
        setFormData(prev => ({ ...prev, libelle: data.libelle, description: data.description || prev.description }))
      }
    } catch (e) {
      console.warn("Erreur IA", e)
    } finally {
      setIsAiSuggesting(false)
    }
  }

  const handleDeleteKpiConfirm = async () => {
    if (!deleteKpiTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/parametres/kpis-registry/${deleteKpiTarget}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erreur suppression')
      addToast('KPI supprimé avec succès', 'success')
      setDeleteKpiTarget(null)
      fetchKpis()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteKpiRequest = (code) => {
    setDeleteKpiTarget(code);
  }

  const handleAliasSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/parametres/kpi-aliases`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aliasFormData)
      })
      if (!res.ok) throw new Error('Erreur rattachement')
      addToast('Alias créé avec succès', 'success')
      setAliasFormData({ projet: 'INCONNU', code_brut_source: '', code_kpi_officiel: '' })
      fetchAliases()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteAliasConfirm = async () => {
    if (!deleteAliasTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/parametres/kpi-aliases/${deleteAliasTarget}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erreur suppression')
      addToast('Rattachement supprimé avec succès', 'success')
      setDeleteAliasTarget(null)
      fetchAliases()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteAliasRequest = (id) => {
    setDeleteAliasTarget(id);
  }

  const unmappedCodes = useMemo(() => {
    if (!rawBqCodes || !kpis) return [];
    const officialCodes = new Set(kpis.map(k => k.code.toLowerCase()));
    const aliasedCodes = new Set(aliases.map(a => a.code_brut_source.toLowerCase()));
    const orphans = [];
    for (const raw of rawBqCodes) {
      const code = typeof raw === 'object' ? raw.kpi_code : raw;
      const projet = typeof raw === 'object' ? raw.projet || 'INCONNU' : 'INCONNU';
      const lowerCode = code.toLowerCase();
      if (!officialCodes.has(lowerCode) && !aliasedCodes.has(lowerCode)) {
        if (!orphans.some(o => o.code.toLowerCase() === lowerCode)) {
          orphans.push({ code, projet });
        }
      }
    }
    return orphans;
  }, [rawBqCodes, kpis, aliases]);

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const method = editingKpi ? 'PATCH' : 'POST'
      const url = editingKpi ? `${API_BASE}/parametres/kpis-registry/${editingKpi.code}` : `${API_BASE}/parametres/kpis-registry`
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
      })
      if (!res.ok) throw new Error('Erreur enregistrement')
      addToast(editingKpi ? 'KPI mis à jour' : 'KPI créé', 'success')
      setShowModal(false)
      fetchKpis()
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const insertTag = (tag) => {
    setFormData(prev => ({ ...prev, formule: (prev.formule || '') + `[${tag}]` }))
  }

  const filtered = useMemo(() => {
    const q = filterText.toLowerCase()
    return kpis.filter(k =>
      (filterUnivers === 'ALL' || k.univers === filterUnivers) &&
      (q === '' || k.code.toLowerCase().includes(q) || k.libelle.toLowerCase().includes(q))
    )
  }, [kpis, filterText, filterUnivers])

  const stats = useMemo(() => ({
    total: kpis.length,
    actifs: kpis.filter(k => k.actif).length,
    inactifs: kpis.filter(k => !k.actif).length,
  }), [kpis])

  const grouped = useMemo(() => {
    const g = {}
    for (const k of filtered) {
      if (!g[k.univers]) g[k.univers] = []
      g[k.univers].push(k)
    }
    return g
  }, [filtered])

  return (
    <div className="kr-container">
      <HeaderSection
        handleOpenAdd={handleOpenAdd}
        handleSyncGold={handleSyncGold}
        syncing={syncing}
        filterText={filterText}
        setFilterText={setFilterText}
        filterUnivers={filterUnivers}
        setFilterUnivers={setFilterUnivers}
        UNIVERS_LABELS={UNIVERS_LABELS}
        customSelectStyles={customSelectStyles}
      />
      
      <StatsSection stats={stats} loading={loading} />
      
      {loading ? (
        <div className="kr-loading">
          <i className="fa-solid fa-spinner fa-spin" />
          <span>Chargement du dictionnaire...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="kr-empty">
          <i className="fa-solid fa-circle-xmark" />
          <span>Aucun KPI trouvé. Cliquez sur Normaliser BigQuery.</span>
        </div>
      ) : (
        <GridSection 
          grouped={grouped}
          togglingCode={togglingCode}
          handleToggle={handleToggle}
          handleOpenEdit={handleOpenEdit}
          handleDelete={handleDeleteKpiRequest}
          UNIVERS_LABELS={UNIVERS_LABELS}
        />
      )}

      <KpiModal 
        showModal={showModal}
        setShowModal={setShowModal}
        editingKpi={editingKpi}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        formData={formData}
        setFormData={setFormData}
        handleSubmit={handleSubmit}
        submitting={submitting}
        rawBqCodes={rawBqCodes}
        modalUniversFilter={modalUniversFilter}
        setModalUniversFilter={setModalUniversFilter}
        isAiSuggesting={isAiSuggesting}
        fetchAiSuggestion={fetchAiSuggestion}
        aiLastSuggestion={aiLastSuggestion}
        setAiLastSuggestion={setAiLastSuggestion}
        insertTag={insertTag}
        kpis={kpis}
        UNIVERS_LABELS={UNIVERS_LABELS}
        customSelectStyles={customSelectStyles}
        aliases={aliases}
        aliasFormData={aliasFormData}
        setAliasFormData={setAliasFormData}
        handleAliasSubmit={handleAliasSubmit}
        handleAliasDelete={handleDeleteAliasRequest}
        unmappedCodes={unmappedCodes}
      />

      <ConfirmationModal
        isOpen={!!deleteKpiTarget}
        onClose={() => setDeleteKpiTarget(null)}
        onConfirm={handleDeleteKpiConfirm}
        title="Supprimer le KPI Virtuel"
        message={`Êtes-vous sûr de vouloir supprimer définitivement l'indicateur virtuel "${deleteKpiTarget}" ? Cette action est irréversible et pourrait impacter les grilles de primes qui l'utilisent.`}
        confirmText={isDeleting ? 'Suppression...' : 'Supprimer'}
      />

      <ConfirmationModal
        isOpen={!!deleteAliasTarget}
        onClose={() => setDeleteAliasTarget(null)}
        onConfirm={handleDeleteAliasConfirm}
        title="Supprimer le rattachement"
        message="Êtes-vous sûr de vouloir supprimer ce rattachement (alias) ? Les données brutes BigQuery cesseront d'être converties vers cet indicateur lors du prochain calcul."
        confirmText={isDeleting ? 'Suppression...' : 'Supprimer'}
      />
    </div>
  )
}
