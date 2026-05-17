/*
 * Fichier : MappingFormSection.jsx
 * Rôle    : Formulaire de création et d'édition d'un mapping projet
 *           (source BigQuery → projet / file / activité standard).
 * Dépend  : Props injectées par MappingProjets.jsx
 * Module  : mypaie / Pages / GestionStructure / tabs / MappingProjets
 */
import Select from 'react-select';

const customSelectStyles = {
  control: (base, state) => ({
    ...base,
    borderRadius: 'var(--radius-md)', 
    borderWidth: '1px',
    borderColor: state.isFocused ? 'var(--color-accent)' : 'var(--color-border)',
    boxShadow: state.isFocused ? '0 0 0 3px var(--color-accent-soft)' : 'none',
    '&:hover': { borderColor: state.isFocused ? 'var(--color-accent)' : 'var(--color-border-strong)' },
    fontSize: 'var(--text-sm)', 
    minHeight: '38px',
    paddingLeft: '32px'
  }),
  valueContainer: (base) => ({
    ...base,
    paddingLeft: '0px'
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? 'var(--color-accent)' : state.isFocused ? 'var(--color-surface-hover)' : 'transparent',
    color: state.isSelected ? 'white' : 'var(--color-text-primary)',
    fontSize: 'var(--text-sm)', 
    cursor: 'pointer',
    '&:active': { backgroundColor: 'var(--color-accent)' }
  }),
  singleValue: (base) => ({ ...base, color: 'var(--color-text-primary)', fontWeight: '500' }),
  placeholder: (base) => ({ ...base, color: 'var(--color-text-disabled)' })
};

export default function MappingFormSection({ 
  uniqueValues, projects, sous_projets, activities,
  sourceName, setSourceName, 
  idProjet, setIdProjet,
  idFile, setIdSousProjet,
  idActivite, setIdActivite,
  description, setDescription, 
  isSubmitting, handleSubmit,
  loadingValues
}) {
  return (
    <div className="mp-form-card">
      <div className="mp-card-header">
        <i className="fa-solid fa-plus-circle"></i>
        <h3>Lier un projet source à un projet Standard</h3>
      </div>
      
      <form className="mp-form" onSubmit={handleSubmit}>
        <div className="mp-form-grid">
          
          {/* 1. Sélection de la Valeur Source */}
          <div className="mp-field">
            <label>1. Valeur brute trouvée (Source BigQuery)</label>
            <div className="mp-input-wrapper">
              <i className="fa-solid fa-database"></i>
              <Select
                options={uniqueValues.map(v => ({ value: v, label: v }))}
                value={sourceName ? { value: sourceName, label: sourceName } : null}
                onChange={opt => setSourceName(opt.value)}
                placeholder={loadingValues ? 'Analyse en cours...' : '-- Sélectionner le nom brut --'}
                isDisabled={loadingValues}
                styles={customSelectStyles}
                className="mp-react-select"
                classNamePrefix="rs"
              />
            </div>
          </div>

          {/* 2. Sélection du Projet Standard */}
          <div className="mp-field">
            <label>2. Destination (Projet Standard)</label>
            <div className="mp-input-wrapper">
              <i className="fa-solid fa-tag"></i>
              <Select
                options={projects.map(p => ({ value: p.id, label: p.libelle }))}
                value={idProjet ? { value: idProjet, label: projects.find(p => p.id === idProjet)?.libelle } : null}
                onChange={opt => setIdProjet(opt.value)}
                placeholder="-- Sélectionner le projet standard --"
                styles={customSelectStyles}
                className="mp-react-select"
                classNamePrefix="rs"
              />
            </div>
          </div>

          {/* 3. Sélection du File associé */}
          <div className="mp-field">
            <label>3. File associé (Optionnel)</label>
            <div className="mp-input-wrapper">
              <i className="fa-solid fa-layer-group"></i>
              <Select
                options={sous_projets.map(f => ({ value: f.id, label: f.libelle }))}
                value={idFile ? { value: idFile, label: sous_projets.find(f => f.id === idFile)?.libelle } : null}
                onChange={opt => setIdSousProjet(opt ? opt.value : '')}
                isClearable
                placeholder="-- Aucun --"
                styles={customSelectStyles}
                className="mp-react-select"
                classNamePrefix="rs"
              />
            </div>
          </div>

          {/* 4. Sélection de l'Activité associée */}
          <div className="mp-field">
            <label>4. Activité associée (Optionnel)</label>
            <div className="mp-input-wrapper">
              <i className="fa-solid fa-folder-open"></i>
              <Select
                options={activities.map(a => ({ value: a.id, label: a.libelle }))}
                value={idActivite ? { value: idActivite, label: activities.find(a => a.id === idActivite)?.libelle } : null}
                onChange={opt => setIdActivite(opt ? opt.value : '')}
                isClearable
                placeholder="-- Aucune --"
                styles={customSelectStyles}
                className="mp-react-select"
                classNamePrefix="rs"
              />
            </div>
          </div>

          <div className="mp-field mp-field--full" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="description">Notes / Description</label>
            <div className="mp-input-wrapper">
              <i className="fa-solid fa-align-left"></i>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Précisions sur ce mapping..."
                rows="2"
              />
            </div>
          </div>
        </div>

        <div className="mp-form-actions">
          <button 
            type="submit" 
            className="mp-btn mp-btn--primary"
            disabled={isSubmitting || !sourceName.trim() || !idProjet}
          >
            {isSubmitting ? (
              <><i className="fa-solid fa-spinner fa-spin"></i> Enregistrement...</>
            ) : (
              <><i className="fa-solid fa-check"></i> Enregistrer le mapping</>
            )}
          </button>
          
          {(sourceName || idProjet) && (
            <button 
              type="button" 
              className="mp-btn mp-btn--ghost"
              onClick={() => {
                setSourceName('');
                setIdProjet('');
                setDescription('');
              }}
            >
              Réinitialiser
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
