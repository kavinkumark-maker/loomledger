import React from 'react'
import useLoomStore from '../store/useLoomStore'

// ── ID generator ──────────────────────────────────────────────────────────────
const genId = () => `emb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

// ── Empty placement row ───────────────────────────────────────────────────────
const emptyPlacement = () => ({
  id:           genId(),
  name:         '',
  stitchCount:  '',   // in thousands
  machineRate:  '',   // ₹ per 1000 stitches
  backing:      '',   // ₹/piece
})

// ── Formatters ────────────────────────────────────────────────────────────────
const inr = n =>
  `₹${Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
const num = v => Number(v) || 0

// ── Placement subtotal ────────────────────────────────────────────────────────
function placementSubtotal(p) {
  return num(p.stitchCount) * num(p.machineRate) + num(p.backing)
}

// ── Exported subtotal calculator ──────────────────────────────────────────────
export function calcEmbroiderySubtotal(embroidery, orderQty) {
  if (!embroidery.enabled) return 0
  const qty = num(orderQty)

  if (embroidery.mode === 'Standard Placements') {
    const placementsTotal = (embroidery.placements || []).reduce(
      (acc, p) => acc + placementSubtotal(p), 0
    )
    const digitisingAmort = qty > 0 ? num(embroidery.digitisingCharge) / qty : 0
    return placementsTotal + digitisingAmort
  }

  if (embroidery.mode === 'Continuous') {
    const c = embroidery.continuous || {}
    // stitches per piece = density × length(cm) → cost = stitches/1000 × rate
    const stitches     = num(c.stitchDensity) * num(c.embLength)
    const machineCost  = (stitches / 1000) * num(c.machineRate)
    const backingCost  = num(c.backing) * (num(c.embLength) / 100) // backing ₹/m × metres
    const digitAmort   = qty > 0 ? num(c.digitisingCharge) / qty : 0
    return machineCost + backingCost + digitAmort
  }

  return 0
}

// ── Reusable field ────────────────────────────────────────────────────────────
function Field({ label, hint, children, width }) {
  return (
    <div className="pr-field" style={width ? { flex: `0 0 ${width}px` } : {}}>
      <span className="rm-cell-label">{label}</span>
      {children}
      {hint && <span className="pr-field-hint">{hint}</span>}
    </div>
  )
}

function ReadOnly({ label, value }) {
  return (
    <Field label={label}>
      <div className="rm-subtotal rm-subtotal--active">{value}</div>
    </Field>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ value, onChange, label }) {
  return (
    <label className="toggle-row">
      <span className="toggle-label">{label}</span>
      <button
        className={`toggle-btn${value ? ' toggle-btn--on' : ''}`}
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
      >
        <span className="toggle-knob" />
      </button>
    </label>
  )
}

// ── Standard placements ───────────────────────────────────────────────────────
function StandardPlacements({ embroidery, setEmb, orderQty }) {
  const qty          = num(orderQty)
  const digitAmort   = qty > 0 ? num(embroidery.digitisingCharge) / qty : null
  const placements   = embroidery.placements || []
  const placTotal    = placements.reduce((acc, p) => acc + placementSubtotal(p), 0)
  const grandTotal   = placTotal + (digitAmort || 0)

  const addPlacement = () =>
    setEmb(prev => ({ ...prev, placements: [...(prev.placements || []), emptyPlacement()] }))

  const updatePlacement = (id, field, value) =>
    setEmb(prev => ({
      ...prev,
      placements: prev.placements.map(p => p.id === id ? { ...p, [field]: value } : p),
    }))

  const removePlacement = id =>
    setEmb(prev => ({ ...prev, placements: prev.placements.filter(p => p.id !== id) }))

  return (
    <div className="emb-form">
      {/* Placement rows */}
      {placements.length === 0 ? (
        <p className="rm-empty-sub" style={{ padding: '8px 0' }}>
          No placements added yet. Add a motif, border, or any embroidered element.
        </p>
      ) : (
        <div className="rm-rows">
          {placements.map((p, i) => {
            const sub = placementSubtotal(p)
            return (
              <div key={p.id} className="emb-placement-row">
                <div className="dp-row-index" style={{ '--sup-color': '#7A2D6B' }}>
                  <span className="rm-row-num">{i + 1}</span>
                </div>
                <div className="rm-row-body">
                  <div className="rm-row-line">
                    <Field label="Placement Name">
                      <input
                        type="text"
                        className="input input-sm"
                        placeholder='e.g. Corner motif, Border'
                        value={p.name}
                        onChange={e => updatePlacement(p.id, 'name', e.target.value)}
                      />
                    </Field>
                    <Field label="Stitch Count (thousands)" width={160}>
                      <div className="pr-rate-row">
                        <input
                          type="number"
                          className="input input-sm mono"
                          placeholder="0"
                          min="0"
                          value={p.stitchCount}
                          onChange={e => updatePlacement(p.id, 'stitchCount', e.target.value)}
                        />
                        <span className="pr-unit">K</span>
                      </div>
                    </Field>
                    <Field label="Machine Rate" width={140}>
                      <div className="pr-rate-row">
                        <input
                          type="number"
                          className="input input-sm mono"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          value={p.machineRate}
                          onChange={e => updatePlacement(p.id, 'machineRate', e.target.value)}
                        />
                        <span className="pr-unit">₹/K st</span>
                      </div>
                    </Field>
                    <Field label="Backing / Stabiliser" width={130}>
                      <div className="pr-rate-row">
                        <input
                          type="number"
                          className="input input-sm mono"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          value={p.backing}
                          onChange={e => updatePlacement(p.id, 'backing', e.target.value)}
                        />
                        <span className="pr-unit">₹/pc</span>
                      </div>
                    </Field>
                    <ReadOnly label="Subtotal / Piece" value={inr(sub)} />
                    <div className="rm-row-remove">
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => removePlacement(p.id)}
                      >✕</button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="rm-footer" style={{ marginTop: 8 }}>
        <button className="btn btn-ghost btn-add-row" onClick={addPlacement}>
          + Add Placement
        </button>
      </div>

      {/* Digitising charge */}
      <div className="emb-digitising">
        <Field label="Digitising Charge (₹ one-time)" hint="Amortised over order quantity">
          <input
            type="number"
            className="input input-sm mono"
            placeholder="0.00"
            min="0"
            step="0.01"
            value={embroidery.digitisingCharge || ''}
            onChange={e => setEmb(prev => ({ ...prev, digitisingCharge: e.target.value }))}
          />
        </Field>
        <ReadOnly
          label="Digitising / Piece"
          value={digitAmort !== null ? inr(digitAmort) : '— enter order qty in header'}
        />
      </div>

      {/* Grand total */}
      {(placements.length > 0 || num(embroidery.digitisingCharge) > 0) && (
        <div className="pr-total-bar" style={{ marginTop: 8 }}>
          <span className="rm-total-label">Total Embroidery / Piece</span>
          <span className="rm-total-value mono">{inr(grandTotal)}</span>
        </div>
      )}
    </div>
  )
}

// ── Continuous embroidery ─────────────────────────────────────────────────────
function ContinuousForm({ embroidery, setEmb, orderQty }) {
  const qty = num(orderQty)
  const c   = embroidery.continuous || {}

  const stitches    = num(c.stitchDensity) * num(c.embLength)
  const machineCost = (stitches / 1000) * num(c.machineRate)
  const backingCost = num(c.backing) * (num(c.embLength) / 100)
  const digitAmort  = qty > 0 ? num(c.digitisingCharge) / qty : null
  const total       = machineCost + backingCost + (digitAmort || 0)

  const setC = (field, value) =>
    setEmb(prev => ({
      ...prev,
      continuous: { ...prev.continuous, [field]: value },
    }))

  return (
    <div className="pr-form-grid">
      <Field label="Embroidery Length / Piece" hint="Total length of embroidery run">
        <div className="pr-rate-row">
          <input type="number" className="input input-sm mono" placeholder="0"
            min="0" value={c.embLength ?? ''}
            onChange={e => setC('embLength', e.target.value)} />
          <span className="pr-unit">cm</span>
        </div>
      </Field>

      <Field label="Stitch Density">
        <div className="pr-rate-row">
          <input type="number" className="input input-sm mono" placeholder="0"
            min="0" value={c.stitchDensity ?? ''}
            onChange={e => setC('stitchDensity', e.target.value)} />
          <span className="pr-unit">st/cm</span>
        </div>
      </Field>

      <Field label="Machine Rate">
        <div className="pr-rate-row">
          <input type="number" className="input input-sm mono" placeholder="0.00"
            min="0" step="0.01" value={c.machineRate ?? ''}
            onChange={e => setC('machineRate', e.target.value)} />
          <span className="pr-unit">₹/K st</span>
        </div>
      </Field>

      <Field label="Backing / Stabiliser">
        <div className="pr-rate-row">
          <input type="number" className="input input-sm mono" placeholder="0.00"
            min="0" step="0.01" value={c.backing ?? ''}
            onChange={e => setC('backing', e.target.value)} />
          <span className="pr-unit">₹/m</span>
        </div>
      </Field>

      <Field label="Digitising Charge (₹ one-time)" hint="Amortised over order quantity">
        <input type="number" className="input input-sm mono" placeholder="0.00"
          min="0" step="0.01" value={c.digitisingCharge ?? ''}
          onChange={e => setC('digitisingCharge', e.target.value)} />
      </Field>

      <ReadOnly
        label="Digitising / Piece"
        value={digitAmort !== null ? inr(digitAmort) : '— enter order qty in header'}
      />

      <ReadOnly label="Total Embroidery / Piece" value={inr(total)} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Embroidery({ orderQty }) {
  const embroidery    = useLoomStore(s => s.sections.decorationFinishing.embroidery)
  const updateSection = useLoomStore(s => s.updateSection)

  const setEmb = updater =>
    updateSection('decorationFinishing', prev => ({
      ...prev,
      embroidery: typeof updater === 'function'
        ? updater(prev.embroidery)
        : { ...prev.embroidery, ...updater },
    }))

  return (
    <div className="pr-section">
      <div className="pr-controls">
        <Toggle
          value={embroidery.enabled}
          onChange={v => setEmb({ enabled: v })}
          label="Include Embroidery in cost"
        />

        {embroidery.enabled && (
          <div className="pr-method-tabs">
            {['Standard Placements', 'Continuous'].map(m => (
              <button
                key={m}
                className={`pr-tab${embroidery.mode === m ? ' pr-tab--active' : ''}`}
                onClick={() => setEmb({ mode: m })}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {embroidery.enabled && (
        <div className="pr-form-wrap">
          {embroidery.mode === 'Standard Placements' && (
            <StandardPlacements
              embroidery={embroidery}
              setEmb={setEmb}
              orderQty={orderQty}
            />
          )}
          {embroidery.mode === 'Continuous' && (
            <ContinuousForm
              embroidery={embroidery}
              setEmb={setEmb}
              orderQty={orderQty}
            />
          )}
        </div>
      )}

      {!embroidery.enabled && (
        <p className="pr-disabled-note">
          Embroidery is excluded from the cost. Toggle on to include it.
        </p>
      )}
    </div>
  )
}
