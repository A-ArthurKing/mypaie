/*
 * Fichier : ToolbarSection.jsx
 * Rôle    : Barre d'outils de l'onglet Objectifs — navigation entre les
 *           configurations de grille, actions d'activation, édition et suppression.
 * Dépend  : ToolbarSection.css
 * Module  : mypaie / Pages / ReglesPrimes / SubPages / RegleDetail / ObjectifsOnglet
 */
import React, { useState, useRef, useEffect } from 'react';
import './ToolbarSection.css';

export default function ToolbarSection({
  title,
  configs = [],
  activeConfigId,
  onSelectConfig,
  onActivateConfig,
  onEdit,
  onDelete,
  onDeleteVersion,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}) {
  const activeConfig = configs.find(c => c.id === activeConfigId);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="objectifs-toolbar">
      <div className="objectifs-toolbar__left">
        <div className="grille-move-controls">
          <button 
            className="btn-move up" 
            onClick={onMoveUp} 
            disabled={isFirst}
            title="Monter la grille"
          >
            <i className="fa-solid fa-caret-up"></i>
          </button>
          <button 
            className="btn-move down" 
            onClick={onMoveDown} 
            disabled={isLast}
            title="Descendre la grille"
          >
            <i className="fa-solid fa-caret-down"></i>
          </button>
        </div>
        <h3 className="objectifs-toolbar__title">{title}</h3>
        
        <div className="version-manager" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <div className="version-selector-beautiful" ref={dropdownRef}>
                <label>VERSION :</label>
                <div className="custom-select-wrapper" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                  <div className="custom-select-trigger">
                    <span>
                      {activeConfig ? activeConfig.libelle : 'Sélectionner...'}
                    </span>
                    <i className={`fa-solid fa-chevron-down transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}></i>
                  </div>
                  {isDropdownOpen && (
                    <div className="custom-select-menu">
                      {configs.map(c => (
                        <div 
                          key={c.id} 
                          className={`custom-select-option ${c.id === activeConfigId ? 'selected' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectConfig(c.id);
                            setIsDropdownOpen(false);
                          }}
                        >
                          <div className="option-label">{c.libelle}</div>
                          {c.est_active && <span className="option-badge">Active</span>}
                          {c.id === activeConfigId && <i className="fa-solid fa-check option-check"></i>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {activeConfig && (
                  <button 
                      className="btn-toolbar btn-toolbar--delete-version" 
                      onClick={() => onDeleteVersion(activeConfig.id, activeConfig.libelle)} 
                      title="Supprimer cette version uniquement"
                  >
                      <i className="fa-solid fa-trash-can"></i>
                  </button>
                )}
            </div>

            {activeConfig && !activeConfig.est_active && (
                <button 
                    className="btn-activate-version" 
                    onClick={() => onActivateConfig(activeConfig.id)}
                    title="Activer cette version pour le calcul"
                >
                    <i className="fa-solid fa-check"></i> Activer
                </button>
            )}

            {activeConfig?.est_active && (
                <span className="badge-active-status">
                    <i className="fa-solid fa-circle-check"></i> Active
                </span>
            )}
        </div>
      </div>
      <div className="objectifs-toolbar__right">
        <button className="btn-toolbar btn-toolbar--edit" onClick={onEdit}>
          <i className="fa-solid fa-pen-to-square"></i> Modifier / Nouvelle Version
        </button>
        <button className="btn-toolbar btn-toolbar--delete" onClick={onDelete} title="Supprimer cette grille">
          <i className="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  );
}
