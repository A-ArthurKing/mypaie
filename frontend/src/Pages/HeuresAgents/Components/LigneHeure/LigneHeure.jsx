/*
 * Fichier : LigneHeure.jsx
 * Rôle    : Composant autonome représentant une ligne du tableau des heures agents.
 *           Formate les valeurs d'heures (ms → h:mm) et affiche les badges de clôture.
 * Module  : mypaie / Pages / HeuresAgents / Components
 */

// #region IMPORTS
import { memo } from 'react'
// #endregion

// #region HELPERS
// Conversion des millisecondes BigQuery en format affichable "Xh YYm"
function msEnHeures(ms) {
  if (ms === null || ms === undefined || ms === '') return '—'
  const totalMin = Math.round(Number(ms) / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

// Détermine la classe CSS du badge selon la valeur de clôture
function badgeClass(val) {
  if (!val) return 'ha-badge ha-badge--non'
  const v = String(val).toLowerCase()
  if (v === 'oui' || v === '1' || v === 'true') return 'ha-badge ha-badge--oui'
  return 'ha-badge ha-badge--non'
}

// Détermine le libellé du badge de clôture
function badgeLabel(val) {
  if (!val) return 'Non'
  const v = String(val).toLowerCase()
  if (v === 'oui' || v === '1' || v === 'true') return 'Oui'
  return 'Non'
}
// #endregion

// #region COMPOSANT
// Mémoïsé pour éviter les re-rendus inutiles lors des tris et paginations
const LigneHeure = memo(function LigneHeure({ ligne }) {
  return (
    <tr>
      <td>{ligne.matricule ?? '—'}</td>
      <td>{ligne.LastName ?? '—'}</td>
      <td>{ligne.FirstName ?? '—'}</td>
      <td className="ha-td--muted">{ligne.Equipe ?? '—'}</td>
      <td>{ligne.date ?? '—'}</td>
      <td className="ha-td--muted">{ligne.projet ?? '—'}</td>
      <td className="ha-td--number">{msEnHeures(ligne.heure_ht)}</td>
      <td className="ha-td--number">{msEnHeures(ligne.heure_hp)}</td>
      <td className="ha-td--number">{msEnHeures(ligne.heure_hc)}</td>
      <td className="ha-td--number">{msEnHeures(ligne.heure_hf)}</td>
      <td className="ha-td--number">{msEnHeures(ligne.heure_total)}</td>
      <td className="ha-td--number">{msEnHeures(ligne.heure_ecart)}</td>
      <td className="ha-td--muted">{ligne.TYPE_CONGE ?? '—'}</td>
      <td>
        <span className={badgeClass(ligne.cloture_sup)}>
          {badgeLabel(ligne.cloture_sup)}
        </span>
      </td>
      <td>
        <span className={badgeClass(ligne.cloture_rh)}>
          {badgeLabel(ligne.cloture_rh)}
        </span>
      </td>
    </tr>
  )
})
// #endregion

export default LigneHeure
