import React from 'react'
import useLoomStore from '../store/useLoomStore'
import { calcRowSubtotal, calcWeaveSurcharge } from './RawMaterials'
import { calcDPRowSubtotal } from './DyeingProcessing'
import { calcPrintingSubtotal } from './Printing'
import { calcEmbroiderySubtotal } from './Embroidery'
import { calcOtherDecoSubtotal } from './OtherDecoration'
import { calcTrimsSubtotal } from './TrimsAccessories'
import { calcLabourSubtotal } from './Labour'
import { calcLogisticsSubtotal } from './Logistics'
import { getAggregatePPI } from './RawMaterials'
import { withAllowance } from '../ui/SectionFooter'

// ── Formatters ────────────────────────────────────────────────────────────────
const inr = n =>
  `₹${Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const fx = (n, rate, currency) => {
  if (!rate || !Number(rate)) return null
  const converted = Number(n || 0) * Number(rate)
  return `${currency} ${converted.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Row({ label, value, variant, children }) {
  return (
    <div className={`sr ${variant ? `sr--${variant}` : ''}`}>
      <span className="sr-label">{label}</span>
      {children ?? <span className="sr-value mono">{value}</span>}
    </div>
  )
}

function Divider() {
  return <div className="s-divider" />
}

function InlineInput({ value, onChange, placeholder = '0.00', width = 88 }) {
  return (
    <input
      type="number"
      className="input-inline mono"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ width }}
    />
  )
}

function PctInput({ value, onChange }) {
  return (
    <span className="pct-row">
      <InlineInput value={value} onChange={onChange} placeholder="0" width={52} />
      <span className="pct-sym">%</span>
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SummaryPanel() {
  const header          = useLoomStore(s => s.header)
  const pricingLayer    = useLoomStore(s => s.pricingLayer)
  const updatePricing   = useLoomStore(s => s.updatePricingLayer)

  // ── Cost tallies ──────────────────────────────────────────────────────────
  const sections          = useLoomStore(s => s.sections)
  const rawMaterials = withAllowance(
    sections.rawMaterials.rows.reduce((acc, r) => acc + calcRowSubtotal(r), 0),
    sections.rawMaterials.allowancePct
  )
  const weaveSurcharge = calcWeaveSurcharge(sections.rawMaterials, header.weaveType)
  const weaveSurchargeTotal = weaveSurcharge.dobby + weaveSurcharge.jacquardPremium +
    (Number(sections.rawMaterials.jacquardSetupCost) || 0)
  const dyeingProcessing = withAllowance(
    sections.dyeingProcessing.rows.reduce((acc, r) => {
      const autoQty =
        r.rateUnit === '₹/m'     ? (Number(header.orderLength) || null) :
        r.rateUnit === '₹/piece' ? (Number(header.orderQty)    || null) : null
      const effectiveRow = (!r.qtyOverride && autoQty !== null)
        ? { ...r, qty: String(autoQty) }
        : r
      return acc + calcDPRowSubtotal(effectiveRow)
    }, 0),
    sections.dyeingProcessing.allowancePct
  )
  const trimsAccessories = withAllowance(
    calcTrimsSubtotal(sections.trimsAccessories),
    sections.trimsAccessories.allowancePct
  )
  const df = sections.decorationFinishing
  const decoration =
    withAllowance(calcPrintingSubtotal(df.printing, header.orderQty), df.allowancePct) +
    withAllowance(
      calcEmbroiderySubtotal(df.embroidery, header.orderQty) +
      calcOtherDecoSubtotal(df.otherDecoration),
      df.embDecoAllowancePct
    )
  const autoMetres = Number(header.orderLength) || null
  const autoPPI    = getAggregatePPI(sections.rawMaterials.rows)
  const labour     = withAllowance(
    calcLabourSubtotal(sections.labour, autoMetres, autoPPI),
    sections.labour.allowancePct
  )
  const logistics  = withAllowance(
    calcLogisticsSubtotal(sections.logistics, header.orderQty),
    sections.logistics.allowancePct
  )
  const packaging         = Number(pricingLayer.packagingCost) || 0

  const totalCost =
    rawMaterials + weaveSurchargeTotal + dyeingProcessing +
    trimsAccessories + decoration + labour + logistics + packaging

  const bufferPct = Number(pricingLayer.wastageBuffer) || 0
  const netCost   = totalCost * (1 + bufferPct / 100)

  // ── Seller mode ───────────────────────────────────────────────────────────
  const marginPct     = Number(pricingLayer.profitMargin) || 0
  const sellingPrice  = marginPct < 100 ? netCost / (1 - marginPct / 100) : 0
  const marginAmount  = sellingPrice - netCost

  // ── Buyer mode ────────────────────────────────────────────────────────────
  const targetRetail    = Number(pricingLayer.targetRetailPrice) || 0
  const targetMarginPct = Number(pricingLayer.targetMargin) || 0
  const allowableCost   = targetRetail * (1 - targetMarginPct / 100)
  const costDelta       = allowableCost - netCost
  const fitsTarget      = netCost <= allowableCost && targetRetail > 0

  // ── FX ────────────────────────────────────────────────────────────────────
  const { secondaryCurrency, exchangeRate } = header
  const showLogistics = header.tradeTerm === 'FOB' || header.tradeTerm === 'CIF'
  const qty           = Number(header.orderQty) || 0

  const displayPrice = pricingLayer.mode === 'Seller' ? sellingPrice : netCost

  return (
    <aside className="summary-panel">
      {/* ── Header ── */}
      <div className="sp-header">
        <div className="sp-title-row">
          <h2 className="sp-title">Cost Summary</h2>
          <span className={`sp-term-badge sp-term-badge--${header.tradeTerm.toLowerCase()}`}>
            {header.tradeTerm}
          </span>
        </div>
        {header.costingName && (
          <p className="sp-costing-name">{header.costingName}</p>
        )}
      </div>

      {/* ── Cost breakdown ── */}
      <div className="sp-section">
        <Row label="Raw Materials"        value={inr(rawMaterials)} />

        {header.weaveType === 'Dobby' && weaveSurcharge.dobby > 0 && (
          <Row label="Dobby Surcharge" value={inr(weaveSurcharge.dobby)} variant="accent" />
        )}
        {header.weaveType === 'Jacquard' && (
          <>
            {weaveSurcharge.jacquardPremium > 0 && (
              <Row label="Jacquard Premium" value={inr(weaveSurcharge.jacquardPremium)} variant="accent" />
            )}
            {Number(sections.rawMaterials.jacquardSetupCost) > 0 && (
              <Row label="Jacquard Setup (amortised)" value={inr(Number(sections.rawMaterials.jacquardSetupCost))} variant="accent" />
            )}
          </>
        )}

        <Row label="Dyeing & Processing"  value={inr(dyeingProcessing)} />
        <Row label="Trims & Accessories"  value={inr(trimsAccessories)} />
        <Row label="Decoration & Finish"  value={inr(decoration)} />
        <Row label="Labour & Workmanship" value={inr(labour)} />

        {showLogistics && (
          <Row label="Logistics & Export" value={inr(logistics)} />
        )}

        <Row label="Packaging">
          <InlineInput
            value={pricingLayer.packagingCost}
            onChange={v => updatePricing('packagingCost', v)}
          />
        </Row>

        <Divider />

        <Row label="Total Cost Price" value={inr(totalCost)} variant="total" />

        <Row label="Wastage Buffer">
          <PctInput
            value={pricingLayer.wastageBuffer}
            onChange={v => updatePricing('wastageBuffer', v)}
          />
        </Row>

        <Row label="Net Cost Price" value={inr(netCost)} variant="net" />
      </div>

      {/* ── Mode toggle ── */}
      <div className="sp-mode-toggle">
        <button
          className={`mode-btn${pricingLayer.mode === 'Seller' ? ' mode-btn--active' : ''}`}
          onClick={() => updatePricing('mode', 'Seller')}
        >
          Seller
        </button>
        <button
          className={`mode-btn${pricingLayer.mode === 'Buyer' ? ' mode-btn--active' : ''}`}
          onClick={() => updatePricing('mode', 'Buyer')}
        >
          Buyer
        </button>
      </div>

      {/* ── Seller mode ── */}
      {pricingLayer.mode === 'Seller' && (
        <div className="sp-section sp-section--mode">
          <Row label="Profit Margin">
            <PctInput
              value={pricingLayer.profitMargin}
              onChange={v => updatePricing('profitMargin', v)}
            />
          </Row>

          <Divider />

          <Row label="Selling Price" value={inr(sellingPrice)} variant="price" />
          <Row label="Margin Amount" value={inr(marginAmount)} variant="muted" />

          {fx(sellingPrice, exchangeRate, secondaryCurrency) && (
            <Row
              label={`≈ ${secondaryCurrency}`}
              value={fx(sellingPrice, exchangeRate, secondaryCurrency)}
              variant="fx"
            />
          )}
        </div>
      )}

      {/* ── Buyer mode ── */}
      {pricingLayer.mode === 'Buyer' && (
        <div className="sp-section sp-section--mode">
          <Row label="Target Retail Price">
            <InlineInput
              value={pricingLayer.targetRetailPrice}
              onChange={v => updatePricing('targetRetailPrice', v)}
            />
          </Row>
          {targetRetail > 0 && exchangeRate && (
            <p className="sp-fx-hint">
              ≈ {fx(targetRetail, exchangeRate, secondaryCurrency)} {secondaryCurrency}
            </p>
          )}

          <Row label="Target Margin">
            <PctInput
              value={pricingLayer.targetMargin}
              onChange={v => updatePricing('targetMargin', v)}
            />
          </Row>

          <Divider />

          <Row label="Allowable Cost"  value={inr(allowableCost)} variant="muted" />
          <Row label="Your Net Cost"   value={inr(netCost)}       variant="muted" />

          {targetRetail > 0 && (
            <>
              <div className={`cost-verdict ${fitsTarget ? 'cost-verdict--fits' : 'cost-verdict--over'}`}>
                {fitsTarget
                  ? `✓  Fits — headroom ${inr(costDelta)}`
                  : `✗  Over target by ${inr(Math.abs(costDelta))}`}
              </div>

              {/* Cost breakdown bars */}
              {allowableCost > 0 && (
                <div className="buyer-bars">
                  <p className="buyer-bars-title">Cost breakdown vs allowable</p>
                  {[
                    { label: 'Raw Materials',      value: rawMaterials + weaveSurchargeTotal },
                    { label: 'Dyeing & Processing',value: dyeingProcessing },
                    { label: 'Decoration',          value: decoration },
                    { label: 'Trims',               value: trimsAccessories },
                    { label: 'Labour',              value: labour },
                    { label: 'Logistics',           value: logistics },
                    { label: 'Packaging',           value: packaging },
                  ].filter(s => s.value > 0).map(s => {
                    const pct = Math.min((s.value / allowableCost) * 100, 100)
                    const overAllowable = s.value > allowableCost
                    return (
                      <div key={s.label} className="buyer-bar-row">
                        <span className="buyer-bar-label">{s.label}</span>
                        <div className="buyer-bar-track">
                          <div
                            className={`buyer-bar-fill${overAllowable ? ' buyer-bar-fill--over' : ''}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="buyer-bar-value mono">{inr(s.value)}</span>
                      </div>
                    )
                  })}
                  {/* Allowable cost marker */}
                  <div className="buyer-bar-row buyer-bar-row--marker">
                    <span className="buyer-bar-label">Allowable Cost</span>
                    <div className="buyer-bar-track">
                      <div className="buyer-bar-fill buyer-bar-fill--allowable" style={{ width: '100%' }} />
                    </div>
                    <span className="buyer-bar-value mono">{inr(allowableCost)}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {fx(netCost, exchangeRate, secondaryCurrency) && (
            <Row
              label={`Net Cost in ${secondaryCurrency}`}
              value={fx(netCost, exchangeRate, secondaryCurrency)}
              variant="fx"
            />
          )}
        </div>
      )}

      {/* ── Order totals — always visible ── */}
      <div className="sp-section sp-section--totals">
        <Divider />
        <Row label="Cost / Piece"      value={inr(netCost)}        variant="muted" />
        <Row
          label={qty > 0 ? `Total Order (× ${qty} pcs)` : 'Total Order Value'}
          value={inr(netCost * qty)}
          variant="muted"
        />
        {fx(netCost * qty, exchangeRate, secondaryCurrency) && (
          <Row
            label={`Order in ${secondaryCurrency}`}
            value={fx(netCost * qty, exchangeRate, secondaryCurrency)}
            variant="fx"
          />
        )}
        {qty === 0 && (
          <p className="sp-qty-hint">Enter order quantity in the header to see total order value</p>
        )}
      </div>
    </aside>
  )
}
