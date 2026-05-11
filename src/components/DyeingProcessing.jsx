import React from 'react'
import useLoomStore from '../store/useLoomStore'
import SectionFooter from '../ui/SectionFooter'

// ── Constants ─────────────────────────────────────────────────────────────────
const SUPPLIER_TYPES = ['Inhouse', 'Subcontract']
const RATE_UNITS     = ['₹/kg', '₹/m', '₹/piece']

// ── Named process suggestions (quick-fill) ────────────────────────────────────
const PROCESS_SUGGESTIONS = [
  'Yarn Dyeing', 'Piece Dyeing', 'Garment Dyeing',
  'Bleaching', 'Mercerizing', 'Sizing', 'Desizing',
  'Sanforizing', 'Calendering', 'Softening',
  'Fusing', 'Pre-shrinking', 'Anti-pilling Finish',
  'Water Repellent Finish', 'Flame Retardant Finish',
  'Washing (Enzyme / Stone / Acid)', 'Printing Pre-treatment',
]

const SUPPLIER_COLORS = {
  'Inhouse':     '#2D7A44',
  'Subcontract': '#7A5A2D',
}

// ── ID generator ──────────────────────────────────────────────────────────────
const genId = () => `dp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

// ── Empty row factory ─────────────────────────────────────────────────────────
const emptyRow = () => ({
  id:           genId(),
  processName:  '',
  supplierType: 'Inhouse',
  rateUnit:     '₹/piece',
  qty:          '',
  qtyOverride:  false,   // true = user has manually typed a qty
  wastage:      '0',
  rate:         '',
})

// ── Row subtotal ──────────────────────────────────────────────────────────────
export function calcDPRowSubtotal(row) {
  const qty    = Number(row.qty)     || 0
  const waste  = Number(row.wastage) || 0
  const rate   = Number(row.rate)    || 0
  return qty * (1 + waste / 100) * rate
}

// ── Format helpers ────────────────────────────────────────────────────────────
const inr = n =>
  `₹${Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

// ── Cell ──────────────────────────────────────────────────────────────────────
function Cell({ label, children, width }) {
  return (
    <div className="dp-cell" style={width ? { flex: `0 0 ${width}px` } : {}}>
      {label && <span className="rm-cell-label">{label}</span>}
      {children}
    </div>
  )
}

// ── Single row ────────────────────────────────────────────────────────────────
function ProcessRow({ row, index, autoQty, onUpdate, onRemove }) {
  const subtotal     = calcDPRowSubtotal(row)
  const supplierColor = SUPPLIER_COLORS[row.supplierType] || '#6B7A8A'
  const isAutoQty    = !row.qtyOverride && autoQty !== null

  const set = (field, value) => onUpdate(row.id, field, value)

  const handleQtyChange = val => {
    set('qty', val)
    set('qtyOverride', true)
  }

  const handleRateUnitChange = val => {
    // When switching rate unit, reset qty override so auto can take over
    set('rateUnit', val)
    if (!row.qtyOverride) set('qty', '')
  }

  // Show the auto qty in the input if not overridden
  const displayQty = row.qtyOverride ? row.qty : (autoQty !== null ? String(autoQty) : row.qty)

  const qtyHint = !row.qtyOverride && autoQty !== null
    ? { '₹/m': 'from order length', '₹/piece': 'from order qty' }[row.rateUnit] || ''
    : ''

  return (
    <div className="dp-row">
      {/* Supplier colour stripe */}
      <div className="dp-row-index" style={{ '--sup-color': supplierColor }}>
        <span className="rm-row-num">{index + 1}</span>
      </div>

      <div className="rm-row-body">
        {/* ── Line 1: Process + supplier ── */}
        <div className="rm-row-line">
          <Cell label="Process Name">
            <input
              type="text"
              className="input input-sm"
              list="dp-process-suggestions"
              placeholder="e.g. Yarn Dyeing, Fusing, Sanforizing…"
              value={row.processName}
              onChange={e => set('processName', e.target.value)}
            />
            <datalist id="dp-process-suggestions">
              {PROCESS_SUGGESTIONS.map(p => <option key={p} value={p} />)}
            </datalist>
          </Cell>

          <Cell label="Supplier Type" width={130}>
            <select
              className="input input-sm"
              value={row.supplierType}
              onChange={e => set('supplierType', e.target.value)}
              style={{ color: supplierColor, fontWeight: 500 }}
            >
              {SUPPLIER_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Cell>

          <Cell label="Rate Unit" width={100}>
            <select
              className="input input-sm mono"
              value={row.rateUnit}
              onChange={e => handleRateUnitChange(e.target.value)}
            >
              {RATE_UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </Cell>
        </div>

        {/* ── Line 2: Qty + Wastage + Rate + Subtotal ── */}
        <div className="rm-row-line rm-row-line--price">
          <Cell label={
            <span className="qty-label-row">
              Quantity
              {qtyHint && <span className="qty-auto-tag">auto · {qtyHint}</span>}
            </span>
          }>
            <div className="qty-row">
              <input
                type="number"
                className={`input input-sm mono${isAutoQty ? ' input--auto' : ''}`}
                placeholder="0"
                min="0"
                step="0.01"
                value={displayQty}
                onChange={e => handleQtyChange(e.target.value)}
              />
              {row.qtyOverride && autoQty !== null && (
                <button
                  className="qty-reset-btn"
                  title="Reset to auto value"
                  onClick={() => { set('qtyOverride', false); set('qty', '') }}
                >↺</button>
              )}
            </div>
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

          <Cell label={`Rate (${row.rateUnit})`} width={120}>
            <input
              type="number"
              className="input input-sm mono"
              placeholder="0.00"
              min="0"
              step="0.01"
              value={row.rate}
              onChange={e => set('rate', e.target.value)}
            />
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
              title="Remove this row"
            >✕</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DyeingProcessing() {
  const header        = useLoomStore(s => s.header)
  const dp            = useLoomStore(s => s.sections.dyeingProcessing)
  const updateSection = useLoomStore(s => s.updateSection)

  const setDp = updater => updateSection('dyeingProcessing', updater)

  // ── Auto qty values derived from header ───────────────────────────────────
  const autoQtyFor = rateUnit => {
    if (rateUnit === '₹/m')     return Number(header.orderLength) || null
    if (rateUnit === '₹/piece') return Number(header.orderQty)    || null
    return null  // ₹/kg — manual until Phase 8
  }

  // ── Row actions ───────────────────────────────────────────────────────────
  const addRow = () =>
    setDp(prev => ({ ...prev, rows: [...prev.rows, emptyRow()] }))

  const updateRow = (id, field, value) =>
    setDp(prev => ({
      ...prev,
      rows: prev.rows.map(r => r.id === id ? { ...r, [field]: value } : r),
    }))

  const removeRow = id =>
    setDp(prev => ({ ...prev, rows: prev.rows.filter(r => r.id !== id) }))

  // ── Totals ────────────────────────────────────────────────────────────────
  const subtotal = dp.rows.reduce((acc, r) => {
    const effectiveRow = (!r.qtyOverride && autoQtyFor(r.rateUnit) !== null)
      ? { ...r, qty: String(autoQtyFor(r.rateUnit)) }
      : r
    return acc + calcDPRowSubtotal(effectiveRow)
  }, 0)

  return (
    <div className="rm-section">
      {dp.rows.length === 0 ? (
        <div className="rm-empty">
          <p>No processes added yet.</p>
          <p className="rm-empty-sub">
            Add dyeing, bleaching, finishing, or any wet/dry processing step.
          </p>
        </div>
      ) : (
        <div className="rm-rows">
          {dp.rows.map((row, i) => (
            <ProcessRow
              key={row.id}
              row={row}
              index={i}
              autoQty={autoQtyFor(row.rateUnit)}
              onUpdate={updateRow}
              onRemove={removeRow}
            />
          ))}
        </div>
      )}

      <div className="rm-footer">
        <button className="btn btn-ghost btn-add-row" onClick={addRow}>
          + Add Process
        </button>

        {dp.rows.length > 0 && (
          <div className="rm-total-row">
            <span className="rm-total-label">
              Dyeing & Processing Subtotal
              <span className="rm-row-count">({dp.rows.length} row{dp.rows.length !== 1 ? 's' : ''})</span>
            </span>
            <span className="rm-total-value mono">{inr(subtotal)}</span>
          </div>
        )}
      </div>

      <SectionFooter
        label="Dyeing & Processing"
        baseCostPerPiece={subtotal}
        orderQty={header.orderQty}
        allowancePct={dp.allowancePct || ''}
        onAllowanceChange={v => setDp(prev => ({ ...prev, allowancePct: v }))}
        show={dp.rows.length > 0}
      />
    </div>
  )
}
