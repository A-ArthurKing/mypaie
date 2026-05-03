/*
 * Fichier : RegleDetail.jsx
 * Rôle    : Page de détail d'une règle de prime — décomposée en onglets.
 * Module  : mypaie / Pages / ReglesPrimes / SubPages
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import './RegleDetail.css';
import ObjectifsOnglet from './Onglets/ObjectifsOnglet/ObjectifsOnglet'
import VariablesOnglet from './Onglets/VariablesOnglet/VariablesOnglet'
import AgentsOnglet from './Onglets/AgentsOnglet/AgentsOnglet'

const ONGLETS = [
  { id: 'objectifs', label: 'Objectifs',     icon: 'fa-solid fa-bullseye' },
  { id: 'variables', label: 'Variables',     icon: 'fa-solid fa-sliders' },
  { id: 'agents',    label: 'Agents',        icon: 'fa-solid fa-users' },
];

export default function RegleDetail() {
  const { regleId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [regle, setRegle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);

  // L'onglet actif est lu depuis l'URL (?tab=...) ou 'objectifs' par défaut
  const ongletActif = searchParams.get('tab') || 'objectifs';

  const setOngletActif = (id) => {
    setSearchParams({ tab: id });
  };

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
        {ongletActif === 'objectifs' && <ObjectifsOnglet regle={regle} />}
        {ongletActif === 'variables' && <VariablesOnglet regle={regle} />}
        {ongletActif === 'agents'    && <AgentsOnglet   regle={regle} />}
      </div>
    </div>
  );
}
