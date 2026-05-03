import { Routes, Route, Navigate } from 'react-router-dom'
import HeaderSection from './Sections/HeaderSection/HeaderSection'
import TabsSection from './Sections/TabsSection/TabsSection'
import MappingProjets from './Onglets/MappingProjets/MappingProjets'
import MappingKpis from './Onglets/MappingKpis/MappingKpis'
import './Parametres.css'

function Parametres() {
  return (
    <div className="parametres-page">
      <HeaderSection />
      <TabsSection />

      <main className="parametres-content">
        <Routes>
          <Route path="mapping-projets" element={<MappingProjets />} />
          <Route path="mapping-kpis" element={<MappingKpis />} />
          <Route path="" element={<Navigate to="mapping-projets" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default Parametres
