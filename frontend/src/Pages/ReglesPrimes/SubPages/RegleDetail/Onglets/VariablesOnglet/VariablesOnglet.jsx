/*
 * Fichier     : VariablesOnglet.jsx
 * Rôle        : Onglet "Variables" du détail d'une règle de prime.
 *               Orchestre les 5 sections de configuration du moteur de calcul,
 *               chacune encapsulée dans un AccordionSection repliable :
 *               1. TargetMatrixSection    — Postes & objectifs cibles par niveau
 *               2. WeightingSection       — Pondération des KPIs (nb de points)
 *               3. TempsProrataSection    — Jours ouvrés, base horaire, calcul prorata
 *               4. AttendanceRulesSection — Règles d'assiduité (absences/retards)
 *               5. TriggerRulesSection   — Killing rules (événements critiques)
 * Note        : Les paliers de calcul sont configurés dans l'onglet Objectifs (GrilleEditorModal).
 * Module      : mypaie / Pages / ReglesPrimes / SubPages / Onglets
 */

import React from 'react';
import './VariablesOnglet.css';
import AccordionSection from './Components/AccordionSection/AccordionSection';
import TargetMatrixSection from './Sections/TargetMatrixSection/TargetMatrixSection';
import WeightingSection from './Sections/WeightingSection/WeightingSection';
import TempsProrataSection from './Sections/TempsProrataSection/TempsProrataSection';
import AttendanceRulesSection from './Sections/AttendanceRulesSection/AttendanceRulesSection';
import TriggerRulesSection from './Sections/TriggerRulesSection/TriggerRulesSection';

export default function VariablesOnglet({ regle }) {

  // Persiste une mise à jour partielle de grille_objectifs via l'API puis recharge la page
  const handleSaveVariables = async (newGrille) => {
    try {
      const res = await fetch(`/api/regles/${regle.id}/grille`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grille_objectifs: newGrille })
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (e) {
      console.error("Erreur lors de l'enregistrement des variables", e);
      alert("Erreur lors de l'enregistrement des variables");
    }
  };

  // Détermine le badge de statut selon la présence ou non d'une config dans la grille (tableaux)
  const getStatus = (key) => {
    const hasData = regle?.grille_objectifs?.[key]?.length > 0;
    return {
      label:      hasData ? 'Configuré' : 'Non configuré',
      statusType: hasData ? 'success'   : 'warning',
    };
  };

  // Statut pour les clés de type objet (config_temps n'a pas de .length)
  const getStatusObj = (key) => {
    const hasData = regle?.grille_objectifs?.[key] != null;
    return {
      label:      hasData ? 'Configuré' : 'Non configuré',
      statusType: hasData ? 'success'   : 'warning',
    };
  };

  return (
    <div className="variables-onglet">

      <div className="variables-content">

        {/* ── 1. Postes & Cibles : ouverte par défaut (point de départ obligatoire) ── */}
        <AccordionSection
          icon="fa-solid fa-id-badge"
          title="Postes & Objectifs Cibles"
          subtitle="Définissez les postes d'agents et leurs objectifs KPI par niveau d'ancienneté"
          defaultOpen={true}
          {...getStatus('postes')}
        >
          <TargetMatrixSection regle={regle} onSave={handleSaveVariables} />
        </AccordionSection>

        {/* ── 2. Pondération : dépend des indicateurs configurés dans l'onglet Objectifs ── */}
        <AccordionSection
          icon="fa-solid fa-weight-hanging"
          title="Pondération des indicateurs"
          subtitle="Attribuez un nombre de points à chaque KPI pour le calcul du score final"
          {...getStatus('indicateurs')}
        >
          <WeightingSection regle={regle} onSave={handleSaveVariables} />
        </AccordionSection>

        {/* ── 3. Configuration Temps & Prorata ── */}
        <AccordionSection
          icon="fa-solid fa-clock"
          title="Configuration Temps & Prorata"
          subtitle="Jours ouvrés du mois, base horaire et règle de proratisation de la prime"
          {...getStatusObj('config_temps')}
        >
          <TempsProrataSection regle={regle} onSave={handleSaveVariables} />
        </AccordionSection>

        {/* ── 5. Assiduité & Discipline ── */}
        <AccordionSection
          icon="fa-solid fa-calendar-xmark"
          title="Assiduité & Discipline"
          subtitle="Impact des absences injustifiées et retards sur le montant final de la prime"
          {...getStatus('regles_assiduite')}
        >
          <AttendanceRulesSection regle={regle} onSave={handleSaveVariables} />
        </AccordionSection>

        {/* ── 6. Killing Rules ── */}
        <AccordionSection
          icon="fa-solid fa-skull-crossbones"
          title="Killing Rules"
          subtitle="Événements critiques entraînant une perte immédiate de la prime"
          {...getStatus('declencheurs')}
        >
          <TriggerRulesSection regle={regle} onSave={handleSaveVariables} />
        </AccordionSection>

      </div>
    </div>
  );
}


