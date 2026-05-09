import React from 'react'

const inr = n =>
  `₹${Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const num = v => Number(v) || 0

/**
 * Reusable section footer showing:
 *  - Allowance % input (production overrun buffer)
 *  - Base cost / piece
 *  - Adjusted cost / piece (after allowance)
 *  - Total section cost for order
 *  - Effective production qty
 *
 * Props:
 *  label           — e.g. "Raw Materials"
 *  baseCostPerPiece — section subtotal per piece (before allowance)
 *  orderQty        — from header
 *  allowancePct    — stored in section state
 *  onAllowanceChange — (value: string) => void
 *  show            — whether to render (hide when no rows / disabled)
 */
export default function SectionFooter({
  label,
  baseCostPerPiece,
  orderQty,
  allowancePct,
  onAllowanceChange,
  show = true,
}) {
  if (!show) return null

  const base     = num(baseCostPerPiece)
  const qty      = num(orderQty)
  const pct      = num(allowancePct)
  const adjusted = base * (1 + pct / 100)
  const effQty   = Math.ceil(qty * (1 + pct / 100))
  const total    = adjusted * qty   // adjusted cost amortised across sold qty

  return (
    <div className="sf-wrap">
      {/* ── Allowance row ── */}
      <div className="sf-allowance-row">
        <label className="sf-allowance-label" htmlFor={`allowance-${label}`}>
          Production Allowance
          <span className="sf-allowance-hint">
            Extra pieces manufactured to cover rejects / overrun
          </span>
        </label>
        <div className="sf-allowance-input-row">
          <input
            id={`allowance-${label}`}
            type="number"
            className="input input-sm mono sf-pct-input"
            placeholder="0"
            min="0"
            max="100"
            step="0.5"
            value={allowancePct}
            onChange={e => onAllowanceChange(e.target.value)}
          />
          <span className="unit-static">%</span>
          {pct > 0 && qty > 0 && (
            <span className="sf-eff-qty">
              → {qty} sold + {effQty - qty} extra = {effQty} pcs produced
            </span>
          )}
        </div>
      </div>

      {/* ── Cost breakdown ── */}
      <div className="sf-costs">
        <div className="sf-cost-row">
          <span className="sf-cost-label">Base cost / piece</span>
          <span className="sf-cost-value mono">{inr(base)}</span>
        </div>

        {pct > 0 && (
          <div className="sf-cost-row sf-cost-row--adjusted">
            <span className="sf-cost-label">
              Adjusted cost / piece
              <span className="sf-cost-sublabel">(+{pct}% allowance amortised)</span>
            </span>
            <span className="sf-cost-value sf-cost-value--adjusted mono">{inr(adjusted)}</span>
          </div>
        )}

        <div className="sf-cost-row sf-cost-row--total">
          <span className="sf-cost-label">
            {label} — Total for order
            {qty > 0 && <span className="sf-cost-sublabel">(× {qty} pcs sold)</span>}
          </span>
          <span className="sf-cost-value sf-cost-value--total mono">
            {qty > 0 ? inr(total) : '— enter order qty in header'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Helper: apply allowance to a base subtotal ──────────────────────────────
export function withAllowance(base, allowancePct) {
  return base * (1 + (Number(allowancePct) || 0) / 100)
}
