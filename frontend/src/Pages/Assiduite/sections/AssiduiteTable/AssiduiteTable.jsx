/*
 * Fichier : AssiduiteTable.jsx
 * Rôle    : Tableau des agents avec leurs colonnes d'assiduité.
 *           Calcule N.T (jours non travaillés) et TRAV. en dérivé.
 *           Chaque ligne a un bouton Modifier qui ouvre le modal d'édition.
 * Dépend  : AssiduiteTable.css
 * Module  : mypaie / Pages / Assiduite / sections
 */
import React from 'react';
import './AssiduiteTable.css';

// Formate une date ISO en "JJ/MM/YYYY HH:MM" ou "—"
function formatDate(dt) {
  if (!dt) return '—';
  try {
    const d = new Date(dt);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return '—'; }
}

// Badge indiquant l'origine de la donnée
function SourceBadge({ agent }) {
  if (!agent.derniere_maj) return null;
  if (agent.is_overridden) {
    return <span className="assit-source-badge assit-source-badge--override" title="Données saisies manuellement — protégées de la synchro auto">MODIFIÉ</span>;
  }
  if (agent.synced_at) {
    return <span className="assit-source-badge assit-source-badge--auto" title="Données synchronisées automatiquement depuis gestionpaie">AUTO</span>;
  }
  return null;
}

export default function AssiduiteTable({ agents, onEdit, onHistory, onCalendar }) {

  const filtered = agents;

  if (!filtered.length) {
    return (
      <div className="assit-empty">
        <i className="fa-solid fa-magnifying-glass" />
        <p>Aucun collaborateur trouvé</p>
      </div>
    );
  }

  return (
    <div className="assit-wrapper">
      <table className="assit-table">
        <thead>
          <tr>
            <th className="assit-th assit-th--mat">Matricule</th>
            <th className="assit-th">Nom</th>
            <th className="assit-th assit-th--projet">Projet</th>
            {/* Colonnes absences */}
            <th className="assit-th assit-th--num" title="Absences Injustifiées">ABS.I</th>
            <th className="assit-th assit-th--num" title="Retards">RETARD</th>
            <th className="assit-th assit-th--num" title="Absences Justifiées">ABS.J</th>
            <th className="assit-th assit-th--num" title="Congés Payés + Nécessités">CP/CSS</th>
            {/* Colonnes dérivées */}
            <th className="assit-th assit-th--num assit-th--derived" title="Jours non travaillés (ABS.I + ABS.J + CP/CSS)">N.T</th>
            <th className="assit-th assit-th--num assit-th--derived" title="Jours travaillés (OUV - N.T)">J.TRAV</th>
            <th className="assit-th assit-th--num" title="Jours ouvrés du mois">OUV.</th>
            <th className="assit-th assit-th--date">Dernière MAJ</th>
            <th className="assit-th assit-th--actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(agent => {
            // Jours non travaillés = ABS.I + ABS.J + CP/CSS (retards exclus)
            const nt   = (agent.abs_injustifie || 0) + (agent.abs_justifie || 0) + (agent.cp_css || 0);
            // J.TRAV : utilise la valeur calculée depuis gestionpaie si disponible
            const trav = agent.jours_travailles > 0
              ? agent.jours_travailles
              : Math.max(0, (agent.jours_ouvres || 22) - nt);
            const hasData = !!agent.derniere_maj;

            return (
              <tr key={agent.matricule} className="assit-row">
                <td className="assit-td assit-td--mat">{agent.matricule}</td>
                <td className="assit-td assit-td--nom">
                  {agent.nom} <span className="assit-prenom">{agent.prenom}</span>
                </td>
                <td className="assit-td">
                  {agent.projet
                    ? <span className="assit-badge">{agent.projet}</span>
                    : <span className="assit-nil">—</span>}
                </td>

                {/* ABS.I */}
                <td className="assit-td assit-td--num">
                  <span
                    className={`${agent.abs_injustifie > 0 ? 'assit-chip assit-chip--danger' : 'assit-chip assit-chip--zero'}${onCalendar ? ' assit-chip--clickable' : ''}`}
                    onClick={onCalendar ? () => onCalendar(agent, 'abs_injust') : undefined}
                    title={onCalendar ? 'Voir le détail sur le calendrier' : undefined}
                  >
                    {agent.abs_injustifie ?? 0}
                  </span>
                </td>
                {/* RETARD */}
                <td className="assit-td assit-td--num">
                  <span
                    className={`${agent.retard > 0 ? 'assit-chip assit-chip--warn' : 'assit-chip assit-chip--zero'}${onCalendar ? ' assit-chip--clickable' : ''}`}
                    onClick={onCalendar ? () => onCalendar(agent, 'retard') : undefined}
                    title={onCalendar ? 'Voir le détail sur le calendrier' : undefined}
                  >
                    {agent.retard ?? 0}
                  </span>
                </td>
                {/* ABS.J */}
                <td className="assit-td assit-td--num">
                  <span
                    className={`${agent.abs_justifie > 0 ? 'assit-chip assit-chip--info' : 'assit-chip assit-chip--zero'}${onCalendar ? ' assit-chip--clickable' : ''}`}
                    onClick={onCalendar ? () => onCalendar(agent, 'abs_just') : undefined}
                    title={onCalendar ? 'Voir le détail sur le calendrier' : undefined}
                  >
                    {agent.abs_justifie ?? 0}
                  </span>
                </td>
                {/* CP/CSS */}
                <td className="assit-td assit-td--num">
                  <span className={agent.cp_css > 0 ? 'assit-chip assit-chip--info' : 'assit-chip assit-chip--zero'}>
                    {agent.cp_css ?? 0}
                  </span>
                </td>

                {/* N.T — dérivé */}
                <td className="assit-td assit-td--num assit-td--derived">
                  <span className={nt > 0 ? 'assit-chip assit-chip--warn' : 'assit-chip assit-chip--zero'}>
                    {nt}
                  </span>
                </td>
                {/* TRAV. — dérivé */}
                <td className="assit-td assit-td--num assit-td--derived">
                  <span
                    className={`assit-chip assit-chip--trav${onCalendar ? ' assit-chip--clickable' : ''}`}
                    onClick={onCalendar ? () => onCalendar(agent, 'travaille') : undefined}
                    title={onCalendar ? 'Voir le détail sur le calendrier' : undefined}
                  >
                    {trav}
                  </span>
                </td>
                {/* OUV. */}
                <td className="assit-td assit-td--num">
                  <span className="assit-chip assit-chip--ouv">{agent.jours_ouvres ?? 22}</span>
                </td>

                {/* Dernière MAJ + badge source */}
                <td className="assit-td assit-td--date">
                  {hasData ? (
                    <div className="assit-date-cell">
                      <span className="assit-date">{formatDate(agent.derniere_maj)}</span>
                      <SourceBadge agent={agent} />
                    </div>
                  ) : (
                    <span className="assit-new-badge">Non renseigné</span>
                  )}
                </td>

                {/* Actions */}
                <td className="assit-td assit-td--actions">
                  <button
                    className="assit-action-btn"
                    onClick={() => onEdit(agent)}
                    title="Modifier l'assiduité"
                  >
                    <i className="fa-solid fa-pen" />
                  </button>
                  <button
                    className="assit-action-btn assit-action-btn--history"
                    onClick={() => onHistory(agent)}
                    title="Voir l'historique des modifications"
                  >
                    <i className="fa-solid fa-clock-rotate-left" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
