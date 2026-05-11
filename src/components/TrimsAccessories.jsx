import React from 'react'
import useLoomStore from '../store/useLoomStore'
import SectionFooter from '../ui/SectionFooter'

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = ['Structural', 'Decorative', 'Labels & Tags', 'Sewing Thread']
const UNITS      = ['per piece', 'per metre', 'per cm', 'per set', 'per dozen']

const CATEGORY_COLORS = {
  'Structural':    '#3A5A8A',
  'Decorative':    '#7A2D6B',
  'Labels & Tags': '#2D7A44',
  'Sewing Thread': '#8A6A2D',
}

const CATEGORY_EXAMPLES = {
  'Structural':    'Zip, Button, Velcro, Snap, Hook & eye',
  'Decorative':    'Lace trim, Ribbon, Pom pom, Tassel, Fringe',
  'Labels & Tags': 'Woven label, Care label, Hang tag, Barcode',
  'Sewing Thread': 'Use the thread calculator below for automatic consumption',
}

// ── Sewing thread consumption calculator ──────────────────────────────────────
// Rule of thumb: thread consumption ≈ 2.5× seam length for lockstitch
// For chainstitch/overlock: multiply by higher factor
const THREAD_STITCH_FACTORS = {
  'Lockstitch (301)':      2.5,
  'Chainstitch (401)':     4.5,
  'Overlock 3-thread (504)': 12,
  'Overlock 4-thread (514)': 14,
  'Overlock 5-thread (516)': 16,
  'Cover stitch (406)':    8,
}

// ── ID + empty row ────────────────────────────────────────────────────────────
const genId = () => `ta_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

const emptyRow = () => ({
  id:          genId(),
  description: '',
  category:    'Structural',
  qty:         '',
  unit:        'per piece',
  unitPrice:   '',
  wastage:     '0',
  // Thread calculator fields (only used when category === 'Sewing Thread')
  threadCalcEnabled: false,
  seamLengthCm:      '',
  stitchType:        'Lockstitch (301)',
  threadWastage:     '15',  // %
})

// ── Subtotal per row ──────────────────────────────────────────────────────────
export function calcTrimRowSubtotal(row) {
  const qty     = Number(row.qty)       || 0
  const price   = Number(row.unitPrice) || 0
  const wastage = Number(row.wastage)   || 0
  // For "per dozen" unit, qty is in dozens so multiply by 12 for piece count
  const effectiveQty = row.unit === 'per dozen' ? qty * 12 : qty
  return effectiveQty * price * (1 + wastage / 100)
}

// ── Section subtotal (exported for SummaryPanel) ──────────────────────────────
export function calcTrimsSubtotal(trimsAccessories) {
  return (trimsAccessories.rows || []).reduce(
    (acc, r) => acc + calcTrimRowSubtotal(r), 0
  )
}

// ── Formatter ─────────────────────────────────────────────────────────────────
const inr = n =>
  `₹${Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

// ── Cell ──────────────────────────────────────────────────────────────────────
function Cell({ label, children, width }) {
  return (
    <div className="rm-cell" style={width ? { flex: `0 0 ${width}px` } : {}}>
      {label && <span className="rm-cell-label">{label}</span>}
      {children}
    </div>
  )
}

// ── Single trim row ───────────────────────────────────────────────────────────
function TrimRow({ row, index, onUpdate, onRemove }) {
  const subtotal    = calcTrimRowSubtotal(row)
  const catColor    = CATEGORY_COLORS[row.category] || '#6B7A8A'
  const set         = (field, value) => onUpdate(row.id, field, value)

  return (
    <div className="rm-row">
      <div className="rm-row-index" style={{ '--role-color': catColor }}>
        <span className="rm-row-num">{index + 1}</span>
      </div>

      <div className="rm-row-body">
        {/* ── Line 1: Description + Category ── */}
        <div className="rm-row-line">
          <Cell label="Description">
            <input
              type="text"
              className="input input-sm"
              placeholder={CATEGORY_EXAMPLES[row.category] || 'Describe the trim or accessory'}
              value={row.description}
              onChange={e => set('description', e.target.value)}
            />
          </Cell>

          <Cell label="Category" width={140}>
            <select
              className="input input-sm"
              value={row.category}
              onChange={e => set('category', e.target.value)}
              style={{ color: catColor, fontWeight: 500 }}
            >
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Cell>
        </div>

        {/* ── Line 2: Qty + Unit + Price + Wastage + Subtotal ── */}
        <div className="rm-row-line rm-row-line--price">
          <Cell label="Qty / Piece" width={90}>
            <input
              type="number"
              className="input input-sm mono"
              placeholder="0"
              min="0"
              step="0.01"
              value={row.qty}
              onChange={e => set('qty', e.target.value)}
            />
          </Cell>

          <Cell label="Unit" width={120}>
            <select
              className="input input-sm"
              value={row.unit}
              onChange={e => set('unit', e.target.value)}
            >
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </Cell>

          <Cell label="Unit Price (₹)" width={120}>
            <input
              type="number"
              className="input input-sm mono"
              placeholder="0.00"
              min="0"
              step="0.01"
              value={row.unitPrice}
              onChange={e => set('unitPrice', e.target.value)}
            />
          </Cell>

          <Cell label="Wastage %" width={80}>
            <div className="qty-row">
              <input
                type="number"
                className="input input-sm mono"
                placeholder="0"
                min="0"
                max="100"
                value={row.wastage}
                onChange={e => set('wastage', e.target.value)}
              />
              <span className="unit-static">%</span>
            </div>
          </Cell>

          <Cell label="Subtotal" width={120}>
            <div className={`rm-subtotal${subtotal > 0 ? ' rm-subtotal--active' : ''}`}>
              {inr(subtotal)}
            </div>
          </Cell>

          <div className="rm-row-remove">
            <button
              className="btn btn-sm btn-danger"
              onClick={() => onRemove(row.id)}
              title="Remove"
            >✕</button>
          </div>
        </div>

        {/* ── Sewing Thread Calculator ── */}
        {row.category === 'Sewing Thread' && (
          <div className="thread-calc-block">
            <div className="thread-calc-header">
              <span className="rm-cell-label">Thread Consumption Calculator</span>
              <button
                className={`toggle-btn${row.threadCalcEnabled ? ' toggle-btn--on' : ''}`}
                style={{ width: 36, height: 20 }}
                onClick={() => set('threadCalcEnabled', !row.threadCalcEnabled)}>
                <span className="toggle-knob" style={{ width: 14, height: 14 }} />
              </button>
            </div>
            {row.threadCalcEnabled && (() => {
              const seamCm = Number(row.seamLengthCm) || 0
              const factor = THREAD_STITCH_FACTORS[row.stitchType] || 2.5
              const wastPct = Number(row.threadWastage) || 15
              const threadMPerPiece = (seamCm / 100) * factor * (1 + wastPct / 100)
              const threadConeM     = 5000 // standard cone = 5000m
              const conesPerPiece   = threadMPerPiece / threadConeM
              return (
                <div className="rm-row-line" style={{ flexWrap: 'wrap', gap: 10 }}>
                  <Cell label="Total seam length (cm)" hint="All seams combined for one piece">
                    <input type="number" className="input input-sm mono"
                      placeholder="0" min="0" step="1"
                      value={row.seamLengthCm}
                      onChange={e => set('seamLengthCm', e.target.value)} />
                  </Cell>
                  <Cell label="Stitch type">
                    <select className="input input-sm" value={row.stitchType}
                      onChange={e => set('stitchType', e.target.value)}>
                      {Object.keys(THREAD_STITCH_FACTORS).map(t => <option key={t}>{t}</option>)}
                    </select>
                  </Cell>
                  <Cell label="Wastage %" width={90}>
                    <div className="qty-row">
                      <input type="number" className="input input-sm mono"
                        placeholder="15" min="0" step="1"
                        value={row.threadWastage}
                        onChange={e => set('threadWastage', e.target.value)} />
                      <span className="unit-static">%</span>
                    </div>
                  </Cell>
                  {seamCm > 0 && (
                    <>
                      <Cell label="Thread / piece">
                        <div className="rm-subtotal rm-subtotal--active" style={{ fontSize: 11 }}>
                          {threadMPerPiece.toFixed(2)} m
                        </div>
                      </Cell>
                      <Cell label="Cones / piece (5000m)">
                        <div className="rm-subtotal rm-subtotal--active" style={{ fontSize: 11 }}>
                          {conesPerPiece.toFixed(4)}
                        </div>
                      </Cell>
                      <button className="btn btn-ghost btn-sm pd-push-btn"
                        style={{ marginTop: 16 }}
                        onClick={() => {
                          set('qty', conesPerPiece.toFixed(4))
                          set('unit', 'per piece')
                        }}>
                        → Use as qty
                      </button>
                    </>
                  )}
                </div>
              )
            })()}
          </div>
        )}

      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TrimsAccessories() {
  const ta            = useLoomStore(s => s.sections.trimsAccessories)
  const orderQty      = useLoomStore(s => s.header.orderQty)
  const updateSection = useLoomStore(s => s.updateSection)
  const setTa         = updater => updateSection('trimsAccessories', updater)

  const addRow    = () => setTa(prev => ({ ...prev, rows: [...prev.rows, emptyRow()] }))
  const updateRow = (id, field, value) =>
    setTa(prev => ({ ...prev, rows: prev.rows.map(r => r.id === id ? { ...r, [field]: value } : r) }))
  const removeRow = id =>
    setTa(prev => ({ ...prev, rows: prev.rows.filter(r => r.id !== id) }))

  const subtotal = calcTrimsSubtotal(ta)

  // ── Row counts by category ────────────────────────────────────────────────
  const counts = CATEGORIES.reduce((acc, c) => {
    acc[c] = ta.rows.filter(r => r.category === c).length
    return acc
  }, {})

  return (
    <div className="rm-section">
      {ta.rows.length === 0 ? (
        <div className="rm-empty">
          <p>No trims or accessories added yet.</p>
          <p className="rm-empty-sub">
            Add zips, buttons, labels, ribbons, or any trim used per piece.
          </p>
        </div>
      ) : (
        <>
          {/* ── Category legend ── */}
          <div className="ta-legend">
            {CATEGORIES.map(c => counts[c] > 0 && (
              <span key={c} className="ta-legend-chip" style={{ '--cat-color': CATEGORY_COLORS[c] }}>
                {c} ({counts[c]})
              </span>
            ))}
          </div>

          <div className="rm-rows">
            {ta.rows.map((row, i) => (
              <TrimRow
                key={row.id}
                row={row}
                index={i}
                onUpdate={updateRow}
                onRemove={removeRow}
              />
            ))}
          </div>
        </>
      )}

      <div className="rm-footer">
        <button className="btn btn-ghost btn-add-row" onClick={addRow}>
          + Add Trim / Accessory
        </button>

        {ta.rows.length > 0 && (
          <div className="rm-total-row">
            <span className="rm-total-label">
              Trims & Accessories Subtotal
              <span className="rm-row-count">({ta.rows.length} item{ta.rows.length !== 1 ? 's' : ''})</span>
            </span>
            <span className="rm-total-value mono">{inr(subtotal)}</span>
          </div>
        )}
      </div>

      <SectionFooter
        label="Trims & Accessories"
        baseCostPerPiece={subtotal}
        orderQty={orderQty}
        allowancePct={ta.allowancePct || ''}
        onAllowanceChange={v => setTa(prev => ({ ...prev, allowancePct: v }))}
        show={ta.rows.length > 0}
      />
    </div>
  )
}
