/*
 * Fichier : PaginationControls.jsx
 * Rôle    : Composant de pagination — affiche les boutons page précédente/suivante
 *           et les numéros de pages dans une fenêtre de 5 pages autour de la courante.
 * Module  : mypaie / Pages / HeuresAgents / Components
 */

// #region IMPORTS
import { memo } from 'react'
// #endregion

// #region COMPOSANT
const PaginationControls = memo(function PaginationControls({
  total,
  limit,
  offset,
  onPageChange,
}) {
  const totalPages  = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  // Pas de pagination si une seule page
  if (totalPages <= 1) return null

  // #region HELPERS
  // Génération d'une plage de numéros de pages autour de la page courante
  function pageRange() {
    const delta = 2
    const range = []
    for (
      let i = Math.max(1, currentPage - delta);
      i <= Math.min(totalPages, currentPage + delta);
      i++
    ) {
      range.push(i)
    }
    return range
  }
  // #endregion

  // #region HANDLERS
  function goToPage(page) {
    if (page < 1 || page > totalPages) return
    onPageChange((page - 1) * limit)
  }
  // #endregion

  // #region RENDERING
  const pages = pageRange()

  return (
    <nav className="ha-pagination" aria-label="Pagination des heures agents">

      <button
        className="ha-pagination__btn"
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Page précédente"
      >
        ‹
      </button>

      {pages[0] > 1 && (
        <>
          <button className="ha-pagination__btn" onClick={() => goToPage(1)}>1</button>
          {pages[0] > 2 && <span className="ha-pagination__info">…</span>}
        </>
      )}

      {pages.map(p => (
        <button
          key={p}
          className={`ha-pagination__btn${p === currentPage ? ' ha-pagination__btn--active' : ''}`}
          onClick={() => goToPage(p)}
          aria-current={p === currentPage ? 'page' : undefined}
        >
          {p}
        </button>
      ))}

      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && (
            <span className="ha-pagination__info">…</span>
          )}
          <button className="ha-pagination__btn" onClick={() => goToPage(totalPages)}>
            {totalPages}
          </button>
        </>
      )}

      <button
        className="ha-pagination__btn"
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Page suivante"
      >
        ›
      </button>

      <span className="ha-pagination__info">
        Page {currentPage} / {totalPages}
      </span>

    </nav>
  )
  // #endregion
})
// #endregion

export default PaginationControls
