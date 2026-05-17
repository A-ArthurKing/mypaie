import React, { useState, useRef, useEffect } from "react";
import "./AiSidebar.css";
import useApiSWR from "../../../../Shared/Hooks/useApiSWR";
import { useToast } from "../../../../Shared/Contexts/ToastContext";

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

function MarkdownMessage({ text, onActionClick }) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let listItems = [];
  let listType = null;
  let keyIdx = 0;
  
  let inCodeBlock = false;
  let codeBlockType = '';
  let codeBlockContent = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    const Tag = listType === 'ol' ? 'ol' : 'ul';
    elements.push(<Tag key={keyIdx++} className="ai-md-list">{listItems}</Tag>);
    listItems = [];
    listType = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Code block handling
    if (line.startsWith('```')) {
      flushList();
      if (inCodeBlock) {
        // End of code block
        const fullCode = codeBlockContent.join('\n');
        if (codeBlockType.trim() === 'json_grille_proposal') {
          try {
            const proposal = JSON.parse(fullCode);
            elements.push(
              <div key={keyIdx++} className="ai-grille-proposal">
                <div className="ai-grille-proposal-title">
                  <i className="fa-solid fa-file-invoice"></i> Proposition de Grille
                </div>
                <div className="ai-grille-proposal-body">
                  <strong>{proposal.grille_nom || proposal.nom || "Nouvelle Grille"}</strong>
                  <p>Cliquez ci-dessous pour valider et appliquer cette configuration.</p>
                  <button 
                    className="ai-btn-apply-grille"
                    onClick={() => onActionClick('create_grille', proposal)}
                  >
                    Valider et Créer la règle
                  </button>
                </div>
              </div>
            );
          } catch (e) {
            elements.push(<pre key={keyIdx++} className="ai-md-pre">{fullCode}</pre>);
          }
        } else {
          elements.push(<pre key={keyIdx++} className="ai-md-pre">{fullCode}</pre>);
        }
        inCodeBlock = false;
        codeBlockContent = [];
        codeBlockType = '';
      } else {
        // Start of code block
        inCodeBlock = true;
        codeBlockType = line.substring(3);
      }
      continue;
    }
    
    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

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
      // Ne pas casser une liste en cours juste pour un saut de ligne
      if (!listType) {
        elements.push(<div key={keyIdx++} className="ai-md-spacer"></div>);
      }
    } else {
      flushList();
      elements.push(<p key={keyIdx++} className="ai-md-p">{parseInline(line, keyIdx * 100)}</p>);
    }
  }
  flushList();
  return <>{elements}</>;
}
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_MESSAGE = { id: 0, sender: "bot", text: "Bonjour ! Je suis l'assistant IA de myPaie. Je peux répondre à vos questions sur cette règle de prime, ses objectifs (KPIs) et ses paramètres. Comment puis-je vous aider ?" };

export default function AiSidebar({ isOpen, onClose, regleId }) {
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
    setView('chat');
  };

  const handleActionClick = async (actionType, payload) => {
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
        setMessages(prev => [...prev, { 
          id: nextMsgId(), 
          sender: "bot", 
          text: `✅ Configuration **"${grilleName}"** appliquée avec succès ! Le tableau de bord est à jour.` 
        }]);
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
                  <div className="ai-sidebar__history-item-title">
                    {conv.is_locked && <i className="fa-solid fa-lock" title="Verrouillée (limite atteinte)"></i>}
                    {conv.titre}
                  </div>
                  <div className="ai-sidebar__history-item-date">
                    {new Date(conv.updated_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
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
                  ) : msg.sender === 'bot' ? (
                    <MarkdownMessage text={msg.text} onActionClick={handleActionClick} />
                  ) : (
                    msg.text
                  )}
                </div>
                {msg.sender === 'user' && !isLoading && editingMessageId !== msg.id && (
                  <button 
                    className="ai-message__edit-btn" 
                    onClick={() => startEditing(msg)}
                    title="Éditer et renvoyer ce message"
                  >
                    <i className="fa-solid fa-pen"></i>
                  </button>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="ai-message-wrapper ai-message-wrapper--bot">
                <div className="ai-message ai-message--bot ai-message--loading">
                  <i className="fa-solid fa-ellipsis fa-fade"></i>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="ai-sidebar__input-area">
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
    </aside>
  );
}
