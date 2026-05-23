/*
 * Fichier : HistoriqueAssiduiteModal.jsx
 * Rôle    : Modal affichant la timeline des modifications d'assiduité pour
 *           un agent / mois donné, avec gestion des justificatifs (upload /
 *           téléchargement / suppression).
 * Dépend  : HistoriqueAssiduiteModal.css
 * Module  : mypaie / Pages / Assiduite / components
 */
import React, { useState, useEffect, useRef } from 'react';
import './HistoriqueAssiduiteModal.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoisLabel(mois) {
  if (!mois) return '';
  const [year, month] = mois.split('-').map(Number);
  return new Date(year, month - 1, 1)
    .toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return '—'; }
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getMimeIcon(mime) {
  if (!mime) return 'fa-file';
  if (mime.includes('pdf'))   return 'fa-file-pdf';
  if (mime.includes('image')) return 'fa-file-image';
  if (mime.includes('word') || mime.includes('document')) return 'fa-file-word';
  if (mime.includes('excel') || mime.includes('spreadsheet')) return 'fa-file-excel';
  return 'fa-file';
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function HistoriqueAssiduiteModal({ isOpen, onClose, agent, selectedMois }) {
  const [entries,      setEntries]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [uploadingFor, setUploadingFor] = useState(null); // historique_id en cours d'upload
  const [uploadError,  setUploadError]  = useState('');
  const fileInputRef = useRef(null);
  const overlayRef   = useRef(null);

  // Chargement de l'historique à l'ouverture
  useEffect(() => {
    if (!isOpen || !agent) return;
    setLoading(true);
    setError('');
    setEntries([]);
    fetch(`/api/assiduite/${encodeURIComponent(agent.matricule)}/historique?mois=${selectedMois}`)
      .then(r => r.json())
      .then(d => setEntries(d.data || []))
      .catch(() => setError('Impossible de charger l\'historique.'))
      .finally(() => setLoading(false));
  }, [isOpen, agent, selectedMois]);

  const handleOverlayClick = e => {
    if (e.target === overlayRef.current) onClose();
  };

  // Déclenche le sélecteur de fichier pour une entrée donnée
  const handleUploadClick = (historiqueId) => {
    setUploadError('');
    setUploadingFor(historiqueId);
    fileInputRef.current?.click();
  };

  // Envoi du fichier sélectionné
  const handleFileChange = async e => {
    const file = e.target.files?.[0];
    if (!file || uploadingFor === null) return;

    const token    = localStorage.getItem('mypaie_auth_token') || '';
    const formData = new FormData();
    formData.append('fichier',    file);
    formData.append('matricule',  agent.matricule);
    formData.append('mois',       selectedMois);

    try {
      const res = await fetch(`/api/assiduite/historique/${uploadingFor}/justificatif`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur lors de l\'upload.');
      }
      const data = await res.json();
      // Mise à jour locale sans rechargement complet
      setEntries(prev => prev.map(entry =>
        entry.id === uploadingFor
          ? { ...entry, justificatifs: [...entry.justificatifs, data.data] }
          : entry
      ));
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploadingFor(null);
      e.target.value = '';
    }
  };

  // Suppression d'un justificatif
  const handleDeleteJustif = async (historiqueId, justifId) => {
    if (!window.confirm('Supprimer ce justificatif définitivement ?')) return;
    try {
      const token = localStorage.getItem('mypaie_auth_token') || '';
      const res = await fetch(`/api/assiduite/justificatif/${justifId}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Erreur lors de la suppression.');
      setEntries(prev => prev.map(entry =>
        entry.id === historiqueId
          ? { ...entry, justificatifs: entry.justificatifs.filter(j => j.id !== justifId) }
          : entry
      ));
    } catch (err) {
      setUploadError(err.message);
    }
  };

  if (!isOpen || !agent) return null;

  return (
    <div
      className="ham-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ham-title"
    >
      <div className="ham-modal">

        {/* En-tête */}
        <div className="ham-header">
          <div className="ham-header__info">
            <span className="ham-header__icon"><i className="fa-solid fa-clock-rotate-left" /></span>
            <div>
              <h2 className="ham-title" id="ham-title">Historique Assiduité</h2>
              <p className="ham-subtitle">
                <strong>{agent.nom} {agent.prenom}</strong>
                <span className="ham-mat">#{agent.matricule}</span>
                <span className="ham-sep">·</span>
                {formatMoisLabel(selectedMois)}
              </p>
            </div>
          </div>
          <button className="ham-close" onClick={onClose} title="Fermer">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Corps */}
        <div className="ham-body">

          {/* Erreur de chargement */}
          {error && (
            <div className="ham-alert ham-alert--error">
              <i className="fa-solid fa-triangle-exclamation" /> {error}
            </div>
          )}

          {/* Erreur upload/suppression */}
          {uploadError && (
            <div className="ham-alert ham-alert--error" onClick={() => setUploadError('')}>
              <i className="fa-solid fa-triangle-exclamation" /> {uploadError}
              <button className="ham-alert__close"><i className="fa-solid fa-xmark" /></button>
            </div>
          )}

          {/* Chargement */}
          {loading && (
            <div className="ham-loading">
              <i className="fa-solid fa-spinner fa-spin" /> Chargement de l'historique…
            </div>
          )}

          {/* État vide */}
          {!loading && !error && entries.length === 0 && (
            <div className="ham-empty">
              <i className="fa-regular fa-clock" />
              <p>Aucune modification enregistrée pour {formatMoisLabel(selectedMois)}.</p>
              <span className="ham-empty__hint">
                Les prochaines sauvegardes apparaîtront ici.
              </span>
            </div>
          )}

          {/* Timeline */}
          {entries.length > 0 && (
            <div className="ham-timeline">
              {entries.map((entry, idx) => {
                const nt   = (entry.abs_injustifie || 0) + (entry.abs_justifie || 0) + (entry.cp_css || 0);
                const trav = Math.max(0, (entry.jours_ouvres || 22) - nt);
                const isLatest = idx === 0;

                return (
                  <div key={entry.id} className={`ham-entry${isLatest ? ' ham-entry--latest' : ''}`}>
                    <div className="ham-entry__line" />
                    <div className="ham-entry__dot">
                      <i className={`fa-solid ${isLatest ? 'fa-circle-check' : 'fa-circle'}`} />
                    </div>

                    <div className="ham-entry__card">
                      {/* Méta */}
                      <div className="ham-entry__meta">
                        <span className="ham-entry__date">
                          <i className="fa-regular fa-clock" /> {formatDateTime(entry.created_at)}
                        </span>
                        <span className="ham-entry__by">
                          <i className="fa-solid fa-user-pen" /> {entry.modifie_par}
                        </span>
                        {isLatest && (
                          <span className="ham-badge ham-badge--latest">Version actuelle</span>
                        )}
                      </div>

                      {/* Commentaire */}
                      {entry.commentaire && (
                        <p className="ham-entry__comment">
                          <i className="fa-solid fa-comment-dots" /> {entry.commentaire}
                        </p>
                      )}

                      {/* Valeurs */}
                      <div className="ham-entry__values">
                        <span className={`ham-chip${(entry.abs_injustifie || 0) > 0 ? ' ham-chip--danger' : ''}`}>
                          <b>ABS.I</b> {entry.abs_injustifie}
                        </span>
                        <span className={`ham-chip${(entry.retard || 0) > 0 ? ' ham-chip--warn' : ''}`}>
                          <b>RET.</b> {entry.retard}
                        </span>
                        <span className={`ham-chip${(entry.abs_justifie || 0) > 0 ? ' ham-chip--info' : ''}`}>
                          <b>ABS.J</b> {entry.abs_justifie}
                        </span>
                        <span className={`ham-chip${(entry.cp_css || 0) > 0 ? ' ham-chip--info' : ''}`}>
                          <b>CP/CSS</b> {entry.cp_css}
                        </span>
                        <span className="ham-chip ham-chip--derived">
                          <b>N.T</b> {nt}
                        </span>
                        <span className="ham-chip ham-chip--trav">
                          <b>J.TRAV</b> {trav}
                        </span>
                        <span className="ham-chip">
                          <b>OUV.</b> {entry.jours_ouvres}
                        </span>
                      </div>

                      {/* Justificatifs */}
                      {entry.justificatifs.length > 0 && (
                        <div className="ham-justifs">
                          <p className="ham-justifs__title">
                            <i className="fa-solid fa-paperclip" />
                            {' '}{entry.justificatifs.length} justificatif{entry.justificatifs.length > 1 ? 's' : ''}
                          </p>
                          {entry.justificatifs.map(j => (
                            <div key={j.id} className="ham-justif">
                              <i className={`fa-solid ${getMimeIcon(j.type_mime)} ham-justif__icon`} />
                              <span className="ham-justif__name" title={j.nom_original}>
                                {j.nom_original}
                              </span>
                              <span className="ham-justif__size">{formatSize(j.taille_octets)}</span>
                              <a
                                href={`/api/assiduite/justificatif/${j.id}/download`}
                                className="ham-justif__btn ham-justif__btn--dl"
                                download={j.nom_original}
                                title="Télécharger"
                              >
                                <i className="fa-solid fa-download" />
                              </a>
                              <button
                                className="ham-justif__btn ham-justif__btn--del"
                                onClick={() => handleDeleteJustif(entry.id, j.id)}
                                title="Supprimer"
                              >
                                <i className="fa-solid fa-trash" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Bouton upload */}
                      <button
                        className="ham-upload-btn"
                        onClick={() => handleUploadClick(entry.id)}
                        disabled={uploadingFor !== null}
                      >
                        {uploadingFor === entry.id
                          ? <><i className="fa-solid fa-circle-notch fa-spin" /> Upload…</>
                          : <><i className="fa-solid fa-paperclip" /> Ajouter un justificatif</>}
                      </button>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Input fichier caché */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

        </div>
      </div>
    </div>
  );
}
