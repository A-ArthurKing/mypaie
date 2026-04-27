import { Routes, Route, Navigate } from 'react-router-dom'
import MappingProjets from './Components/MappingProjets/MappingProjets'
import './Parametres.css'

function Parametres() {
  return (
    <div className="parametres-page">
      <div className="parametres-header">
        <h1 className="parametres-title">Paramètres Généraux</h1>
        <p className="parametres-subtitle">Administration et configuration de la plateforme</p>
      </div>

      <div className="parametres-container">
        {/* Menu latéral propre à la page paramètres pour futures configs */}
        <aside className="parametres-nav">
          <ul className="parametres-nav-list">
            <li>
              <div className="parametres-nav-item parametres-nav-item--active">
                <i className="fa-solid fa-code-merge" />
                Mapping Projets
              </div>
            </li>
            {/* Autres onglets plus tard: Périodes, Utilisateurs, etc. */}
          </ul>
        </aside>

        <main className="parametres-content">
          <Routes>
            <Route path="mapping-projets" element={<MappingProjets />} />
            <Route path="*" element={<Navigate to="mapping-projets" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default Parametres
