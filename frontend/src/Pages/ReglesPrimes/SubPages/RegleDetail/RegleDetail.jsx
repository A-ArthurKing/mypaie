/*
 * Fichier : RegleDetail.jsx
 * Rôle    : Page de détail d'une règle de prime — décomposée en onglets.
 * Module  : mypaie / Pages / ReglesPrimes / SubPages
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './RegleDetail.css';
import InfosSection from './Sections/InfosSection/InfosSection';
import CriteresSection from './Sections/CriteresSection/CriteresSection';
import AgentsSection from './Sections/AgentsSection/AgentsSection';

const ONGLETS = [
  { id: 'infos',    label: 'Informations',  icon: 'fa-solid fa-circle-info' },
  { id: 'criteres', label: 'Critères',       icon: 'fa-solid fa-sliders' },
  { id: 'agents',   label: 'Agents',         icon: 'fa-solid fa-users' },
];

export default function RegleDetail() {
  const { regleId } = useParams();
  const navigate = useNavigate();
  const [regle, setRegle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [ongletActif, setOngletActif] = useState('infos');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/regles/${regleId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Règle introuvable');
        return res.json();
      })
      .then((data) => {
        setRegle(data);
        setLoading(false);
      })
      .catch((e) => {
        setErreur(e.message);
        setLoading(false);
      });
  }, [regleId]);

  if (loading) {
    return (
      <div className="regle-detail">
        <div className="regle-detail__loading">
          <i className="fa-solid fa-spinner fa-spin"></i> Chargement…
        </div>
      </div>
    );
  }

  if (erreur || !regle) {
    return (
      <div className="regle-detail">
        <button className="regle-detail__retour" onClick={() => navigate('/regles-primes')}>
          <i className="fa-solid fa-arrow-left"></i> Retour aux règles
        </button>
        <div className="regle-detail__error">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <p>{erreur || 'Règle introuvable.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="regle-detail">
      <button className="regle-detail__retour" onClick={() => navigate('/regles-primes')}>
        <i className="fa-solid fa-arrow-left"></i> Retour aux règles
      </button>

      {/* ── Header ── */}
      <header className="regle-detail__header">
        <div className="regle-detail__header-left">
          <span className="regle-detail__projet">{regle.projet || '—'}</span>
          <h1 className="regle-detail__nom">{regle.nom}</h1>
          <span className="regle-detail__code">{regle.code}</span>
        </div>
        <span className={`regle-detail__badge regle-detail__badge--${regle.actif ? 'actif' : 'inactif'}`}>
          {regle.actif ? 'Actif' : 'Inactif'}
        </span>
      </header>

      {/* ── Onglets ── */}
      <nav className="regle-detail__tabs">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            className={`regle-detail__tab ${ongletActif === o.id ? 'regle-detail__tab--active' : ''}`}
            onClick={() => setOngletActif(o.id)}
          >
            <i className={o.icon}></i> {o.label}
          </button>
        ))}
      </nav>

      {/* ── Contenu de l'onglet actif ── */}
      <div className="regle-detail__tab-content">
        {ongletActif === 'infos'    && <InfosSection    regle={regle} />}
        {ongletActif === 'criteres' && <CriteresSection regle={regle} />}
        {ongletActif === 'agents'   && <AgentsSection   regle={regle} />}
      </div>
    </div>
  );
}
