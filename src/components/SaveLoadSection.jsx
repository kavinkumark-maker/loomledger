import React, { useState, useEffect, useRef } from 'react'
import useLoomStore from '../store/useLoomStore'
import { saveImage, getImages, deleteImage, compressImage } from '../utils/imageDb'
import { importFromJSON, importFromExcel } from '../utils/importUtils'

const MAX_IMAGES = 5
const genImgId   = () => `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

function formatSavedAt(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Image Gallery ─────────────────────────────────────────────────────────────
function ImageGallery({ costingId }) {
  const [images,    setImages]    = useState([])
  const [uploading, setUploading] = useState(false)
  const [lightbox,  setLightbox]  = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    if (!costingId) { setImages([]); return }
    getImages(costingId).then(setImages).catch(() => setImages([]))
  }, [costingId])

  const handleFiles = async files => {
    if (!costingId) { alert('Save the costing first before adding images.'); return }
    const remaining = MAX_IMAGES - images.length
    const toProcess = Array.from(files).slice(0, remaining)
    if (!toProcess.length) return
    setUploading(true)
    try {
      for (const file of toProcess) {
        if (!file.type.startsWith('image/')) continue
        const dataUrl = await compressImage(file)
        const imgId   = genImgId()
        await saveImage(costingId, imgId, dataUrl, { name: file.name, addedAt: new Date().toISOString() })
      }
      const updated = await getImages(costingId)
      setImages(updated)
    } catch (e) {
      console.error('Image upload failed', e)
    }
    setUploading(false)
  }

  const handleDelete = async (imgId) => {
    await deleteImage(costingId, imgId)
    setImages(prev => prev.filter(i => i.imageId !== imgId))
    if (lightbox === imgId) setLightbox(null)
  }

  return (
    <div className="img-gallery">
      <div className="img-gallery-header">
        <span className="rm-cell-label">Sample Images ({images.length}/{MAX_IMAGES})</span>
        {images.length < MAX_IMAGES && (
          <>
            <button className="btn btn-sm btn-ghost"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !costingId}
              title={!costingId ? 'Save costing first' : 'Upload image'}>
              {uploading ? 'Uploading…' : '+ Add Image'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple
              style={{ display: 'none' }}
              onChange={e => handleFiles(e.target.files)} />
          </>
        )}
      </div>

      {images.length > 0 && (
        <div className="img-thumbs">
          {images.map(img => (
            <div key={img.imageId} className="img-thumb-wrap">
              <img src={img.dataUrl} alt={img.name || 'Sample'}
                className="img-thumb"
                onClick={() => setLightbox(img.imageId)} />
              <button className="img-thumb-del"
                onClick={() => handleDelete(img.imageId)} title="Remove">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (() => {
        const img = images.find(i => i.imageId === lightbox)
        return img ? (
          <div className="img-lightbox" onClick={() => setLightbox(null)}>
            <div className="img-lightbox-inner" onClick={e => e.stopPropagation()}>
              <img src={img.dataUrl} alt={img.name} className="img-lightbox-img" />
              <div className="img-lightbox-footer">
                <span>{img.name}</span>
                <button className="btn btn-sm btn-danger"
                  onClick={() => handleDelete(img.imageId)}>Delete</button>
                <button className="btn btn-sm btn-ghost"
                  onClick={() => setLightbox(null)}>Close</button>
              </div>
            </div>
          </div>
        ) : null
      })()}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
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

  const [listOpen,      setListOpen]      = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [saveFlash,     setSaveFlash]     = useState(false)
  const [search,        setSearch]        = useState('')
  const [importError,   setImportError]   = useState(null)
  const [importWarnings,setImportWarnings]= useState([])
  const [importFlash,   setImportFlash]   = useState(false)
  const jsonImportRef  = useRef()
  const xlsxImportRef = useRef()

  // ── Derived state ─────────────────────────────────────────────────────────
  const filtered = savedCostings.filter(c => {
    const q = search.toLowerCase()
    return (
      c.name?.toLowerCase().includes(q) ||
      c.header?.articleNo?.toLowerCase().includes(q) ||
      c.header?.productType?.toLowerCase().includes(q)
    )
  })

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
      setTimeout(() => setDeleteConfirm(prev => prev === id ? null : prev), 3000)
    }
  }

  // ── Import handlers ───────────────────────────────────────────────────────
  const handleImportJSON = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportError(null)
    try {
      const result = await importFromJSON(file)
      if (result.type === 'backup') {
        useLoomStore.setState(s => {
          const merged = [...result.costings, ...s.savedCostings.filter(
            c => !result.costings.find(r => r.id === c.id)
          )]
          return { savedCostings: merged }
        })
        setImportFlash(true)
        setTimeout(() => setImportFlash(false), 2000)
      } else {
        const costing = { ...result.costing, id: result.costing.id || `imp_${Date.now()}`, savedAt: new Date().toISOString() }
        useLoomStore.setState(s => ({
          savedCostings: [costing, ...s.savedCostings.filter(c => c.id !== costing.id)],
          currentId: costing.id,
          header: costing.header,
          sections: costing.sections,
          pricingLayer: costing.pricingLayer,
        }))
        setImportFlash(true)
        setTimeout(() => setImportFlash(false), 2000)
      }
    } catch (err) {
      setImportError(err.message)
    }
  }

  const handleImportExcel = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportError(null)
    setImportWarnings([])
    try {
      const result  = await importFromExcel(file)
      const costing = { ...result.costing, id: `imp_${Date.now()}`, savedAt: new Date().toISOString() }
      useLoomStore.setState(s => ({
        savedCostings: [costing, ...s.savedCostings],
        currentId: costing.id,
        header: costing.header,
        sections: costing.sections,
        pricingLayer: costing.pricingLayer,
      }))
      if (result.warnings?.length) setImportWarnings(result.warnings)
      setImportFlash(true)
      setTimeout(() => setImportFlash(false), 2000)
    } catch (err) {
      setImportError(err.message)
    }
  }

  return (
    <div className="sl-section">
      {/* ── Top bar ── */}
      <div className="sl-bar">
        <div className="sl-actions">
          <button className="btn btn-ghost" onClick={() => { newCosting(); setListOpen(false) }}>
            + New
          </button>
          <button className={`btn btn-primary${saveFlash ? ' btn-flash' : ''}`} onClick={handleSave}>
            {saveFlash ? '✓ Saved' : currentId ? 'Update' : 'Save'}
          </button>
          <button className="btn btn-ghost" onClick={exportToJSON}
            disabled={savedCostings.length === 0} title="Export all costings as JSON">
            Export JSON
          </button>

          {/* Import */}
          <div className="sl-import-group">
            <button className={`btn btn-ghost${importFlash ? ' btn-flash' : ''}`}
              onClick={() => jsonImportRef.current?.click()}
              title="Import from JSON backup">
              {importFlash ? '✓ Imported' : '↑ JSON'}
            </button>
            <button className="btn btn-ghost"
              onClick={() => xlsxImportRef.current?.click()}
              title="Import from Excel (.xlsx)">
              ↑ Excel
            </button>
            <input ref={jsonImportRef}  type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportJSON} />
            <input ref={xlsxImportRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleImportExcel} />
          </div>

          {currentId && (
            <span className="sl-current-badge">● {header.costingName || 'Untitled Costing'}</span>
          )}
        </div>

        <button
          className={`btn btn-ghost sl-toggle${listOpen ? ' sl-toggle--open' : ''}`}
          onClick={() => setListOpen(v => !v)}>
          {savedCostings.length === 0 ? 'No saved costings' : `${savedCostings.length} costing${savedCostings.length !== 1 ? 's' : ''}`}
          <span className="sl-chevron">{listOpen ? '▲' : '▼'}</span>
        </button>
      </div>

      {/* Import error / warnings */}
      {importError && (
        <div className="sl-import-error">⚠ {importError}
          <button onClick={() => setImportError(null)}>✕</button>
        </div>
      )}
      {importWarnings.length > 0 && (
        <div className="sl-import-warn">
          {importWarnings.map((w, i) => <p key={i}>ℹ {w}</p>)}
          <button onClick={() => setImportWarnings([])}>✕</button>
        </div>
      )}

      {/* Image gallery for current costing */}
      {currentId && (
        <div className="sl-images">
          <ImageGallery costingId={currentId} />
        </div>
      )}

      {/* ── Saved costings list ── */}
      {listOpen && (
        <div className="sl-list">
          {/* Search bar */}
          <div className="sl-search-wrap">
            <input type="text" className="input sl-search"
              placeholder="Search by name, article no., product type…"
              value={search}
              onChange={e => setSearch(e.target.value)} />
            {search && (
              <button className="sl-search-clear" onClick={() => setSearch('')}>✕</button>
            )}
          </div>

          {filtered.length === 0 ? (
            <p className="sl-empty">
              {search ? `No costings matching "${search}"` : 'Nothing saved yet. Hit Save to store your first costing.'}
            </p>
          ) : (
            filtered.map(c => (
              <div key={c.id}
                className={`sl-card${currentId === c.id ? ' sl-card--active' : ''}`}>
                <div className="sl-card-info">
                  <span className="sl-card-name">{c.name}</span>
                  <span className="sl-card-meta">
                    {c.header?.productType}
                    {c.header?.articleNo   ? ` · ${c.header.articleNo}`   : ''}
                    {c.header?.weaveType   ? ` · ${c.header.weaveType}`   : ''}
                    {c.header?.tradeTerm   ? ` · ${c.header.tradeTerm}`   : ''}
                    {' · '}{formatSavedAt(c.savedAt)}
                  </span>
                </div>
                <div className="sl-card-actions">
                  <button className="btn btn-sm btn-ghost"
                    onClick={() => { loadCosting(c.id); setListOpen(false) }}>Load</button>
                  <button className="btn btn-sm btn-ghost"
                    onClick={() => duplicateCosting(c.id)}>Copy</button>
                  <button
                    className={`btn btn-sm btn-danger${deleteConfirm === c.id ? ' btn-danger--hot' : ''}`}
                    onClick={() => handleDelete(c.id)}>
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
