/*
 * Fichier     : CadrePresenceOnglet.jsx
 * Rôle        : Onglet "Cadre & Présence" du détail d'une règle de prime.
 *               Orchestre les sections de configuration environnementale :
 *               1. TempsProrataSection    — Jours ouvrés, base horaire, calcul prorata
 *               2. AttendanceRulesSection — Règles d'assiduité (absences/retards)
 *               3. TriggerRulesSection   — Killing rules (événements critiques)
 * Note        : Toute la logique de performance (KPIs, Poids, Montants, Paliers)
 *               est désormais centralisée dans l'onglet "Objectifs".
 * Module      : mypaie / Pages / ReglesPrimes / SubPages / Onglets
 */

import React from 'react';
import { useToast } from '../../../../../../Shared/Contexts/ToastContext';
import './CadrePresenceOnglet.css';
import AccordionSection from './Components/AccordionSection/AccordionSection';
import TempsProrataSection from './Sections/TempsProrataSection/TempsProrataSection';
import AttendanceRulesSection from './Sections/AttendanceRulesSection/AttendanceRulesSection';
import TriggerRulesSection from './Sections/TriggerRulesSection/TriggerRulesSection';

export default function CadrePresenceOnglet({ regle, onRefresh }) {
  const addToast = useToast();

  // Persiste une mise à jour partielle de grille_objectifs via l'API puis recharge la page
  const handleSaveVariables = async (newGrille) => {
    try {
      const res = await fetch(`/api/regles/${regle.id}/grille`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grille_objectifs: newGrille })
      });
      if (res.ok) {
        onRefresh?.();
      }
    } catch (e) {
      console.error("Erreur lors de l'enregistrement des variables", e);
      addToast("Erreur lors de l'enregistrement des variables", 'error');
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

        {/* ── 1. Configuration Temps & Prorata ── */}
        <AccordionSection
          icon="fa-solid fa-clock"
          title="Configuration Temps & Prorata"
          subtitle="Jours ouvrés du mois, base horaire et règle de proratisation de la prime"
          {...getStatusObj('config_temps')}
        >
          <TempsProrataSection regle={regle} onSave={handleSaveVariables} />
        </AccordionSection>

        {/* ── 2. Assiduité & Discipline ── */}
        <AccordionSection
          icon="fa-solid fa-calendar-xmark"
          title="Assiduité & Discipline"
          subtitle="Impact des absences injustifiées et retards sur le montant final de la prime"
          {...getStatus('regles_assiduite')}
        >
          <AttendanceRulesSection regle={regle} onSave={handleSaveVariables} />
        </AccordionSection>

        {/* ── 3. Killing Rules ── */}
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


