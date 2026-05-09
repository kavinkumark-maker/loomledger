import React from 'react'
import useLoomStore from '../store/useLoomStore'
import SectionFooter from '../ui/SectionFooter'
import { getAggregatePPI } from './RawMaterials'

// ── Constants ─────────────────────────────────────────────────────────────────
const SUPPLIER_TYPES = ['Inhouse', 'Subcontract', 'Workshop']
const RATE_UNITS     = ['₹/hr', '₹/m', '₹/pick', '₹/piece']

const SUPPLIER_COLORS = {
  'Inhouse':     '#2D7A44',
  'Subcontract': '#7A5A2D',
  'Workshop':    '#3A5A8A',
}

// ── ID + empty row ────────────────────────────────────────────────────────────
const genId    = () => `lb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

const emptyRow = (overrides = {}) => ({
  id:           genId(),
  operationName:'',
  supplierType: 'Inhouse',
  rateUnit:     '₹/hr',
  // ₹/hr fields
  manhours:     '',
  timeoffPct:   '16',
  rate:         '',
  // ₹/m fields
  metresPerPiece: '',
  metresOverride: false,
  // ₹/pick fields
  ppi:          '',
  ...overrides,
})

// ── Subtotal calculators ──────────────────────────────────────────────────────
export function calcLabourRowSubtotal(row, autoMetres, autoPPI) {
  const rate = Number(row.rate) || 0

  if (row.rateUnit === '₹/hr') {
    const hours   = Number(row.manhours)   || 0
    const timeoff = Number(row.timeoffPct) || 0
    return hours * (1 + timeoff / 100) * rate
  }

  if (row.rateUnit === '₹/m') {
    const metres = row.metresOverride
      ? (Number(row.metresPerPiece) || 0)
      : (autoMetres || Number(row.metresPerPiece) || 0)
    return metres * rate
  }

  if (row.rateUnit === '₹/pick') {
    const ppi = row.ppiOverride
      ? (Number(row.ppi) || 0)
      : (autoPPI != null ? autoPPI : Number(row.ppi) || 0)
    const metres = row.metresOverride
      ? (Number(row.metresPerPiece) || 0)
      : (autoMetres || Number(row.metresPerPiece) || 0)
    return rate * ppi * metres
  }

  if (row.rateUnit === '₹/piece') return rate

  return 0
}

export function calcLabourSubtotal(labour, autoMetres, autoPPI) {
  if (labour.mode === 'Flat CMT') return Number(labour.flatRate) || 0
  return (labour.rows || []).reduce(
    (acc, r) => acc + calcLabourRowSubtotal(r, autoMetres, autoPPI), 0
  )
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

// ── Single operation row ──────────────────────────────────────────────────────
function OperationRow({ row, index, autoMetres, autoPPI, onUpdate, onRemove }) {
  const subtotal   = calcLabourRowSubtotal(row, autoMetres)
  const supColor   = SUPPLIER_COLORS[row.supplierType] || '#6B7A8A'
  const set        = (field, value) => onUpdate(row.id, field, value)

  const isAutoMetres = !row.metresOverride && autoMetres !== null
  const displayMetres = row.metresOverride
    ? row.metresPerPiece
    : (autoMetres !== null ? String(autoMetres) : row.metresPerPiece)

  const isAutoPPI    = !row.ppiOverride && autoPPI !== null
  const displayPPI   = row.ppiOverride
    ? row.ppi
    : (autoPPI !== null ? String(autoPPI) : row.ppi)

  return (
    <div className="rm-row">
      <div className="dp-row-index" style={{ '--sup-color': supColor }}>
        <span className="rm-row-num">{index + 1}</span>
      </div>

      <div className="rm-row-body">
        {/* ── Line 1: Name + Supplier + Rate unit ── */}
        <div className="rm-row-line">
          <Cell label="Operation">
            <input
              type="text"
              className="input input-sm"
              placeholder="e.g. Yarn warping, Weaving, Stitching, Hemming"
              value={row.operationName}
              onChange={e => set('operationName', e.target.value)}
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
              onChange={e => {
                set('rateUnit', e.target.value)
                set('metresOverride', false)
              }}
            >
              {RATE_UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </Cell>
        </div>

        {/* ── Line 2: Rate-unit-specific fields ── */}
        <div className="rm-row-line rm-row-line--price">

          {/* ₹/hr */}
          {row.rateUnit === '₹/hr' && (
            <>
              <Cell label="Manhours" width={100}>
                <input type="number" className="input input-sm mono"
                  placeholder="0" min="0" step="0.01"
                  value={row.manhours}
                  onChange={e => set('manhours', e.target.value)} />
              </Cell>
              <Cell label="Time-off %" width={90}
                hint="Idle / break time (default 16%)">
                <div className="qty-row">
                  <input type="number" className="input input-sm mono"
                    placeholder="16" min="0" max="100"
                    value={row.timeoffPct}
                    onChange={e => set('timeoffPct', e.target.value)} />
                  <span className="unit-static">%</span>
                </div>
              </Cell>
              <Cell label="Rate (₹/hr)" width={120}>
                <input type="number" className="input input-sm mono"
                  placeholder="0.00" min="0" step="0.01"
                  value={row.rate}
                  onChange={e => set('rate', e.target.value)} />
              </Cell>
            </>
          )}

          {/* ₹/m */}
          {row.rateUnit === '₹/m' && (
            <>
              <Cell label={
                <span className="qty-label-row">
                  Metres / Piece
                  {isAutoMetres && <span className="qty-auto-tag">auto · from order length</span>}
                </span>
              } width={170}>
                <div className="qty-row">
                  <input type="number"
                    className={`input input-sm mono${isAutoMetres ? ' input--auto' : ''}`}
                    placeholder="0" min="0" step="0.01"
                    value={displayMetres}
                    onChange={e => { set('metresPerPiece', e.target.value); set('metresOverride', true) }} />
                  {row.metresOverride && autoMetres !== null && (
                    <button className="qty-reset-btn" title="Reset to auto"
                      onClick={() => { set('metresOverride', false); set('metresPerPiece', '') }}>↺</button>
                  )}
                </div>
              </Cell>
              <Cell label="Rate (₹/m)" width={120}>
                <input type="number" className="input input-sm mono"
                  placeholder="0.00" min="0" step="0.01"
                  value={row.rate}
                  onChange={e => set('rate', e.target.value)} />
              </Cell>
            </>
          )}

          {/* ₹/pick */}
          {row.rateUnit === '₹/pick' && (
            <>
              <Cell label={
                <span className="qty-label-row">
                  PPI
                  {isAutoPPI && <span className="qty-auto-tag">auto · from S1</span>}
                </span>
              } width={120}>
                <div className="qty-row">
                  <input type="number"
                    className={`input input-sm mono${isAutoPPI ? ' input--auto' : ''}`}
                    placeholder="0" min="0"
                    value={displayPPI}
                    onChange={e => { set('ppi', e.target.value); set('ppiOverride', true) }} />
                  {row.ppiOverride && autoPPI !== null && (
                    <button className="qty-reset-btn" title="Reset to auto"
                      onClick={() => { set('ppiOverride', false); set('ppi', '') }}>↺</button>
                  )}
                </div>
              </Cell>
              <Cell label={
                <span className="qty-label-row">
                  Metres / Piece
                  {isAutoMetres && <span className="qty-auto-tag">auto</span>}
                </span>
              } width={150}>
                <div className="qty-row">
                  <input type="number"
                    className={`input input-sm mono${isAutoMetres ? ' input--auto' : ''}`}
                    placeholder="0" min="0" step="0.01"
                    value={displayMetres}
                    onChange={e => { set('metresPerPiece', e.target.value); set('metresOverride', true) }} />
                  {row.metresOverride && autoMetres !== null && (
                    <button className="qty-reset-btn" title="Reset to auto"
                      onClick={() => { set('metresOverride', false); set('metresPerPiece', '') }}>↺</button>
                  )}
                </div>
              </Cell>
              <Cell label="Rate (₹/pick)" width={120}>
                <input type="number" className="input input-sm mono"
                  placeholder="0.00000" min="0" step="0.00001"
                  value={row.rate}
                  onChange={e => set('rate', e.target.value)} />
              </Cell>
            </>
          )}

          {/* ₹/piece */}
          {row.rateUnit === '₹/piece' && (
            <Cell label="Rate (₹/piece)" width={150}>
              <input type="number" className="input input-sm mono"
                placeholder="0.00" min="0" step="0.01"
                value={row.rate}
                onChange={e => set('rate', e.target.value)} />
            </Cell>
          )}

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

// ── Weave cascade suggestion banner ──────────────────────────────────────────
function WeaveSuggestion({ weaveType, rows, onAdd }) {
  const suggestions = {
    'Dobby':    { label: 'Dobby loom surcharge', unit: '₹/m' },
    'Jacquard': { label: 'Jacquard weaving',     unit: '₹/m' },
  }
  const suggestion = suggestions[weaveType]
  if (!suggestion) return null

  const alreadyAdded = rows.some(r =>
    r.operationName.toLowerCase().includes(weaveType.toLowerCase())
  )
  if (alreadyAdded) return null

  return (
    <div className={`weave-notice weave-notice--${weaveType.toLowerCase()}`}>
      <span className="weave-notice-icon">◈</span>
      <span>
        {weaveType} weave selected — consider adding a <strong>{suggestion.label}</strong> ({suggestion.unit}) row
      </span>
      <button
        className="btn btn-sm btn-ghost lb-suggest-btn"
        onClick={() => onAdd({ operationName: suggestion.label, rateUnit: '₹/m' })}
      >
        + Add row
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Labour() {
  const labour        = useLoomStore(s => s.sections.labour)
  const header        = useLoomStore(s => s.header)
  const rmRows        = useLoomStore(s => s.sections.rawMaterials.rows)
  const updateSection = useLoomStore(s => s.updateSection)
  const setLabour     = updater => updateSection('labour', updater)

  const autoMetres = Number(header.orderLength) || null
  const autoPPI    = getAggregatePPI(rmRows)     // null if no AUTO weft rows

  // ── Row actions ───────────────────────────────────────────────────────────
  const addRow = (overrides = {}) =>
    setLabour(prev => ({ ...prev, rows: [...(prev.rows || []), emptyRow(overrides)] }))

  const updateRow = (id, field, value) =>
    setLabour(prev => ({
      ...prev,
      rows: prev.rows.map(r => r.id === id ? { ...r, [field]: value } : r),
    }))

  const removeRow = id =>
    setLabour(prev => ({ ...prev, rows: prev.rows.filter(r => r.id !== id) }))

  const subtotal = calcLabourSubtotal(labour, autoMetres)
  const isFlatCMT = labour.mode === 'Flat CMT'

  return (
    <div className="rm-section">
      {/* ── Mode toggle ── */}
      <div className="lb-mode-row">
        <span className="rm-cell-label" style={{ marginBottom: 0 }}>Costing Mode</span>
        <div className="pr-unit-toggle">
          {['Flat CMT', 'Operation-level'].map(m => (
            <button
              key={m}
              className={`pr-unit-btn${labour.mode === m ? ' pr-unit-btn--active' : ''}`}
              onClick={() => setLabour(prev => ({ ...prev, mode: m }))}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* ── Flat CMT ── */}
      {isFlatCMT && (
        <div className="lb-flat-wrap">
          <div className="pr-field">
            <span className="rm-cell-label">CMT Rate</span>
            <div className="pr-rate-row">
              <input
                type="number"
                className="input mono"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={labour.flatRate || ''}
                onChange={e => setLabour(prev => ({ ...prev, flatRate: e.target.value }))}
                style={{ maxWidth: 180 }}
              />
              <span className="pr-unit">₹/piece</span>
            </div>
            <span className="pr-field-hint">
              Cut, Make & Trim — all labour included in a single rate
            </span>
          </div>
        </div>
      )}

      {/* ── Operation-level ── */}
      {!isFlatCMT && (
        <>
          {/* Weave cascade */}
          <WeaveSuggestion
            weaveType={header.weaveType}
            rows={labour.rows || []}
            onAdd={addRow}
          />

          {(labour.rows || []).length === 0 ? (
            <div className="rm-empty">
              <p>No operations added yet.</p>
              <p className="rm-empty-sub">
                Add warping, weaving, cutting, stitching, hemming, inspection, or any labour step.
              </p>
            </div>
          ) : (
            <div className="rm-rows">
              {labour.rows.map((row, i) => (
                <OperationRow
                  key={row.id}
                  row={row}
                  index={i}
                  autoMetres={autoMetres}
                  autoPPI={autoPPI}
                  onUpdate={updateRow}
                  onRemove={removeRow}
                />
              ))}
            </div>
          )}

          <div className="rm-footer">
            <button className="btn btn-ghost btn-add-row" onClick={() => addRow()}>
              + Add Operation
            </button>
            {(labour.rows || []).length > 0 && (
              <div className="rm-total-row">
                <span className="rm-total-label">
                  Labour Subtotal
                  <span className="rm-row-count">
                    ({labour.rows.length} operation{labour.rows.length !== 1 ? 's' : ''})
                  </span>
                </span>
                <span className="rm-total-value mono">{inr(subtotal)}</span>
              </div>
            )}
          </div>
        </>
      )}

      <SectionFooter
        label="Labour & Workmanship"
        baseCostPerPiece={subtotal}
        orderQty={header.orderQty}
        allowancePct={labour.allowancePct || ''}
        onAllowanceChange={v => setLabour(prev => ({ ...prev, allowancePct: v }))}
        show={isFlatCMT ? Number(labour.flatRate) > 0 : (labour.rows || []).length > 0}
      />
    </div>
  )
}
