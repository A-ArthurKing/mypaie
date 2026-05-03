/*
 * Fichier : AgentsOnglet.jsx
 * Rôle    : Onglet "Agents" — liste les agents SIRH rattachés à la règle
 *           (filtrés par projet/opération) avec recherche et filtre.
 * Module  : mypaie / Pages / ReglesPrimes / SubPages / Onglets
 */

import React, { useState, useEffect, useMemo } from 'react';
import './AgentsOnglet.css';
import ToolbarSection from './Sections/ToolbarSection/ToolbarSection';
import KpiInfoModal from '../../../../../../Components/KpiInfoModal/KpiInfoModal';

export default function AgentsOnglet({ regle }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchAgent, setSearchAgent] = useState('');
  const [filterStatut, setFilterStatut] = useState('tous');
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [statutRefs, setStatutRefs] = useState([]);

  // État local pour gérer les modifications temporaires (optimistic UI)
  const [localAgentsData, setLocalAgentsData] = useState({});

  // Heures — sélecteur de mois
  const [heuresMap, setHeuresMap] = useState({});
  const [loadingHeures, setLoadingHeures] = useState(false);

  // Qualité
  const [qualiteMap, setQualiteMap] = useState({});
  const [loadingQualite, setLoadingQualite] = useState(false);

  // Mois sélectionné (format 'YYYY-MM'), initialisé au mois courant
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Calcul des bornes pour le mois sélectionné
  const selectedMonthRange = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const monthStr = String(month).padStart(2, '0');
    const label = new Date(year, month - 1, 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
    return {
      date_debut: `${year}-${monthStr}-01`,
      date_fin: `${year}-${monthStr}-${lastDay}`,
      label
    };
  }, [selectedMonth]);

  useEffect(() => {
    // Charger les statuts
    fetch('/api/parametres/references')
      .then(res => res.json())
      .then(data => setStatutRefs(data.statuts || []))
      .catch(err => console.error("Erreur statuts:", err));

    if (!regle?.id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/regles/${regle.id}/agents`)
      .then(res => res.json())
      .then(data => {
        setAgents(data.data || []);
        // Initialiser localAgentsData avec les données de la DB
        const initialData = {};
        (data.data || []).forEach(a => {
          initialData[a.matricule] = { 
            id_statut: a.id_statut, 
            statut: a.statut, 
            sanction: a.sanction 
          };
        });
        setLocalAgentsData(initialData);
      })
      .catch(() => setError("Impossible de contacter le SIRH."))
      .finally(() => setLoading(false));
  }, [regle?.id]);

  // Fetch heures et qualité du mois sélectionné
  useEffect(() => {
    if (agents.length === 0) return;
    
    const { date_debut, date_fin } = selectedMonthRange;
    const matricules = agents.map(a => a.matricule).filter(Boolean).join(',');

    // 1. Fetch Heures
    setLoadingHeures(true);
    setHeuresMap({});
    fetch(`/api/heures/totaux?date_debut=${date_debut}&date_fin=${date_fin}&matricules=${matricules}`)
      .then(res => res.json())
      .then(data => setHeuresMap(data.data || {}))
      .catch(err => console.error('[AgentsOnglet] Erreur fetch heures:', err))
      .finally(() => setLoadingHeures(false));

    // 2. Fetch Qualité
    setLoadingQualite(true);
    setQualiteMap({});
    fetch(`/api/qualite/totaux?date_debut=${date_debut}&date_fin=${date_fin}&matricules=${matricules}`)
      .then(res => res.json())
      .then(data => setQualiteMap(data.data || {}))
      .catch(err => console.error('[AgentsOnglet] Erreur fetch qualité:', err))
      .finally(() => setLoadingQualite(false));

  }, [agents, selectedMonthRange]);

  // Fonction pour calculer le montant cible d'un agent
  const calculateMontantCible = (agentMatricule, currentStatut, hasSanction) => {
    if (hasSanction === 'Oui') return 0;

    const postes = regle?.grille_objectifs?.postes || [];
    // On cherche un poste qui correspondrait à l'opération ou la fonction de l'agent
    // Pour l'instant, on prend le premier poste trouvé
    const posteConfig = postes[0]; 
    if (!posteConfig) return 0;

    const mappingStatut = {
      'Débutant': 'debutant',
      'Confirmé': 'confirme',
      'Sénior': 'senior'
    };

    const key = mappingStatut[currentStatut] || 'confirme';
    return posteConfig.niveaux?.[key]?.montant || 0;
  };

  const handleUpdateLocalData = (matricule, field, value) => {
    // Mise à jour locale (optimistic)
    const currentData = localAgentsData[matricule] || { id_statut: null, statut: 'Confirmé', sanction: 'Non' };
    let newData = { ...currentData, [field]: value };
    
    // Si on met à jour l'ID du statut, on met aussi à jour le label pour le calcul immédiat
    if (field === 'id_statut') {
      const selectedStatut = statutRefs.find(s => String(s.id) === String(value));
      if (selectedStatut) {
        newData.statut = selectedStatut.libelle;
      }
    }
    
    setLocalAgentsData(prev => ({
      ...prev,
      [matricule]: newData
    }));

    // Persistance en base
    fetch(`/api/regles/${regle.id}/agents/${matricule}/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newData)
    }).catch(err => console.error("Erreur sauvegarde agent:", err));
  };

  const filtered = agents.filter(a => {
    const fullName = `${a.prenom} ${a.nom} ${a.matricule}`.toLowerCase();
    return fullName.includes(searchAgent.toLowerCase());
  });

  const formulaData = {
    title: "Montant Cible",
    formula: "=SI(OU(NOM=\"\";STATUT=\"\";OP=\"\");\"\"; SI(SANCTION=\"Oui\"; 0; RECHERCHEV(STATUT; GRILLE_POSTES; 2; FAUX)))",
    sourceTable: "Base MySQL (matrice_primes.grille_objectifs)",
    metrics: "Statut, Sanction Disciplinaire, Opération (Poste)"
  };

  return (
    <div className="agents-onglet">
      <ToolbarSection
        searchAgent={searchAgent}
        setSearchAgent={setSearchAgent}
        filterStatut={filterStatut}
        setFilterStatut={setFilterStatut}
      />

      {loading && (
        <div className="agents-onglet__state">
          <i className="fa-solid fa-spinner fa-spin"></i>
          <p>Chargement des agents depuis le SIRH…</p>
        </div>
      )}

      {error && (
        <div className="agents-onglet__state agents-onglet__state--error">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="agents-onglet__state">
          <i className="fa-solid fa-users-slash"></i>
          <p>Aucun agent trouvé{searchAgent ? ` pour "${searchAgent}"` : ' pour cette opération'}.</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="agents-onglet__table-wrapper">
          <div className="agents-onglet__toolbar-row">
            <div className="agents-onglet__count">
              {filtered.length} agent{filtered.length > 1 ? 's' : ''}
            </div>
            <div className="agents-onglet__month-picker">
              <i className="fa-regular fa-calendar"></i>
              <label htmlFor="ao-month-select" className="agents-onglet__month-label">Heures du mois :</label>
              <input
                id="ao-month-select"
                type="month"
                className="agents-onglet__month-input"
                value={selectedMonth}
                max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
                onChange={e => setSelectedMonth(e.target.value)}
              />
            </div>
          </div>
          <table className="agents-table">
            <thead>
              <tr>
                <th>Matricule</th>
                <th>Nom Prénom</th>
                <th>Opération</th>
                <th>File</th>
                <th>Activité</th>
                <th style={{ textAlign: 'right' }} title={`Heures produites — ${selectedMonthRange.label}`}>
                  Heures
                  <span className="agents-table__month-badge">{selectedMonthRange.label}</span>
                </th>
                <th style={{ textAlign: 'right' }} title={`Moyenne qualité — ${selectedMonthRange.label}`}>
                  Qualité
                  <span className="agents-table__month-badge">{selectedMonthRange.label}</span>
                </th>
                <th style={{ textAlign: 'center' }}>Sanction</th>
                <th>Statut</th>
                <th style={{ textAlign: 'right' }}>
                  Montant Cible
                  <i 
                    className="fa-solid fa-circle-info agents-table__info-icon" 
                    onClick={() => setShowFormulaModal(true)}
                    title="Voir la formule"
                  ></i>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                const data = localAgentsData[a.matricule] || { statut: 'Confirmé', sanction: 'Non' };
                const montant = calculateMontantCible(a.matricule, data.statut, data.sanction);

                return (
                  <tr key={a.matricule || i}>
                    <td className="agents-table__matricule">{a.matricule}</td>
                    <td className="agents-table__name">
                      <span className="agents-table__lastname">{a.nom}</span>{' '}
                      <span className="agents-table__firstname">{a.prenom}</span>
                    </td>
                    <td>{a.operation}</td>
                    <td style={{ fontWeight: '500' }}>{a.file || '-'}</td>
                    <td style={{ fontWeight: '500' }}>{a.activite || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {loadingHeures ? (
                        <span className="agents-table__heures-loader"><i className="fa-solid fa-spinner fa-spin"></i></span>
                      ) : heuresMap[String(a.matricule)] != null ? (
                        <span className="agents-table__heures">
                          {(heuresMap[String(a.matricule)] / 3600000).toFixed(1)}<span className="agents-table__heures-unit">h</span>
                        </span>
                      ) : (
                        <span className="agents-table__heures-na">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {loadingQualite ? (
                        <span className="agents-table__heures-loader"><i className="fa-solid fa-spinner fa-spin"></i></span>
                      ) : qualiteMap[String(a.matricule)] != null ? (
                        <span className={`agents-table__qualite agents-table__qualite--${qualiteMap[String(a.matricule)] >= 80 ? 'good' : qualiteMap[String(a.matricule)] >= 50 ? 'average' : 'bad'}`}>
                          {qualiteMap[String(a.matricule)].toFixed(1)}<span className="agents-table__heures-unit">%</span>
                        </span>
                      ) : (
                        <span className="agents-table__heures-na">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span 
                        className={`agents-badge agents-badge--${data.sanction === 'Oui' ? 'danger' : 'success'} clickable`}
                        onClick={() => handleUpdateLocalData(a.matricule, 'sanction', data.sanction === 'Oui' ? 'Non' : 'Oui')}
                      >
                        {data.sanction}
                      </span>
                    </td>
                    <td>
                      <select 
                        className="agents-select-statut" 
                        value={data.id_statut || ''}
                        onChange={(e) => handleUpdateLocalData(a.matricule, 'id_statut', e.target.value)}
                      >
                        <option value="">Sélectionner</option>
                        {statutRefs.map(s => <option key={s.id} value={s.id}>{s.libelle}</option>)}
                      </select>
                    </td>
                    <td style={{ 
                      textAlign: 'right', 
                      fontWeight: 'bold', 
                      color: data.sanction === 'Oui' ? 'var(--color-text-muted)' : 'var(--color-accent)' 
                    }}>
                      {montant} DH
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <KpiInfoModal 
        isOpen={showFormulaModal}
        onClose={() => setShowFormulaModal(false)}
        data={formulaData}
      />
    </div>
  );
}

