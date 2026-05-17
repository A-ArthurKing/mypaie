import { useState, useEffect } from 'react';
import StructureSection from './sections/Structure/StructureSection';
import MappingProjetsSection from './sections/MappingProjets/MappingProjetsSection';
import './StructureProjets.css';

export default function StructureProjets() {
  const [activeSubTab, setActiveSubTab] = useState(() => {
    return localStorage.getItem('mypaie_tab_structure') || 'structure';
  });

  useEffect(() => {
    localStorage.setItem('mypaie_tab_structure', activeSubTab);
  }, [activeSubTab]);

  return (
    <div className="structure-projets-page">
      <div className="structure-projets-header">
        <div className="header-info">
          <h2>Structure & Projets</h2>
          <p>Gérez la hiérarchie organisationnelle et reliez les opérations brutes aux projets standards.</p>
        </div>
        
        <div className="sub-tabs-container">
          <button 
            className={`sub-tab-btn ${activeSubTab === 'structure' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('structure')}
          >
            <i className="fa-solid fa-sitemap"></i> Structure
          </button>
          <button 
            className={`sub-tab-btn ${activeSubTab === 'mapping' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('mapping')}
          >
            <i className="fa-solid fa-code-merge"></i> Mapping Projets
          </button>
        </div>
      </div>

      <div className="structure-projets-content">
        {activeSubTab === 'structure' && <StructureSection />}
        {activeSubTab === 'mapping' && <MappingProjetsSection />}
      </div>
    </div>
  );
}