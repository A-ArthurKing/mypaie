import React, { useState, useRef, useEffect } from "react";
import "./AiSidebar.css";

export default function AiSidebar({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    { id: 1, sender: "bot", text: "Bonjour ! Je suis votre IA spécialisée dans la création de grilles d'objectifs. Décrivez-moi les critères de votre prime." }
  ]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = () => {
    if (!input.trim()) return;
    
    setMessages(prev => [...prev, { id: Date.now(), sender: "user", text: input }]);
    setInput("");
    
    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now(), sender: "bot", text: "Je génère la grille au format JSON d'après vos instructions..." }]);
    }, 1000);
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
        <div ref={chatEndRef} />
      </div>

      <div className="ai-sidebar__input-area">
        <textarea
          className="ai-sidebar__input"
          placeholder="Décrivez les tranches, KPIs, montants..."
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button 
          className="ai-sidebar__send" 
          onClick={handleSend}
          disabled={!input.trim()}
        >
          <i className="fa-solid fa-paper-plane"></i>
        </button>
      </div>
    </aside>
  );
}
