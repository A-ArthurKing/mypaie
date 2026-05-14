/*
 * Fichier : Parametres.jsx
 * Rôle    : Page Paramètres — achémine vers les onglets de configuration
 *           (Mapping Indicateurs KPIs).
 * Dépend  : HeaderSection, TabsSection, MappingKpis
 * Module  : mypaie / Pages / Parametres
 */
import { Routes, Route, Navigate } from 'react-router-dom'
import HeaderSection from './Sections/HeaderSection/HeaderSection'
import TabsSection from './Sections/TabsSection/TabsSection'
import Structure from './Onglets/Structure/Structure'
import MappingProjets from './Onglets/MappingProjets/MappingProjets'
import MappingKpis from './Onglets/MappingKpis/MappingKpis'
import KpiRegistry from './Onglets/KpiRegistry/KpiRegistry'
import './Parametres.css'

function Parametres() {
  return (
    <div className="parametres-page">
      <HeaderSection />
      <TabsSection />

      <main className="parametres-content">
        <Routes>
          <Route path="structure" element={<Structure />} />
          <Route path="mapping-projets" element={<MappingProjets />} />
          <Route path="mapping-kpis" element={<MappingKpis />} />
          <Route path="kpi-registry" element={<KpiRegistry />} />
          <Route path="" element={<Navigate to="structure" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default Parametres
