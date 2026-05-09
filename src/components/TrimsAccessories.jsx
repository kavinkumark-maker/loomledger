import React from 'react'
import useLoomStore from '../store/useLoomStore'
import SectionFooter from '../ui/SectionFooter'

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = ['Structural', 'Decorative', 'Labels & Tags']
const UNITS      = ['per piece', 'per metre', 'per cm', 'per set', 'per dozen']

const CATEGORY_COLORS = {
  'Structural':   '#3A5A8A',
  'Decorative':   '#7A2D6B',
  'Labels & Tags':'#2D7A44',
}

const CATEGORY_EXAMPLES = {
  'Structural':   'Zip, Button, Velcro, Snap, Hook & eye',
  'Decorative':   'Lace trim, Ribbon, Pom pom, Tassel, Fringe',
  'Labels & Tags':'Woven label, Care label, Hang tag, Barcode',
}

// ── ID + empty row ────────────────────────────────────────────────────────────
const genId    = () => `ta_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
const emptyRow = () => ({
  id:          genId(),
  description: '',
  category:    'Structural',
  qty:         '',
  unit:        'per piece',
  unitPrice:   '',
  wastage:     '0',
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
