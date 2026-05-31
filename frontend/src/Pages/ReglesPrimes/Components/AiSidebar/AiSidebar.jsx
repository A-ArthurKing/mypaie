import React, { useState, useRef, useEffect } from "react";
import "./AiSidebar.css";
import useApiSWR from "../../../../Shared/Hooks/useApiSWR";
import { useToast } from "../../../../Shared/Contexts/ToastContext";
import ConfirmationModal from "../../../../Components/ConfirmationModal/ConfirmationModal";
import { calculateKpiResults, calculateAssiduite, calculateMontantFinal } from '../../SubPages/RegleDetail/Onglets/TableauDeBordOnglet/Helpers/KpiCalculatorHelper';

// Compteur global pour garantir des IDs de message uniques (évite les doublons Date.now())
let _msgIdCounter = 0;
const nextMsgId = () => ++_msgIdCounter;

// Helper fetch avec token JWT (identique à fetchJson dans apiFetchers)
function authFetch(url, options = {}) {
  const token = localStorage.getItem('mypaie_auth_token');
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

// ── Rendu Markdown léger (sans dépendance externe) ──────────────────────────
function parseInline(text, baseKey = 0) {
  const parts = [];
  const regex = /(`([^`]+?)`|\*\*([^*]+?)\*\*|\*([^*]+?)\*)/g;
  let last = 0;
  let key = baseKey;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[1].startsWith('`')) parts.push(<code key={key++} className="ai-md-code">{match[2]}</code>);
    else if (match[1].startsWith('**')) parts.push(<strong key={key++}>{match[3]}</strong>);
    else parts.push(<em key={key++}>{match[4]}</em>);
    last = match.index + match[1].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function getPreviousMonthRange() {
  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 12 : now.getMonth();
  const lastDay = new Date(year, month, 0).getDate();
  const monthStr = String(month).padStart(2, '0');
  const label = new Date(year, month - 1, 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  return { debut: `${year}-${monthStr}-01`, fin: `${year}-${monthStr}-${lastDay}`, label };
}

function KpiSelectorCard({ userName, suggested, candidates, onSelect, confirmedKpi, pendingKpi }) {
  const [showPicker, setShowPicker] = useState(false);
  const currentKpi = confirmedKpi || pendingKpi;

  return (
    <div className={`ai-kpi-card ${confirmedKpi ? 'ai-kpi-card--confirmed' : (pendingKpi ? 'ai-kpi-card--pending' : '')} ${(!suggested && !currentKpi) ? 'ai-kpi-card--error' : ''}`} style={{ marginBottom: '8px' }}>
      {currentKpi ? (
        <div className="ai-kpi-card__body" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }}>
          <i className={`fa-solid ${confirmedKpi ? 'fa-check-circle' : 'fa-hourglass-half'}`} style={{ color: confirmedKpi ? 'var(--color-success)' : '#f59e0b' }}></i>
          <span className="ai-kpi-card__user-name" style={{ fontWeight: 'bold' }}>"{userName}"</span>
          <i className="fa-solid fa-arrow-right ai-kpi-card__arrow"></i>
          <div className="ai-kpi-card__confirmed-info">
            <span className="ai-kpi-card__confirmed-libelle">{currentKpi.libelle}</span>
            <code className="ai-kpi-card__code">{currentKpi.code_kpi}</code>
          </div>
        </div>
      ) : (showPicker || !suggested) ? (
        <div className="ai-kpi-card--picking" style={{ padding: '12px' }}>
          <div className="ai-kpi-card__pick-header" style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {showPicker && suggested && (
              <button className="ai-kpi-back-btn" onClick={() => setShowPicker(false)} type="button">
                <i className="fa-solid fa-arrow-left"></i>
              </button>
            )}
            <span style={{ fontSize: '0.85rem' }}>
              {!suggested ? <strong>"{userName}"</strong> : <>Choisissez pour <strong>"{userName}"</strong> :</>}
            </span>
          </div>
          <div className="ai-kpi-card__list" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {(candidates || []).map((kpi, i) => (
              <button key={i} className="ai-kpi-card__list-item" onClick={() => onSelect({ user_name: userName, ...kpi })} type="button">
                <span className="ai-kpi-card__list-libelle">{kpi.libelle}</span>
                <code className="ai-kpi-card__code">{kpi.code_kpi}</code>
              </button>
            ))}
            {(!candidates || candidates.length === 0) && (
              <div style={{ fontSize: '0.75rem', color: '#ef4444', fontStyle: 'italic' }}>Aucun KPI trouvé.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="ai-kpi-card--suggestion" style={{ padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="ai-kpi-card__user-name" style={{ fontWeight: 'bold' }}>"{userName}"</span>
            <i className="fa-solid fa-arrow-right ai-kpi-card__arrow"></i>
            <div className="ai-kpi-card__suggestion-info">
              <span className="ai-kpi-card__suggestion-libelle">{suggested.libelle}</span>
              <code className="ai-kpi-card__code">{suggested.code_kpi}</code>
            </div>
          </div>
          <div className="ai-kpi-card__actions" style={{ display: 'flex', gap: '6px' }}>
            <button className="ai-kpi-btn ai-kpi-btn--validate" onClick={() => onSelect({ user_name: userName, ...suggested })} type="button" style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem' }}>
              <i className="fa-solid fa-check"></i> Choisir
            </button>
            <button className="ai-kpi-btn ai-kpi-btn--reject" onClick={() => setShowPicker(true)} type="button" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
              Autre
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MultiKpiSelector({ data, onSelect, confirmedKpis, pendingKpiSelections }) {
  // Gère à la fois le format multiple (resolved/unresolved) et le format simple (user_name/best_guess)
  const items = data.user_name 
    ? [{ user_name: data.user_name, suggested: data.best_guess || data.suggested, candidates: data.candidates || [] }]
    : [
        ...(data.resolved || []).map(k => ({ user_name: k.user_name, suggested: k, candidates: [] })),
        ...(data.unresolved || []).map(k => ({ user_name: k.user_name, suggested: null, candidates: k.candidates || [] })),
        ...(data.items || [])
      ];

  if (items.length === 0) return null;

  return (
    <div className="ai-multi-selector" style={{ background: '#f1f5f9', padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0', margin: '10px 0' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <i className="fa-solid fa-magnifying-glass"></i> Validation du mapping KPI
      </div>
      {items.map((item, idx) => (
        <KpiSelectorCard
          key={idx}
          userName={item.user_name}
          suggested={item.suggested || item.best_guess}
          candidates={item.candidates}
          onSelect={onSelect}
          confirmedKpi={confirmedKpis[item.user_name]}
          pendingKpi={pendingKpiSelections[item.user_name]}
        />
      ))}
    </div>
  );
}

function KpiListingCard({ kpis, onSelectMany }) {
  const [selectedIds, setSelectedIds] = useState([]);

  const toggleKpi = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    if (selectedIds.length === 0) return;
    const selectedKpis = kpis.filter(k => selectedIds.includes(k.code_kpi));
    onSelectMany(selectedKpis);
  };

  const groups = {};
  kpis.forEach(k => {
    const u = k.univers || 'AUTRE';
    if (!groups[u]) groups[u] = [];
    groups[u].push(k);
  });

  return (
    <div className="ai-kpi-card ai-kpi-card--listing">
      <div className="ai-kpi-card__pick-header">
        <span>Sélectionnez les KPIs à utiliser :</span>
      </div>
      <div className="ai-kpi-card__scroll-list">
        {Object.keys(groups).map(univers => (
          <div key={univers} className="ai-kpi-group">
            <div className="ai-kpi-group-title">{univers}</div>
            {groups[univers].map(k => (
              <label key={k.code_kpi} className={`ai-kpi-list-item ${selectedIds.includes(k.code_kpi) ? 'is-selected' : ''}`}>
                <input 
                  type="checkbox" 
                  checked={selectedIds.includes(k.code_kpi)} 
                  onChange={() => toggleKpi(k.code_kpi)}
                />
                <div className="ai-kpi-list-item-content">
                  <span className="ai-kpi-list-item-libelle">{k.libelle}</span>
                  <code className="ai-kpi-list-item-code">{k.code_kpi}</code>
                </div>
              </label>
            ))}
          </div>
        ))}
      </div>
      <div className="ai-kpi-card__actions">
        <button 
          className="ai-kpi-btn ai-kpi-btn--validate" 
          disabled={selectedIds.length === 0}
          onClick={handleConfirm}
        >
          <i className="fa-solid fa-plus"></i> Utiliser ces {selectedIds.length} KPIs
        </button>
      </div>
    </div>
  );
}

function KpiFormatForm({ kpis, onSubmit, submitted }) {
  const [formats, setFormats] = useState(() => 
    (kpis || []).reduce((acc, kpi) => ({
      ...acc,
      [kpi.code_kpi]: { 
        code_kpi: kpi.code_kpi, 
        unite: 'pourcentage', 
        mode_prime: 'score_global', 
        libelle: kpi.libelle, 
        user_name: kpi.user_name 
      }
    }), {})
  );

  if (!kpis || kpis.length === 0) return null;

  if (submitted) {
    return (
      <div className="ai-kpi-card ai-kpi-card--confirmed">
        <i className="fa-solid fa-check-circle"></i> Formats validés pour {kpis.length} KPI(s).
      </div>
    );
  }

  return (
    <div className="ai-kpi-card ai-format-card" style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', margin: '10px 0', overflow: 'hidden' }}>
      <div className="ai-kpi-card__pick-header" style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
        <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}><i className="fa-solid fa-sliders"></i> Configuration des formats</span>
      </div>
      <div className="ai-format-list" style={{ maxHeight: '350px', overflowY: 'auto', padding: '12px' }}>
        {kpis.map(kpi => (
          <div key={kpi.code_kpi} className="ai-format-row" style={{ marginBottom: '12px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div className="ai-format-kpi-name" style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '0.85rem' }}>
              {kpi.user_name || kpi.libelle} <code style={{ fontSize: '0.75em', color: '#64748b', marginLeft: '6px', background: '#eee', padding: '2px 4px', borderRadius: '4px' }}>{kpi.code_kpi}</code>
            </div>
            <div className="ai-format-controls" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.75rem', color: '#64748b' }}>
                Unité :
                <select 
                  style={{ marginTop: '4px', padding: '6px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  value={formats[kpi.code_kpi]?.unite}
                  onChange={e => setFormats({...formats, [kpi.code_kpi]: {...formats[kpi.code_kpi], unite: e.target.value}})}
                >
                  <option value="pourcentage">% Pourcentage</option>
                  <option value="devise">€ Devise (MAD, EUR...)</option>
                  <option value="nombre"># Nombre / Quantité</option>
                  <option value="temps">⏱️ Temps (DMT, durée)</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.75rem', color: '#64748b' }}>
                Type de prime :
                <select 
                  style={{ marginTop: '4px', padding: '6px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  value={formats[kpi.code_kpi]?.mode_prime}
                  onChange={e => setFormats({...formats, [kpi.code_kpi]: {...formats[kpi.code_kpi], mode_prime: e.target.value}})}
                >
                  <option value="score_global">Atteinte d'objectif %</option>
                  <option value="montant_direct">Montant direct en DH</option>
                  <option value="pourcentage_valeur">Commission % valeur</option>
                </select>
              </label>
            </div>
          </div>
        ))}
      </div>
      <div className="ai-kpi-card__actions" style={{ padding: '12px', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
        <button 
          style={{ width: '100%', background: 'var(--color-accent)', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }} 
          onClick={() => onSubmit(formats)}
        >
          <i className="fa-solid fa-check"></i> Valider les formats
        </button>
      </div>
    </div>
  );
}

function LogicConfirmationCard({ onConfirm, submitted }) {
  if (submitted) return null;
  return (
    <div style={{ margin: '15px 0', padding: '16px', background: 'var(--color-accent-soft)', border: '1px solid var(--color-accent)', borderRadius: '12px', textAlign: 'center' }}>
      <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-accent)' }}>
        La logique vous convient-elle ?
      </p>
      <button 
        style={{ width: '100%', background: 'var(--color-accent)', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
        onClick={onConfirm}
      >
        <i className="fa-solid fa-wand-magic-sparkles"></i> Générer la configuration finale
      </button>
    </div>
  );
}

function MarkdownMessage({ text, onActionClick, msgId, simulation, confirmedKpis = {}, pendingKpiSelections = {} }) {
  if (!text) return null;
  
  const elements = [];
  let keyIdx = 0;

  // 1. Extraire tous les blocs de code (```type ... ```)
  // Regex amélioré : gère les espaces éventuels après les backticks
  const codeBlockRegex = /```\s*(\w+)?\s*([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  const processPlainMarkdown = (content) => {
    if (!content.trim()) return;
    const lines = content.split('\n');
    let listItems = [];
    let listType = null;

    const flushList = () => {
      if (listItems.length === 0) return;
      const Tag = listType === 'ol' ? 'ol' : 'ul';
      elements.push(<Tag key={keyIdx++} className="ai-md-list">{listItems}</Tag>);
      listItems = [];
      listType = null;
    };

    lines.forEach(line => {
      const hMatch = line.match(/^\s*(#{1,4})\s+(.+)/);
      const ulMatch = line.match(/^\s*[*\-]\s+(.+)/);
      const olMatch = line.match(/^\s*\d+\.\s+(.+)/);

      if (hMatch) {
        flushList();
        const level = Math.min(hMatch[1].length + 3, 6);
        const Tag = `h${level}`;
        elements.push(<Tag key={keyIdx++} className="ai-md-heading">{parseInline(hMatch[2], keyIdx * 100)}</Tag>);
      } else if (ulMatch) {
        if (listType === 'ol') flushList();
        listType = 'ul';
        listItems.push(<li key={keyIdx++}>{parseInline(ulMatch[1], keyIdx * 100)}</li>);
      } else if (olMatch) {
        if (listType === 'ul') flushList();
        listType = 'ol';
        listItems.push(<li key={keyIdx++}>{parseInline(olMatch[1], keyIdx * 100)}</li>);
      } else if (line.trim() === '') {
        if (!listType) elements.push(<div key={keyIdx++} className="ai-md-spacer"></div>);
      } else {
        flushList();
        elements.push(<p key={keyIdx++} className="ai-md-p">{parseInline(line, keyIdx * 100)}</p>);
      }
    });
    flushList();
  };

  const tryParseJson = (str) => {
    try {
      // 1. Isoler le JSON (entre { et })
      const jsonStart = str.indexOf('{');
      const jsonEnd = str.lastIndexOf('}') + 1;
      if (jsonStart === -1 || jsonEnd <= jsonStart) return null;
      let jsonStr = str.substring(jsonStart, jsonEnd);

      // 2. Nettoyage agressif des erreurs courantes d'IA
      jsonStr = jsonStr
        .replace(/\\"/g, '"')       // Transforme \" en "
        .replace(/\\'/g, "'")       // Transforme \' en '
        .replace(/,\s*}/g, '}')     // Enlève les virgules traînantes avant }
        .replace(/,\s*]/g, ']')     // Enlève les virgules traînantes avant ]
        .replace(/\.\.\./g, '')      // Enlève les points de suspension
        .replace(/\n/g, ' ');        // Enlève les sauts de ligne pour stabiliser le parse

      return JSON.parse(jsonStr);
    } catch (e) {
      return null;
    }
  };

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Traiter le texte avant le bloc
    const plainBefore = text.substring(lastIndex, match.index);
    processPlainMarkdown(plainBefore);

    const type = (match[1] || '').trim().toLowerCase();
    const content = match[2];

    // Traiter le bloc spécifique
    if (type.includes('json_grille_proposal') || type.includes('json_grille_applied')) {
      const isApplied = type.includes('json_grille_applied');
      const proposal = tryParseJson(content);
      if (proposal) {
        elements.push(
          <div key={keyIdx++} className={`ai-grille-proposal ${isApplied ? 'applied' : ''}`}>
            <div className="ai-grille-proposal-title">
              <i className={`fa-solid ${isApplied ? 'fa-check-circle' : 'fa-file-invoice'}`}></i> {isApplied ? 'Grille Appliquée' : 'Proposition de Grille'}
            </div>
            <div className="ai-grille-proposal-body">
              <strong>{proposal.grille_nom || proposal.nom || "Nouvelle Grille"}</strong>
              {isApplied ? (
                <p className="ai-grille-proposal-status"><i className="fa-solid fa-check"></i> Cette configuration a été validée et appliquée.</p>
              ) : (
                <>
                  <p>Cliquez ci-dessous pour valider et appliquer cette configuration.</p>
                  <div className="ai-grille-actions">
                    <button className="ai-btn-apply-grille" onClick={() => onActionClick('create_grille', proposal)}>
                      Valider et Créer la règle
                    </button>
                    {!simulation && (
                      <button className="ai-btn-simulate" onClick={() => onActionClick('request_simulation', proposal)} type="button">
                        <i className="fa-solid fa-flask-vial"></i> Simuler
                      </button>
                    )}
                  </div>
                </>
              )}
              {simulation && (
                <div className="ai-simulation-section">
                  {simulation.loading ? (
                    <div className="ai-simulation-loading"><i className="fa-solid fa-spinner fa-spin"></i> Simulation en cours...</div>
                  ) : simulation.error ? (
                    <div className="ai-simulation-error"><i className="fa-solid fa-triangle-exclamation"></i> {simulation.error}</div>
                  ) : simulation.agents && simulation.agents.length > 0 ? (
                    <>
                      <div className="ai-simulation-header"><i className="fa-solid fa-flask-vial"></i> Simulation — <em>{simulation.mois}</em></div>
                      {simulation.agents.map(agent => (
                        <div key={agent.matricule} className="ai-simulation-agent">
                          <div className="ai-simulation-agent-header">
                            <span className="ai-simulation-agent-name">{agent.nom}</span>
                            <span className="ai-simulation-agent-badge">{agent.statut}</span>
                          </div>
                          <table className="ai-simulation-table">
                            <thead><tr><th>KPI</th><th>Réel</th><th>Obj.</th><th>Att.</th><th>Pts</th></tr></thead>
                            <tbody>
                              {(agent.kpiResults.kpis || []).map((k, i) => (
                                <tr key={i}>
                                  <td title={k.nom}>{k.nom?.length > 18 ? k.nom.substring(0, 18) + '…' : k.nom}</td>
                                  <td>{k.reel != null ? (typeof k.reel === 'number' ? (k.reel % 1 === 0 ? k.reel : k.reel.toFixed(1)) : k.reel) : '—'}</td>
                                  <td>{k.objectif != null ? k.objectif : '—'}</td>
                                  <td className={k.taux_atteinte != null ? (k.taux_atteinte >= 1 ? 'sim-ok' : 'sim-nok') : ''}>{k.taux_atteinte != null ? Math.round(k.taux_atteinte * 100) + '%' : '—'}</td>
                                  <td className={k.points_gagnes > 0 ? 'sim-pts' : ''}>{k.points_gagnes ?? 0}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="ai-simulation-total">
                            <span>Score : <strong>{agent.kpiResults.total_points} pts</strong></span>
                            <span className="ai-simulation-prime">Prime : <strong>{agent.totalPrime.toLocaleString('fr-FR')} DH</strong></span>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        );
      } else {
        elements.push(<pre key={keyIdx++} className="ai-md-pre">{content}</pre>);
      }
    } else if (type.includes('kpi_selection_request') || type.includes('multi_kpi_selection_request')) {
      const data = tryParseJson(content);
      if (data) {
        elements.push(<MultiKpiSelector key={keyIdx++} data={data} onSelect={(kpi) => onActionClick('select_kpi', kpi)} confirmedKpis={confirmedKpis} pendingKpiSelections={pendingKpiSelections} />);
      } else {
        elements.push(<pre key={keyIdx++} className="ai-md-pre">{content}</pre>);
      }
    } else if (type.includes('kpi_listing_request')) {
      const data = tryParseJson(content);
      if (data) {
        elements.push(<KpiListingCard key={keyIdx++} kpis={data.kpis || []} onSelectMany={(kpis) => onActionClick('select_multiple_kpis', kpis)} />);
      } else {
        elements.push(<pre key={keyIdx++} className="ai-md-pre">{content}</pre>);
      }
    } else if (type.includes('kpi_format_request')) {
      const data = tryParseJson(content);
      if (data) {
        elements.push(<KpiFormatForm key={keyIdx++} kpis={data.kpis || []} onSubmit={(formats) => onActionClick('submit_kpi_formats', formats)} submitted={confirmedKpis['_formats_submitted_' + msgId] || false} />);
      } else {
        elements.push(<pre key={keyIdx++} className="ai-md-pre">{content}</pre>);
      }
    } else {
      elements.push(<pre key={keyIdx++} className="ai-md-pre">{content}</pre>);
    }

    lastIndex = match.index + match[0].length;
  }

  // Traiter le reste du texte après le dernier bloc
  const plainAfter = text.substring(lastIndex);
  processPlainMarkdown(plainAfter);

  return <>{elements}</>;
}
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_MESSAGE = { id: 0, sender: "bot", text: "Bonjour ! Je suis l'assistant IA de myPaie. Je peux répondre à vos questions sur cette règle de prime, ses objectifs (KPIs) et ses paramètres. Comment puis-je vous aider ?" };

export default function AiSidebar({ isOpen, onClose, regleId, onRefresh }) {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState('chat'); // 'chat' or 'history'
  const [currentConvId, setCurrentConvId] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const addToast = useToast();

  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editInputValue, setEditInputValue] = useState("");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [convToDelete, setConvToDelete] = useState(null);
  const [proposalSimulations, setProposalSimulations] = useState({});
  const [confirmedKpis, setConfirmedKpis] = useState({});
  const [pendingKpiSelections, setPendingKpiSelections] = useState({});

  // Charger la liste des conversations (Historique)
  const { data: conversations = [], revalidate: refreshHistory } = useApiSWR(
    isOpen && view === 'history' && regleId ? `ai_conversations:${regleId}` : null,
    () => authFetch(`/api/regles/${regleId}/conversations`).then(r => r.json()).then(d => d.data || [])
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen, view]);

  // Si on ouvre le panneau et qu'on n'a pas de conversation, on remet tout à zéro
  useEffect(() => {
    if (isOpen && !currentConvId) {
      setMessages([INITIAL_MESSAGE]);
      setIsLocked(false);
    }
  }, [isOpen, currentConvId]);

  if (!isOpen) return null;

  const loadConversation = async (convId, lockedStatus) => {
    try {
      setIsLoading(true);
      const res = await authFetch(`/api/conversations/${convId}/messages`);
      const data = await res.json();
      if (data.data) {
        setMessages(data.data);
        setCurrentConvId(convId);
        setIsLocked(!!lockedStatus);
        setView('chat');
      }
    } catch (err) {
      console.error("Erreur chargement conversation", err);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setCurrentConvId(null);
    setMessages([INITIAL_MESSAGE]);
    setIsLocked(false);
    setConfirmedKpis({});
    setView('chat');
  };

  const handleActionClick = async (actionType, payload, msgId) => {
    if (actionType === 'create_grille') {
      try {
        setIsLoading(true);
        const grilleName = payload.nom || payload.grille_nom || "Nouvelle version IA";
        const { nom, grille_nom, ...grilleContent } = payload;
        const res = await authFetch(`/api/regles/${regleId}/configs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            libelle: grilleName,
            grille_nom: grilleName,
            content: grilleContent,
            activate: true
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur de création");
        
        addToast(`Configuration "${grilleName}" activée avec succès !`, 'success');
        
        // Mettre à jour le message source pour transformer `json_grille_proposal` en `json_grille_applied`
        setMessages(prev => prev.map(m => {
          if (m.id === msgId) {
            return { ...m, text: m.text.replace('```json_grille_proposal', '```json_grille_applied') };
          }
          return m;
        }));

        setMessages(prev => [...prev, { 
          id: nextMsgId(), 
          sender: "bot", 
          text: `✅ Configuration **"${grilleName}"** appliquée avec succès ! Le tableau de bord est à jour.` 
        }]);

        if (onRefresh) onRefresh();
      } catch (err) {
        addToast(err.message || "Erreur lors de l'application de la grille", 'error');
        setMessages(prev => [...prev, { 
          id: nextMsgId(), 
          sender: "bot", 
          text: `❌ Erreur lors de l'application : ${err.message}` 
        }]);
      } finally {
        setIsLoading(false);
      }
    } else if (actionType === 'select_kpi') {
      // Au lieu d'envoyer tout de suite, on met dans pending
      setPendingKpiSelections(prev => ({ ...prev, [payload.user_name]: payload }));
    } else if (actionType === 'send_queued_kpis') {
      const items = Object.values(pendingKpiSelections);
      if (items.length === 0) return;
      
      const newConfirmed = {};
      items.forEach(i => newConfirmed[i.user_name] = i);
      setConfirmedKpis(prev => ({ ...prev, ...newConfirmed }));
      setPendingKpiSelections({});
      
      const msgLines = items.map(p => `- Pour "${p.user_name}", j'utilise le KPI : [${p.code_kpi}] – ${p.libelle}`);
      await sendMessageToBot("Je valide les choix suivants :\n" + msgLines.join("\n"));
    } else if (actionType === 'submit_kpi_formats') {
      // payload est le dictionnaire formats mappé par code_kpi
      setConfirmedKpis(prev => ({ ...prev, ['_formats_submitted_' + msgId]: true }));
      
      const formatLines = Object.values(payload).map(f => 
        `- **${f.user_name || f.libelle}** (${f.code_kpi}) : Unité = ${f.unite}, Mode de calcul = ${f.mode_prime}`
      );
      
      const msg = `Voici mes choix de format pour les KPIs :\n${formatLines.join('\n')}\n\nVous pouvez passer à l'étape suivante.`;
      await sendMessageToBot(msg);
    } else if (actionType === 'confirm_logic') {
      setConfirmedKpis(prev => ({ ...prev, ['_logic_confirmed_' + msgId]: true }));
      await sendMessageToBot("Cette logique me convient parfaitement. Veuillez maintenant générer la proposition de grille complète avec les données réelles et les simulations.");
    } else if (actionType === 'select_multiple_kpis') {
      // payload est une liste d'objets KPI
      const selectedNames = payload.map(k => k.libelle).join(', ');
      const msg = `Je souhaite utiliser les KPIs suivants : ${selectedNames}.`;
      
      // On pré-remplit confirmedKpis pour éviter que l'IA ne repose la question un par un
      const newConfirmed = {};
      payload.forEach(k => {
        // En mode multi, user_name est souvent égal au libelle ou code
        newConfirmed[k.libelle] = k;
        newConfirmed[k.code_kpi] = k;
      });
      setConfirmedKpis(prev => ({ ...prev, ...newConfirmed }));

      await sendMessageToBot(msg);
    } else if (actionType === 'request_simulation') {
      const grilleConfig = payload;
      setProposalSimulations(prev => ({ ...prev, [msgId]: { loading: true, agents: null, error: null } }));
      try {
        const agentsRes = await authFetch(`/api/regles/${regleId}/agents`);
        const agentsData = await agentsRes.json();
        const sampleAgents = (agentsData.data || []).slice(0, 2);
        if (sampleAgents.length === 0) {
          setProposalSimulations(prev => ({ ...prev, [msgId]: { loading: false, agents: [], error: "Aucun agent rattaché à cette règle.", mois: '' } }));
          return;
        }
        const prevMonth = getPreviousMonthRange();
        const matricules = sampleAgents.map(a => a.matricule).filter(Boolean).join(',');
        const kpiRes = await authFetch(`/api/regles/${regleId}/calcul?date_debut=${prevMonth.debut}&date_fin=${prevMonth.fin}&matricules=${matricules}`);
        const kpiData = await kpiRes.json();
        const unifiedMap = kpiData.data || {};
        const fakeRegle = { grille_objectifs: grilleConfig };
        const fakeLocalData = {};
        sampleAgents.forEach(a => {
          fakeLocalData[a.matricule] = {
            statut: a.statut || grilleConfig.statuts?.[0]?.nom || 'Confirmé',
            sanction: 'Non',
            abs_injust: 0, retards: 0, abs_just: 0, cp_css: 0
          };
        });
        const agentResults = sampleAgents.map(agent => {
          const d = fakeLocalData[agent.matricule];
          const kpiResults = calculateKpiResults(agent.matricule, d.statut, 'Non', fakeRegle, unifiedMap, {});
          const assiduite = calculateAssiduite(agent.matricule, fakeLocalData, fakeRegle);
          const montant = calculateMontantFinal(agent.matricule, d.statut, 'Non', kpiResults, assiduite, fakeLocalData, fakeRegle, unifiedMap);
          return {
            matricule: agent.matricule,
            nom: `${agent.prenom || ''} ${agent.nom || ''}`.trim() || agent.matricule,
            statut: d.statut,
            kpiResults,
            assiduite,
            montant,
            totalPrime: (montant.prime || 0) + (montant.super_bonus || 0)
          };
        });
        setProposalSimulations(prev => ({ ...prev, [msgId]: { loading: false, agents: agentResults, error: null, mois: prevMonth.label } }));
      } catch (err) {
        setProposalSimulations(prev => ({ ...prev, [msgId]: { loading: false, agents: null, error: `Erreur : ${err.message}` } }));
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || isLocked) return;
    const userText = input.trim();
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await sendMessageToBot(userText);
  };

  const sendMessageToBot = async (userText) => {
    const userMsgId = nextMsgId();
    const botMsgId  = nextMsgId();
    setMessages(prev => [...prev, { id: userMsgId, sender: "user", text: userText }]);
    setMessages(prev => [...prev, { id: botMsgId,  sender: "bot",  text: "" }]);
    setIsLoading(true);

    try {
      const response = await authFetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          regle_id: regleId,
          conversation_id: currentConvId // null si nouvelle conv
        })
      });

      if (!response.ok) {
        let errStr = "Erreur lors de la communication avec l'assistant";
        try { const d = await response.json(); errStr = d.error || errStr; } catch(e){}
        throw new Error(errStr);
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let botText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunkStr = decoder.decode(value, { stream: true });
        const lines = chunkStr.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();
            if (!dataStr) continue;
            
            try {
              const data = JSON.parse(dataStr);
              
              if (data.meta) {
                if (!currentConvId && data.meta.conversation_id) {
                  setCurrentConvId(data.meta.conversation_id);
                }
                if (data.meta.is_locked) {
                  setIsLocked(true);
                }
              } else if (data.chunk) {
                botText += data.chunk;
                setMessages(prev => prev.map(msg => 
                  msg.id === botMsgId ? { ...msg, text: botText } : msg
                ));
              } else if (data.done) {
                // finished
              }
            } catch (e) {
              console.error("Erreur parsing SSE data:", dataStr);
            }
          }
        }
      }

    } catch (err) {
      console.error(err);
        setMessages(prev => [...prev, { id: nextMsgId(), sender: "bot", text: "Désolé, je rencontre une erreur de connexion : " + err.message }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (msg) => {
    if (isLoading) return;
    setEditingMessageId(msg.id);
    setEditInputValue(msg.text);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditInputValue("");
  };

  const submitEdit = async (msgId) => {
    if (!editInputValue.trim() || isLoading) return;
    const newText = editInputValue.trim();
    setEditingMessageId(null);
    setEditInputValue("");

    if (currentConvId && msgId) {
      try {
        await authFetch(`/api/conversations/${currentConvId}/messages/${msgId}/truncate`, {
          method: 'DELETE'
        });
        setIsLocked(false);
      } catch (err) {
        console.error("Erreur suppression historique", err);
      }
    }
    
    // Remove local state from this msg.id onwards
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === msgId);
      if (idx === -1) return prev;
      return prev.slice(0, idx);
    });
    
    await sendMessageToBot(newText);
  };

  const requestDeleteConversation = (e, convId) => {
    e.stopPropagation(); // Évite de cliquer sur la ligne
    setConvToDelete(convId);
    setDeleteModalOpen(true);
  };

  const confirmDeleteConversation = async () => {
    if (!convToDelete) return;
    const convId = convToDelete;
    setDeleteModalOpen(false);
    setConvToDelete(null);
    
    try {
      const res = await authFetch(`/api/conversations/${convId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Erreur serveur");
      
      addToast("Conversation supprimée.", "success");
      refreshHistory(); // Recharge la liste
      
      // Si la conv supprimée était celle en cours, on reset la vue
      if (currentConvId === convId) {
        startNewChat();
        setView('history');
      }
    } catch (err) {
      addToast("Impossible de supprimer la conversation", "error");
      console.error(err);
    }
  };

  return (
    <aside className="ai-sidebar">
      <div className="ai-sidebar__header">
        <h3 className="ai-sidebar__title">
          <i className="fa-solid fa-robot"></i> Assistant IA
        </h3>
        <div className="ai-sidebar__header-actions">
          <button 
            className={`ai-sidebar__action-btn ${view === 'history' ? 'active' : ''}`}
            onClick={() => setView(v => v === 'history' ? 'chat' : 'history')}
            title="Historique"
          >
            <i className="fa-solid fa-clock-rotate-left"></i>
          </button>
          <button 
            className="ai-sidebar__action-btn"
            onClick={startNewChat}
            title="Nouvelle conversation"
          >
            <i className="fa-solid fa-plus"></i>
          </button>
          <button className="ai-sidebar__close" onClick={onClose} title="Fermer le panneau IA">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      {view === 'history' ? (
        <div className="ai-sidebar__history">
          <h4 className="ai-sidebar__history-title">Historique des conversations</h4>
          {(!conversations || conversations.length === 0) ? (
            <div className="ai-sidebar__history-empty">Aucune conversation passée.</div>
          ) : (
            <ul className="ai-sidebar__history-list">
              {conversations.map(conv => (
                <li 
                  key={conv.id} 
                  className={`ai-sidebar__history-item ${conv.id === currentConvId ? 'active' : ''}`}
                  onClick={() => loadConversation(conv.id, conv.is_locked)}
                >
                  <div className="ai-sidebar__history-item-content">
                    <div className="ai-sidebar__history-item-title">
                      {Boolean(conv.is_locked) && <i className="fa-solid fa-lock" title="Verrouillée (limite atteinte)"></i>}
                      {conv.titre}
                    </div>
                    <div className="ai-sidebar__history-item-date">
                      {new Date(conv.updated_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <button 
                    className="ai-sidebar__history-delete-btn"
                    onClick={(e) => requestDeleteConversation(e, conv.id)}
                    title="Supprimer la conversation"
                  >
                    <i className="fa-regular fa-trash-can"></i>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div className="ai-sidebar__chat">
            {messages.map((msg, idx) => (
              <div key={msg.id || idx} className={`ai-message-wrapper ai-message-wrapper--${msg.sender}`}>
                <div className={`ai-message ai-message--${msg.sender}`}>
                  {editingMessageId === msg.id ? (
                    <div className="ai-message__edit-inline">
                      <textarea
                        className="ai-sidebar__input ai-sidebar__input--edit"
                        value={editInputValue}
                        onChange={(e) => {
                          setEditInputValue(e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        autoFocus
                        onFocus={e => {
                          const val = e.target.value;
                          e.target.value = '';
                          e.target.value = val;
                          e.target.style.height = 'auto';
                          e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                      />
                      <div className="ai-message__edit-actions">
                        <button className="btn-cancel" onClick={cancelEditing}>Annuler</button>
                        <button className="btn-save" onClick={() => submitEdit(msg.id)}>Envoyer</button>
                      </div>
                    </div>
                  ) : msg.sender === 'bot' && msg.text === "" && isLoading ? (
                    <div className="ai-message--loading">
                      <i className="fa-solid fa-ellipsis fa-fade"></i>
                    </div>
                  ) : msg.sender === 'bot' ? (
                    <MarkdownMessage 
                      text={msg.text} 
                      msgId={msg.id} 
                      onActionClick={(type, payload) => handleActionClick(type, payload, msg.id)} 
                      simulation={proposalSimulations[msg.id]} 
                      confirmedKpis={confirmedKpis} 
                      pendingKpiSelections={pendingKpiSelections}
                    />
                  ) : (
                    msg.text
                  )}
                </div>
                {msg.sender === 'bot' && msg.text && (
                  <button 
                    className="ai-message__action-btn" 
                    onClick={() => {
                      navigator.clipboard.writeText(msg.text);
                      addToast("Texte copié !", "success");
                    }}
                    title="Copier le texte"
                  >
                    <i className="fa-regular fa-copy"></i>
                  </button>
                )}
                {msg.sender === 'user' && !isLoading && editingMessageId !== msg.id && (
                  <button 
                    className="ai-message__action-btn" 
                    onClick={() => startEditing(msg)}
                    title="Éditer et renvoyer ce message"
                  >
                    <i className="fa-solid fa-pen"></i>
                  </button>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="ai-sidebar__input-area">
            {Object.keys(pendingKpiSelections).length > 0 && !isLoading && (
              <div style={{ paddingBottom: '12px' }}>
                <button 
                  style={{ 
                    width: '100%', 
                    background: 'var(--color-accent)', 
                    color: 'white', 
                    border: 'none', 
                    padding: '10px 16px', 
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                  onClick={() => handleActionClick('send_queued_kpis')}
                >
                  <i className="fa-solid fa-paper-plane"></i> Valider les {Object.keys(pendingKpiSelections).length} sélection(s)
                </button>
              </div>
            )}
            
            {isLocked ? (
              <div className="ai-sidebar__locked-msg">
                <i className="fa-solid fa-lock"></i> Conversation terminée (limite atteinte). <br/>
                <a href="#" onClick={(e) => { e.preventDefault(); startNewChat(); }}>Démarrer un nouveau chat</a>
              </div>
            ) : (
              <>
                <textarea
                  ref={textareaRef}
                  className="ai-sidebar__input"
                  placeholder="Posez votre question sur cette règle..."
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={isLoading}
                />
                <button 
                  className="ai-sidebar__send" 
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                >
                  <i className="fa-solid fa-paper-plane"></i>
                </button>
              </>
            )}
          </div>
        </>
      )}

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setConvToDelete(null);
        }}
        onConfirm={confirmDeleteConversation}
        title="Supprimer la conversation"
        message="Voulez-vous vraiment supprimer cette conversation ? Cette action est irréversible."
        confirmText="Supprimer"
        type="danger"
      />
    </aside>
  );
}
