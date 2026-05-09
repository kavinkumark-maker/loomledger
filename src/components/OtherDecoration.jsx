import React from 'react'
import useLoomStore from '../store/useLoomStore'
import SectionFooter from '../ui/SectionFooter'

const genId = () => `od_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
const emptyRow = () => ({ id: genId(), description: '', cost: '' })
const num = v => Number(v) || 0

const inr = n =>
  `₹${Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

export function calcOtherDecoSubtotal(otherDecoration) {
  if (!otherDecoration.enabled) return 0
  return (otherDecoration.rows || []).reduce((acc, r) => acc + num(r.cost), 0)
}

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

export default function OtherDecoration() {
  const od            = useLoomStore(s => s.sections.decorationFinishing.otherDecoration)
  const updateSection = useLoomStore(s => s.updateSection)

  const setOd = updater =>
    updateSection('decorationFinishing', prev => ({
      ...prev,
      otherDecoration: typeof updater === 'function'
        ? updater(prev.otherDecoration)
        : { ...prev.otherDecoration, ...updater },
    }))

  const addRow    = () => setOd(prev => ({ ...prev, rows: [...(prev.rows || []), emptyRow()] }))
  const updateRow = (id, field, value) =>
    setOd(prev => ({ ...prev, rows: prev.rows.map(r => r.id === id ? { ...r, [field]: value } : r) }))
  const removeRow = id =>
    setOd(prev => ({ ...prev, rows: prev.rows.filter(r => r.id !== id) }))

  const subtotal = calcOtherDecoSubtotal(od)
  const rows = od.rows || []

  return (
    <div className="pr-section">
      <div className="pr-controls">
        <Toggle
          value={od.enabled}
          onChange={v => setOd({ enabled: v })}
          label="Include Other Decoration in cost"
        />
      </div>

      {od.enabled && (
        <div className="pr-form-wrap">
          {rows.length === 0 ? (
            <p className="rm-empty-sub">
              No items added yet. Add appliqué, lace attachment, patchwork, hand smocking, tufting, etc.
            </p>
          ) : (
            <div className="od-rows">
              {rows.map((r, i) => (
                <div key={r.id} className="od-row">
                  <span className="od-index">{i + 1}</span>
                  <input
                    type="text"
                    className="input input-sm od-desc"
                    placeholder="e.g. Appliqué, Lace attachment, Patchwork"
                    value={r.description}
                    onChange={e => updateRow(r.id, 'description', e.target.value)}
                  />
                  <div className="pr-rate-row od-cost">
                    <input
                      type="number"
                      className="input input-sm mono"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      value={r.cost}
                      onChange={e => updateRow(r.id, 'cost', e.target.value)}
                    />
                    <span className="pr-unit">₹/pc</span>
                  </div>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => removeRow(r.id)}
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="rm-footer" style={{ marginTop: 10 }}>
            <button className="btn btn-ghost btn-add-row" onClick={addRow}>
              + Add Item
            </button>
            {rows.length > 0 && (
              <div className="rm-total-row">
                <span className="rm-total-label">
                  Other Decoration Subtotal
                  <span className="rm-row-count">({rows.length} item{rows.length !== 1 ? 's' : ''})</span>
                </span>
                <span className="rm-total-value mono">{inr(subtotal)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {!od.enabled && (
        <p className="pr-disabled-note">
          Other decoration is excluded from the cost. Toggle on to include it.
        </p>
      )}
    </div>
  )
}
