/*
 * Fichier : ToolbarSection.jsx
 * Rôle    : Barre d'outils de l'onglet Objectifs — navigation entre les
 *           configurations de grille, actions d'activation, édition et suppression.
 * Dépend  : ToolbarSection.css
 * Module  : mypaie / Pages / ReglesPrimes / SubPages / RegleDetail / ObjectifsOnglet
 */
import React from 'react';
import './ToolbarSection.css';
  const activeConfig = configs.find(c => c.id === activeConfigId);

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
            <div className="version-selector">
                <label>Version :</label>
                <select 
                    value={activeConfigId || ''} 
                    onChange={(e) => onSelectConfig(Number(e.target.value))}
                    className="version-select"
                >
                    {configs.map(c => (
                        <option key={c.id} value={c.id}>
                            {c.libelle} {c.est_active ? '✓' : ''}
                        </option>
                    ))}
                </select>
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
