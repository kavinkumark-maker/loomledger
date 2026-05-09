import React, { useState } from 'react'
import useLoomStore from '../store/useLoomStore'

function formatSavedAt(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SaveLoadSection() {
  const currentId        = useLoomStore(s => s.currentId)
  const header           = useLoomStore(s => s.header)
  const savedCostings    = useLoomStore(s => s.savedCostings)
  const saveCosting      = useLoomStore(s => s.saveCosting)
  const loadCosting      = useLoomStore(s => s.loadCosting)
  const duplicateCosting = useLoomStore(s => s.duplicateCosting)
  const deleteCosting    = useLoomStore(s => s.deleteCosting)
  const newCosting       = useLoomStore(s => s.newCosting)
  const exportToJSON     = useLoomStore(s => s.exportToJSON)

  const [listOpen,       setListOpen]       = useState(false)
  const [deleteConfirm,  setDeleteConfirm]  = useState(null)
  const [saveFlash,      setSaveFlash]      = useState(false)

  const handleSave = () => {
    saveCosting()
    setSaveFlash(true)
    setTimeout(() => setSaveFlash(false), 1600)
  }

  const handleDelete = id => {
    if (deleteConfirm === id) {
      deleteCosting(id)
      setDeleteConfirm(null)
    } else {
      setDeleteConfirm(id)
      // Auto-cancel confirm state after 3s
      setTimeout(() => setDeleteConfirm(prev => prev === id ? null : prev), 3000)
    }
  }

  const handleNew = () => {
    newCosting()
    setListOpen(false)
  }

  const isUnsaved = !currentId
  const count     = savedCostings.length

  return (
    <div className="sl-section">
      {/* ── Top bar ── */}
      <div className="sl-bar">
        <div className="sl-actions">
          <button className="btn btn-ghost" onClick={handleNew} title="Start a new blank costing">
            + New
          </button>

          <button
            className={`btn btn-primary${saveFlash ? ' btn-flash' : ''}`}
            onClick={handleSave}
            title={isUnsaved ? 'Save this costing' : 'Update saved costing'}
          >
            {saveFlash ? '✓ Saved' : isUnsaved ? 'Save' : 'Update'}
          </button>

          <button
            className="btn btn-ghost"
            onClick={exportToJSON}
            disabled={count === 0}
            title="Download all costings as JSON backup"
          >
            Export JSON
          </button>

          {currentId && (
            <span className="sl-current-badge">
              ● {header.costingName || 'Untitled Costing'}
            </span>
          )}
        </div>

        <button
          className={`btn btn-ghost sl-toggle${listOpen ? ' sl-toggle--open' : ''}`}
          onClick={() => setListOpen(v => !v)}
        >
          {count === 0
            ? 'No saved costings'
            : `${count} saved costing${count !== 1 ? 's' : ''}`}
          <span className="sl-chevron">{listOpen ? '▲' : '▼'}</span>
        </button>
      </div>

      {/* ── Saved costings list ── */}
      {listOpen && (
        <div className="sl-list">
          {count === 0 ? (
            <p className="sl-empty">
              Nothing saved yet. Hit <strong>Save</strong> to store your first costing.
            </p>
          ) : (
            savedCostings.map(c => (
              <div
                key={c.id}
                className={`sl-card${currentId === c.id ? ' sl-card--active' : ''}`}
              >
                <div className="sl-card-info">
                  <span className="sl-card-name">{c.name}</span>
                  <span className="sl-card-meta">
                    {c.header.productType}
                    {c.header.weaveType ? ` · ${c.header.weaveType}` : ''}
                    {c.header.tradeTerm ? ` · ${c.header.tradeTerm}` : ''}
                    {' · '}
                    {formatSavedAt(c.savedAt)}
                  </span>
                </div>

                <div className="sl-card-actions">
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => { loadCosting(c.id); setListOpen(false) }}
                  >
                    Load
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => duplicateCosting(c.id)}
                    title="Duplicate this costing"
                  >
                    Copy
                  </button>
                  <button
                    className={`btn btn-sm btn-danger${deleteConfirm === c.id ? ' btn-danger--hot' : ''}`}
                    onClick={() => handleDelete(c.id)}
                    title={deleteConfirm === c.id ? 'Click again to confirm delete' : 'Delete this costing'}
                  >
                    {deleteConfirm === c.id ? 'Confirm?' : 'Delete'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
