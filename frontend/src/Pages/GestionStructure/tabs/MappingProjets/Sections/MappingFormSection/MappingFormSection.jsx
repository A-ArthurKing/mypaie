/*
 * Fichier : MappingFormSection.jsx
 * Rôle    : Formulaire de création et d'édition d'un mapping projet
 *           (source BigQuery → projet / file / activité standard).
 * Dépend  : Props injectées par MappingProjets.jsx
 * Module  : mypaie / Pages / GestionStructure / tabs / MappingProjets
 */
export default function MappingFormSection({ 
  tables, columns, uniqueValues, projects, files, activities,
  sourceTable, setSourceTable, 
  sourceColumn, setSourceColumn,
  sourceName, setSourceName, 
  idProjet, setIdProjet,
  idFile, setIdFile,
  idActivite, setIdActivite,
  description, setDescription, 
  isSubmitting, handleSubmit,
  loadingCols, loadingValues
}) {
  return (
    <div className="mp-form-card">
      <div className="mk-card-header">
        <i className="fa-solid fa-plus-circle"></i>
        <h3>Lier un projet source à un projet Standard</h3>
      </div>
      
      <form className="mp-form" onSubmit={handleSubmit}>
        <div className="mp-form-grid">
          
          {/* 1. Sélection de la Table */}
          <div className="mp-field">
            <label>1. Table Source (BigQuery)</label>
            <div className="mp-input-wrapper">
              <i className="fa-solid fa-table"></i>
              <select 
                value={sourceTable} 
                onChange={(e) => setSourceTable(e.target.value)} 
                required
              >
                <option value="">-- Sélectionner une table --</option>
                {tables.map(t => (
                  <option key={t.id} value={t.id}>{t.id}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Sélection de la Colonne */}
          <div className="mp-field">
            <label>2. Colonne "Projet"</label>
            <div className="mp-input-wrapper">
              <i className="fa-solid fa-columns"></i>
              <select 
                value={sourceColumn} 
                onChange={(e) => setSourceColumn(e.target.value)} 
                disabled={!sourceTable || loadingCols}
                required
              >
                <option value="">{loadingCols ? 'Chargement...' : '-- Sélectionner la colonne --'}</option>
                {columns.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Sélection de la Valeur Source */}
          <div className="mp-field">
            <label>3. Valeur brute trouvée</label>
            <div className="mp-input-wrapper">
              <i className="fa-solid fa-database"></i>
              <select 
                value={sourceName} 
                onChange={(e) => setSourceName(e.target.value)} 
                disabled={!sourceColumn || loadingValues}
                required
              >
                <option value="">{loadingValues ? 'Analyse en cours...' : '-- Sélectionner le nom brut --'}</option>
                {uniqueValues.map(val => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Sélection du Projet Standard */}
          <div className="mp-field">
            <label>4. Destination (Projet Standard)</label>
            <div className="mp-input-wrapper">
              <i className="fa-solid fa-tag"></i>
              <select
                value={idProjet}
                onChange={(e) => setIdProjet(e.target.value)}
                required
              >
                <option value="">-- Sélectionner le projet standard --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.libelle}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 5. Sélection du File associé */}
          <div className="mp-field">
            <label>5. File associé (Optionnel)</label>
            <div className="mp-input-wrapper">
              <i className="fa-solid fa-layer-group"></i>
              <select value={idFile} onChange={(e) => setIdFile(e.target.value)}>
                <option value="">-- Aucun --</option>
                {files.map(f => (
                  <option key={f.id} value={f.id}>{f.libelle}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 6. Sélection de l'Activité associée */}
          <div className="mp-field">
            <label>6. Activité associée (Optionnel)</label>
            <div className="mp-input-wrapper">
              <i className="fa-solid fa-folder-open"></i>
              <select value={idActivite} onChange={(e) => setIdActivite(e.target.value)}>
                <option value="">-- Aucune --</option>
                {activities.map(a => (
                  <option key={a.id} value={a.id}>{a.libelle}</option>
                ))}
              </select>
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
          
          {(sourceTable || idProjet) && (
            <button 
              type="button" 
              className="mp-btn mp-btn--ghost"
              onClick={() => {
                setSourceTable('');
                setSourceColumn('');
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
