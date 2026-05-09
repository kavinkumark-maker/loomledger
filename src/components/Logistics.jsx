import React from 'react'
import useLoomStore from '../store/useLoomStore'
import SectionFooter from '../ui/SectionFooter'

// ── Constants ─────────────────────────────────────────────────────────────────
const SUPPLIER_TYPES  = ['Inhouse', 'Subcontract', 'Customs']
const LOG_RATE_UNITS  = ['₹/piece', '₹/kg']
const COST_UNITS      = ['per style', 'per shipment']

const SUPPLIER_COLORS = {
  'Inhouse':     '#2D7A44',
  'Subcontract': '#7A5A2D',
  'Customs':     '#3A5A8A',
}

// ── ID + empty factories ──────────────────────────────────────────────────────
const genId       = () => `lg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
const genCompId   = () => `lc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

const emptyRow = () => ({
  id:           genId(),
  description:  '',
  supplierType: 'Subcontract',
  rateUnit:     '₹/piece',
  rate:         '',
})

const emptyCompliance = () => ({
  id:       genCompId(),
  testName: '',
  cost:     '',
  costUnit: 'per style',  // 'per style' | 'per shipment'
})

// ── Subtotal calculators ──────────────────────────────────────────────────────
function calcLogRowSubtotal(row) {
  return Number(row.rate) || 0   // ₹/piece already; ₹/kg needs weight (Phase 9)
}

function calcCompliancePerPiece(comp, orderQty) {
  const cost = Number(comp.cost) || 0
  const qty  = Number(orderQty)  || 0
  return qty > 0 ? cost / qty : 0
}

export function calcLogisticsSubtotal(logistics, orderQty) {
  const rowsTotal = (logistics.rows || []).reduce(
    (acc, r) => acc + calcLogRowSubtotal(r), 0
  )
  const complianceTotal = (logistics.compliance || []).reduce(
    (acc, c) => acc + calcCompliancePerPiece(c, orderQty), 0
  )
  return rowsTotal + complianceTotal
}

// ── Formatter ─────────────────────────────────────────────────────────────────
const inr = n =>
  `₹${Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

// ── Cell ──────────────────────────────────────────────────────────────────────
function Cell({ label, children, width, hint }) {
  return (
    <div className="rm-cell" style={width ? { flex: `0 0 ${width}px` } : {}}>
      {label && <span className="rm-cell-label">{label}</span>}
      {children}
      {hint && <span className="pr-field-hint">{hint}</span>}
    </div>
  )
}

// ── Logistics row ─────────────────────────────────────────────────────────────
function LogRow({ row, index, onUpdate, onRemove }) {
  const subtotal  = calcLogRowSubtotal(row)
  const supColor  = SUPPLIER_COLORS[row.supplierType] || '#6B7A8A'
  const set       = (field, value) => onUpdate(row.id, field, value)

  return (
    <div className="rm-row">
      <div className="dp-row-index" style={{ '--sup-color': supColor }}>
        <span className="rm-row-num">{index + 1}</span>
      </div>

      <div className="rm-row-body">
        <div className="rm-row-line rm-row-line--price">
          <Cell label="Description">
            <input
              type="text"
              className="input input-sm"
              placeholder="e.g. Inspection, Trucking, Shipping doc fee, Licence fee"
              value={row.description}
              onChange={e => set('description', e.target.value)}
            />
          </Cell>

          <Cell label="Supplier" width={130}>
            <select
              className="input input-sm"
              value={row.supplierType}
              onChange={e => set('supplierType', e.target.value)}
              style={{ color: supColor, fontWeight: 500 }}
            >
              {SUPPLIER_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Cell>

          <Cell label="Rate Unit" width={100}>
            <select
              className="input input-sm mono"
              value={row.rateUnit}
              onChange={e => set('rateUnit', e.target.value)}
            >
              {LOG_RATE_UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </Cell>

          <Cell
            label={`Rate (${row.rateUnit})`}
            width={120}
            hint={row.rateUnit === '₹/kg' ? 'Weight auto-fill in Phase 9' : undefined}
          >
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
            <button className="btn btn-sm btn-danger"
              onClick={() => onRemove(row.id)} title="Remove">✕</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Compliance row ────────────────────────────────────────────────────────────
function ComplianceRow({ comp, index, orderQty, onUpdate, onRemove }) {
  const amortised = calcCompliancePerPiece(comp, orderQty)
  const set       = (field, value) => onUpdate(comp.id, field, value)

  return (
    <div className="lg-comp-row">
      <span className="od-index">{index + 1}</span>

      <input
        type="text"
        className="input input-sm lg-comp-name"
        placeholder="e.g. OEKO-TEX, REACH, AATCC colour fastness, Shrinkage test"
        value={comp.testName}
        onChange={e => set('testName', e.target.value)}
      />

      <div className="pr-rate-row" style={{ flex: '0 0 160px' }}>
        <input
          type="number"
          className="input input-sm mono"
          placeholder="0.00"
          min="0"
          step="0.01"
          value={comp.cost}
          onChange={e => set('cost', e.target.value)}
        />
        <span className="pr-unit">₹</span>
      </div>

      <select
        className="input input-sm lg-comp-unit"
        value={comp.costUnit}
        onChange={e => set('costUnit', e.target.value)}
      >
        {COST_UNITS.map(u => <option key={u}>{u}</option>)}
      </select>

      <div className={`rm-subtotal${amortised > 0 ? ' rm-subtotal--active' : ''}`}
        style={{ flex: '0 0 110px' }}
        title="Amortised cost per piece">
        {Number(orderQty) > 0 ? inr(amortised) : '—'}
        <span style={{ fontSize: 9, marginLeft: 3, opacity: 0.6 }}>/pc</span>
      </div>

      <button className="btn btn-sm btn-danger"
        onClick={() => onRemove(comp.id)} title="Remove">✕</button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Logistics() {
  const logistics     = useLoomStore(s => s.sections.logistics)
  const header        = useLoomStore(s => s.header)
  const updateSection = useLoomStore(s => s.updateSection)
  const setLog        = updater => updateSection('logistics', updater)

  // ── Row actions ───────────────────────────────────────────────────────────
  const addRow    = () => setLog(prev => ({ ...prev, rows: [...(prev.rows || []), emptyRow()] }))
  const updateRow = (id, field, value) =>
    setLog(prev => ({ ...prev, rows: prev.rows.map(r => r.id === id ? { ...r, [field]: value } : r) }))
  const removeRow = id =>
    setLog(prev => ({ ...prev, rows: prev.rows.filter(r => r.id !== id) }))

  // ── Compliance actions ────────────────────────────────────────────────────
  const addComp    = () => setLog(prev => ({ ...prev, compliance: [...(prev.compliance || []), emptyCompliance()] }))
  const updateComp = (id, field, value) =>
    setLog(prev => ({ ...prev, compliance: prev.compliance.map(c => c.id === id ? { ...c, [field]: value } : c) }))
  const removeComp = id =>
    setLog(prev => ({ ...prev, compliance: prev.compliance.filter(c => c.id !== id) }))

  const rows       = logistics.rows       || []
  const compliance = logistics.compliance || []
  const subtotal   = calcLogisticsSubtotal(logistics, header.orderQty)

  const rowsSubtotal      = rows.reduce((acc, r) => acc + calcLogRowSubtotal(r), 0)
  const complianceSubtotal = compliance.reduce(
    (acc, c) => acc + calcCompliancePerPiece(c, header.orderQty), 0
  )

  return (
    <div className="rm-section">

      {/* ── Logistics rows ── */}
      <div className="lg-sub-label">Logistics Charges</div>

      {rows.length === 0 ? (
        <div className="rm-empty">
          <p>No logistics charges added yet.</p>
          <p className="rm-empty-sub">
            Add inspection, trucking, shipping document fees, delivery charges, or licence fees.
          </p>
        </div>
      ) : (
        <div className="rm-rows">
          {rows.map((row, i) => (
            <LogRow key={row.id} row={row} index={i}
              onUpdate={updateRow} onRemove={removeRow} />
          ))}
        </div>
      )}

      <div className="rm-footer" style={{ marginBottom: 20 }}>
        <button className="btn btn-ghost btn-add-row" onClick={addRow}>
          + Add Charge
        </button>
        {rows.length > 0 && (
          <div className="rm-total-row">
            <span className="rm-total-label">Logistics Subtotal</span>
            <span className="rm-total-value mono">{inr(rowsSubtotal)}</span>
          </div>
        )}
      </div>

      {/* ── Compliance & Testing ── */}
      <div className="lg-sub-label" style={{ borderTop: `1px solid var(--br)`, paddingTop: 16 }}>
        Compliance & Testing
        <span className="lg-sub-hint">One-time costs amortised over order quantity</span>
      </div>

      {compliance.length === 0 ? (
        <div className="rm-empty">
          <p>No compliance costs added yet.</p>
          <p className="rm-empty-sub">
            Add OEKO-TEX, REACH, colour fastness, bursting strength, shrinkage tests, etc.
          </p>
        </div>
      ) : (
        <div className="lg-comp-rows">
          {compliance.map((c, i) => (
            <ComplianceRow key={c.id} comp={c} index={i}
              orderQty={header.orderQty}
              onUpdate={updateComp} onRemove={removeComp} />
          ))}
        </div>
      )}

      <div className="rm-footer" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost btn-add-row" onClick={addComp}>
          + Add Test / Certification
        </button>
        {compliance.length > 0 && (
          <div className="rm-total-row">
            <span className="rm-total-label">
              Compliance / piece
              {!Number(header.orderQty) && (
                <span className="rm-row-count"> — enter order qty in header</span>
              )}
            </span>
            <span className="rm-total-value mono">{inr(complianceSubtotal)}</span>
          </div>
        )}
      </div>

      <SectionFooter
        label="Logistics & Export"
        baseCostPerPiece={subtotal}
        orderQty={header.orderQty}
        allowancePct={logistics.allowancePct || ''}
        onAllowanceChange={v => setLog(prev => ({ ...prev, allowancePct: v }))}
        show={rows.length > 0 || compliance.length > 0}
      />
    </div>
  )
}
