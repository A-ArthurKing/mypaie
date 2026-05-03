import React, { useState, useEffect } from 'react';
import './AttendanceRulesSection.css';

const DEFAULT_RULES = [
  { id: 1, label: "Perte de 50%", abs: 1, retards: 4, label_ui: "Moitié de la prime est perdue" },
  { id: 2, label: "Perte de 100%", abs: 2, retards: 8, label_ui: "Totalité de la prime est perdue" }
];

export default function AttendanceRulesSection({ regle, onSave }) {
  const [rules, setRules] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (regle?.grille_objectifs?.regles_assiduite) {
      setRules(regle.grille_objectifs.regles_assiduite);
    } else {
      setRules(DEFAULT_RULES);
    }
  }, [regle]);

  const handleUpdate = (id, field, val) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const newGrille = { 
        ...regle.grille_objectifs,
        regles_assiduite: rules 
    };
    await onSave(newGrille);
    setIsSaving(false);
  };

  return (
    <div className="attendance-rules-section">
      <div className="attendance-header">
        <h3 className="attendance-title">Règles d'assiduité & Discipline</h3>
        <p className="attendance-subtitle">Configurez l'impact des absences et retards sur le montant final de la prime.</p>
      </div>

      <div className="attendance-table-container">
        <table className="attendance-table">
          <thead>
            <tr>
              <th>Condition (Absences / Retards)</th>
              <th>Impact sur la prime</th>
              <th style={{ width: '80px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>
                  <div className="rule-inputs">
                    <div className="input-group">
                      <input 
                        type="number" 
                        value={rule.abs} 
                        onChange={(e) => handleUpdate(rule.id, 'abs', parseInt(e.target.value) || 0)}
                      />
                      <span>Abs. injustifiée(s)</span>
                    </div>
                    <span className="rule-separator">OU</span>
                    <div className="input-group">
                      <input 
                        type="number" 
                        value={rule.retards} 
                        onChange={(e) => handleUpdate(rule.id, 'retards', parseInt(e.target.value) || 0)}
                      />
                      <span>Retard(s)</span>
                    </div>
                  </div>
                </td>
                <td>
                  <input 
                    className="impact-input"
                    value={rule.label_ui}
                    onChange={(e) => handleUpdate(rule.id, 'label_ui', e.target.value)}
                    placeholder="Ex: Moitié de la prime est perdue"
                  />
                </td>
                <td className="center">
                  <button className="btn-icon danger" title="Supprimer la règle" onClick={() => setRules(rules.filter(r => r.id !== rule.id))}>
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="attendance-footer">
        <button className="btn btn-outline" onClick={() => setRules([...rules, { id: Date.now(), abs: 0, retards: 0, label_ui: "" }])}>
          + Ajouter un palier
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Enregistrement...' : 'Enregistrer les règles'}
        </button>
      </div>
    </div>
  );
}
