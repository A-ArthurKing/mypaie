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
import StructureProjets from './Onglets/StructureProjets/StructureProjets'
import IndicateursKpis from './Onglets/IndicateursKpis/IndicateursKpis'
import Utilisateurs from './Onglets/Utilisateurs/Utilisateurs'
import './Parametres.css'

function Parametres() {
  return (
    <div className="parametres-page">
      <HeaderSection />
      <TabsSection />

      <main className="parametres-content">
        <Routes>
          <Route path="structure-projets" element={<StructureProjets />} />
          <Route path="indicateurs" element={<IndicateursKpis />} />
          <Route path="utilisateurs" element={<Utilisateurs />} />
          <Route path="" element={<Navigate to="structure-projets" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default Parametres
