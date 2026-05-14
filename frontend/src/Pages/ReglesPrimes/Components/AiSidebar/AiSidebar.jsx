import React, { useState, useRef, useEffect } from "react";
import "./AiSidebar.css";

export default function AiSidebar({ isOpen, onClose, regleId }) {
  const [messages, setMessages] = useState([
    { id: 1, sender: "bot", text: "Bonjour ! Je suis l'assistant IA de myPaie. Je peux répondre à vos questions sur cette règle de prime, ses objectifs (KPIs) et ses paramètres. Comment puis-je vous aider ?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userText = input.trim();
    setMessages(prev => [...prev, { id: Date.now(), sender: "user", text: userText }]);
    setInput("");
    setIsLoading(true);

    try {
      // Préparation de l'historique pour l'API (on exclut le tout premier message d'accueil)
      const history = messages.slice(1).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        text: m.text
      }));

      const response = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          regle_id: regleId,
          history: history
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la communication avec l'assistant");
      }

      setMessages(prev => [...prev, { id: Date.now(), sender: "bot", text: data.response }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { id: Date.now(), sender: "bot", text: "Désolé, je rencontre une erreur de connexion : " + err.message }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <aside className="ai-sidebar">
      <div className="ai-sidebar__header">
        <h3 className="ai-sidebar__title">
          <i className="fa-solid fa-robot"></i> Assistant Grille IA
        </h3>
        <button className="ai-sidebar__close" onClick={onClose} title="Fermer le panneau IA">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div className="ai-sidebar__chat">
        {messages.map(msg => (
          <div key={msg.id} className={`ai-message ai-message--${msg.sender}`}>
            {msg.text}
          </div>
        ))}
        {isLoading && (
          <div className="ai-message ai-message--bot ai-message--loading">
            <i className="fa-solid fa-ellipsis fa-fade"></i>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="ai-sidebar__input-area">
        <textarea
          className="ai-sidebar__input"
          placeholder="Posez votre question sur cette règle..."
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
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
      </div>
    </aside>
  );
}
