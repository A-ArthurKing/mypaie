/*
 * Fichier : AgentsTable.jsx
 * Rôle    : Tableau des agents avec normalisation pour la recherche accent-insensible,
 *           actions d'édition et de suppression par ligne.
 * Dépend  : AgentsTable.css
 * Module  : mypaie / Pages / GestionAgents / sections
 */
import React from 'react';
import './AgentsTable.css';

function normalizeStr(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export default function AgentsTable({ agents, onEdit, onDelete }) {
  if (!agents.length) {
    return (
      <div className="agta-empty">
        <i className="fa-solid fa-magnifying-glass"></i>
        <p>Aucun collaborateur trouvé</p>
      </div>
    );
  }

  return (
    <div className="agta-wrapper">
      <table className="agta-table">
        <thead>
          <tr>
            <th className="agta-th agta-th--matricule">Matricule</th>
            <th className="agta-th">Nom</th>
            <th className="agta-th">Prénom</th>
            <th className="agta-th agta-th--projet">Projet</th>
            <th className="agta-th">Opération</th>
            <th className="agta-th">File</th>
            <th className="agta-th">Activité</th>
            <th className="agta-th">Prime Langue</th>
            <th className="agta-th">Salaire Net</th>
            <th className="agta-th">Taux Horaire</th>
            <th className="agta-th">Poste</th>
            <th className="agta-th">Niveau actuel</th>
            <th className="agta-th agta-th--actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {agents.map(agent => (
            <tr key={agent.matricule} className="agta-row">
              <td className="agta-td agta-td--matricule">{agent.matricule}</td>
              <td className="agta-td agta-td--nom">{agent.nom}</td>
              <td className="agta-td">{agent.prenom}</td>
              <td className="agta-td">
                {agent.projet
                  ? <span className="agta-badge agta-badge--projet">{agent.projet}</span>
                  : <span className="agta-nil">—</span>}
              </td>
              <td className="agta-td">
                {agent.operation
                  ? <span className="agta-badge agta-badge--operation">{agent.operation}</span>
                  : <span className="agta-nil">—</span>}
              </td>
              <td className="agta-td">
                {agent.sous_projet || <span className="agta-nil">—</span>}
              </td>
              <td className="agta-td">
                {agent.activite || <span className="agta-nil">—</span>}
              </td>
              <td className="agta-td">
                <span className="agta-badge agta-badge--prime">{agent.prime_langue || 0} DH</span>
              </td>
              <td className="agta-td">
                {agent.salaire_net ? `${agent.salaire_net} DH` : <span className="agta-nil">—</span>}
              </td>
              <td className="agta-td">
                {agent.taux_horaire ? `${agent.taux_horaire} DH` : <span className="agta-nil">—</span>}
              </td>
              <td className="agta-td">
                {agent.poste || <span className="agta-nil">—</span>}
              </td>
              <td className="agta-td">
                <span className={`agta-statut agta-statut--${normalizeStr(agent.statut).replace(/\s/g, '')}`}>
                  {agent.statut || 'Non défini'}
                </span>
              </td>
              <td className="agta-td agta-td--actions">
                <div className="agta-actions">
                  <button
                    className="agta-action-btn agta-action-btn--edit"
                    onClick={() => onEdit(agent)}
                    title="Modifier l'agent"
                  >
                    <i className="fa-solid fa-pen"></i>
                  </button>
                  <button
                    className="agta-action-btn agta-action-btn--delete"
                    onClick={() => onDelete(agent)}
                    title="Supprimer l'agent"
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
