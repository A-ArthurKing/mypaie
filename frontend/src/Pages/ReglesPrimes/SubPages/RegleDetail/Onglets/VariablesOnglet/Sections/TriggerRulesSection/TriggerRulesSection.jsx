import React, { useState, useEffect } from 'react';
import './TriggerRulesSection.css';

const DEFAULT_TRIGGERS = [
  { id: 1, label: "Réclamation client", count: 1, impact: "Toute la prime est perdue" }
];

export default function TriggerRulesSection({ regle, onSave }) {
  const [triggers, setTriggers] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (regle?.grille_objectifs?.declencheurs) {
      setTriggers(regle.grille_objectifs.declencheurs);
    } else {
      setTriggers(DEFAULT_TRIGGERS);
    }
  }, [regle]);

  const handleUpdate = (id, field, val) => {
    setTriggers(prev => prev.map(t => t.id === id ? { ...t, [field]: val } : t));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const newGrille = { 
        ...regle.grille_objectifs,
        declencheurs: triggers 
    };
    await onSave(newGrille);
    setIsSaving(false);
  };

  return (
    <div className="trs-section">
      <div className="trs-header">
        <h3 className="trs-title">Éléments déclencheurs (Killing Rules)</h3>
        <p className="trs-subtitle">Conditions critiques entraînant une perte immédiate de prime.</p>
      </div>

      <div className="trs-list">
        {triggers.map((trigger) => (
          <div key={trigger.id} className="trs-item">
            <div className="trs-item-config">
              <span className="trs-prefix">Dès</span>
              <input 
                type="number" 
                className="trs-count"
                value={trigger.count} 
                onChange={(e) => handleUpdate(trigger.id, 'count', parseInt(e.target.value) || 0)}
              />
              <input 
                className="trs-label"
                value={trigger.label}
                onChange={(e) => handleUpdate(trigger.id, 'label', e.target.value)}
                placeholder="Ex: Réclamation client"
              />
            </div>
            <div className="trs-item-impact">
              <i className="fa-solid fa-arrow-right"></i>
              <input 
                className="trs-impact-input"
                value={trigger.impact}
                onChange={(e) => handleUpdate(trigger.id, 'impact', e.target.value)}
                placeholder="Impact sur la prime"
              />
            </div>
            <button className="btn-icon danger" onClick={() => setTriggers(triggers.filter(t => t.id !== trigger.id))}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        ))}
      </div>

      <div className="trs-footer">
        <button className="btn btn-outline" onClick={() => setTriggers([...triggers, { id: Date.now(), label: "", count: 1, impact: "" }])}>
          + Ajouter un déclencheur
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Enregistrement...' : 'Enregistrer les déclencheurs'}
        </button>
      </div>
    </div>
  );
}
