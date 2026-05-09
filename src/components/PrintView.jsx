import React from 'react'
import useLoomStore from '../store/useLoomStore'
import { calcRowSubtotal, calcWeaveSurcharge, getAutoComputed } from './RawMaterials'
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

const fmtDate = iso => {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ── Print sub-components ──────────────────────────────────────────────────────
function PSection({ title, children }) {
  return (
    <div className="pv-section">
      <div className="pv-section-title">{title}</div>
      {children}
    </div>
  )
}

function PTable({ headers, rows }) {
  if (!rows || rows.length === 0) return (
    <p className="pv-empty">No entries</p>
  )
  return (
    <table className="pv-table">
      <thead>
        <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => <td key={j}>{cell ?? '—'}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PCostRow({ label, value, bold, indent, accent }) {
  return (
    <div className={`pv-cost-row${bold ? ' pv-cost-row--bold' : ''}${indent ? ' pv-cost-row--indent' : ''}${accent ? ' pv-cost-row--accent' : ''}`}>
      <span>{label}</span>
      <span className="mono">{value}</span>
    </div>
  )
}

// ── Main PrintView ────────────────────────────────────────────────────────────
export default function PrintView() {
  const header       = useLoomStore(s => s.header)
  const sections     = useLoomStore(s => s.sections)
  const pricingLayer = useLoomStore(s => s.pricingLayer)

  // ── Recalculate all costs ─────────────────────────────────────────────────
  const rawBase = sections.rawMaterials.rows.reduce((acc, r) => acc + calcRowSubtotal(r), 0)
  const rawMaterials = withAllowance(rawBase, sections.rawMaterials.allowancePct)
  const weaveSurcharge = calcWeaveSurcharge(sections.rawMaterials, header.weaveType)
  const weaveSurchargeTotal = weaveSurcharge.dobby + weaveSurcharge.jacquardPremium +
    (Number(sections.rawMaterials.jacquardSetupCost) || 0)

  const dyeingProcessing = withAllowance(
    sections.dyeingProcessing.rows.reduce((acc, r) => {
      const autoQty =
        r.rateUnit === '₹/m'     ? (Number(header.orderLength) || null) :
        r.rateUnit === '₹/piece' ? (Number(header.orderQty)    || null) : null
      const effectiveRow = (!r.qtyOverride && autoQty !== null)
        ? { ...r, qty: String(autoQty) } : r
      return acc + calcDPRowSubtotal(effectiveRow)
    }, 0),
    sections.dyeingProcessing.allowancePct
  )

  const df = sections.decorationFinishing
  const decoration =
    withAllowance(calcPrintingSubtotal(df.printing, header.orderQty), df.allowancePct) +
    withAllowance(
      calcEmbroiderySubtotal(df.embroidery, header.orderQty) +
      calcOtherDecoSubtotal(df.otherDecoration),
      df.embDecoAllowancePct
    )

  const trimsAccessories = withAllowance(
    calcTrimsSubtotal(sections.trimsAccessories),
    sections.trimsAccessories.allowancePct
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
  const packaging  = Number(pricingLayer.packagingCost) || 0
  const totalCost  = rawMaterials + weaveSurchargeTotal + dyeingProcessing +
    trimsAccessories + decoration + labour + logistics + packaging
  const bufferPct  = Number(pricingLayer.wastageBuffer) || 0
  const netCost    = totalCost * (1 + bufferPct / 100)
  const marginPct  = Number(pricingLayer.profitMargin) || 0
  const sellingPrice = marginPct < 100 ? netCost / (1 - marginPct / 100) : 0
  const qty        = Number(header.orderQty) || 0

  return (
    <div className="pv-root">
      {/* ── Cover header ── */}
      <div className="pv-header">
        <div className="pv-header-brand">
          <span className="pv-header-logo">LoomLedger</span>
          <span className="pv-header-tag">Home Textile Costing Studio</span>
        </div>
        <div className="pv-header-meta">
          <span>{fmtDate(header.date)}</span>
          <span>{header.tradeTerm}</span>
        </div>
      </div>

      {/* ── Costing identity ── */}
      <div className="pv-identity">
        <div className="pv-identity-name">{header.costingName || 'Untitled Costing'}</div>
        <div className="pv-identity-grid">
          {header.articleNo    && <><span>Article / Style</span><span>{header.articleNo}</span></>}
          {header.productType  && <><span>Product Type</span><span>{header.productType}</span></>}
          {header.weaveType    && <><span>Weave</span><span>{header.weaveType}</span></>}
          {header.orderQty     && <><span>Order Qty</span><span>{header.orderQty} pcs</span></>}
          {header.orderLength  && <><span>Order Length</span><span>{header.orderLength} m</span></>}
        </div>
      </div>

      {/* ── Section 1: Raw Materials ── */}
      <PSection title="1 — Raw Materials">
        <PTable
          headers={['#', 'Material', 'Type', 'Role', 'Count', 'Qty/Piece', 'Wastage', 'Price', 'Subtotal']}
          rows={sections.rawMaterials.rows.map((r, i) => {
            const isFabric = r.materialType === 'fabric'
            const isAuto   = !isFabric && r.inputMode === 'auto'
            const computed = isAuto ? getAutoComputed(r) : null
            const subtotal = calcRowSubtotal(r)
            return [
              i + 1,
              r.materialName || '—',
              isFabric ? `Fabric (${r.fabricType || 'Woven'})` : 'Yarn',
              r.role,
              isFabric
                ? `${r.count || '—'} | ${r.gsm || '—'} g/m²`
                : `${r.countValue} ${r.countSystem}${r.ply > 1 ? `/${r.ply}` : ''}`,
              isAuto && computed
                ? `${computed.kgPc.toFixed(4)} kg (auto)`
                : isFabric
                  ? `${r.qty} ${r.qtyUnit}`
                  : `${r.qty} ${r.qtyUnit}`,
              `${r.wastage || 0}%`,
              isFabric ? `${r.priceUnit === '₹/metre' ? '₹/m' : '₹/kg'} ${r.price}` : `₹/kg ${r.price}`,
              inr(subtotal),
            ]
          })}
        />
        {weaveSurchargeTotal > 0 && (
          <PCostRow
            label={`${header.weaveType} Surcharge / Premium`}
            value={inr(weaveSurchargeTotal)}
            accent
          />
        )}
        {sections.rawMaterials.allowancePct > 0 && (
          <PCostRow label={`Production Allowance (${sections.rawMaterials.allowancePct}%)`}
            value={inr(rawBase * Number(sections.rawMaterials.allowancePct) / 100)} indent />
        )}
        <PCostRow label="Raw Materials Total" value={inr(rawMaterials + weaveSurchargeTotal)} bold />
      </PSection>

      {/* ── Section 2: Dyeing & Processing ── */}
      {sections.dyeingProcessing.rows.length > 0 && (
        <PSection title="2 — Dyeing & Processing">
          <PTable
            headers={['#', 'Process', 'Supplier', 'Rate Unit', 'Qty', 'Wastage', 'Rate', 'Subtotal']}
            rows={sections.dyeingProcessing.rows.map((r, i) => {
              const autoQty =
                r.rateUnit === '₹/m'     ? (Number(header.orderLength) || null) :
                r.rateUnit === '₹/piece' ? (Number(header.orderQty)    || null) : null
              const effectiveRow = (!r.qtyOverride && autoQty !== null)
                ? { ...r, qty: String(autoQty) } : r
              return [
                i + 1,
                r.processName || '—',
                r.supplierType,
                r.rateUnit,
                `${effectiveRow.qty}${!r.qtyOverride && autoQty ? ' (auto)' : ''}`,
                `${r.wastage || 0}%`,
                inr(r.rate),
                inr(calcDPRowSubtotal(effectiveRow)),
              ]
            })}
          />
          <PCostRow label="Dyeing & Processing Total" value={inr(dyeingProcessing)} bold />
        </PSection>
      )}

      {/* ── Section 3A: Printing ── */}
      {df.printing.enabled && df.printing.method !== 'None' && (
        <PSection title="3A — Printing">
          <p className="pv-field-row"><strong>Method:</strong> {df.printing.method}</p>
          <PCostRow label="Printing Cost / Piece"
            value={inr(calcPrintingSubtotal(df.printing, header.orderQty))} bold />
        </PSection>
      )}

      {/* ── Section 3B: Embroidery & Other Decoration ── */}
      {(df.embroidery.enabled || df.otherDecoration.enabled) && (
        <PSection title="3B — Embroidery & Other Decoration">
          {df.embroidery.enabled && (
            <>
              <p className="pv-field-row"><strong>Embroidery Mode:</strong> {df.embroidery.mode}</p>
              <PCostRow label="Embroidery Cost / Piece"
                value={inr(calcEmbroiderySubtotal(df.embroidery, header.orderQty))} />
            </>
          )}
          {df.otherDecoration.enabled && df.otherDecoration.rows?.length > 0 && (
            <PTable
              headers={['#', 'Description', 'Cost / Piece']}
              rows={df.otherDecoration.rows.map((r, i) => [i + 1, r.description, inr(r.cost)])}
            />
          )}
          <PCostRow label="Decoration Total" value={inr(decoration)} bold />
        </PSection>
      )}

      {/* ── Section 4: Trims & Accessories ── */}
      {sections.trimsAccessories.rows.length > 0 && (
        <PSection title="4 — Trims & Accessories">
          <PTable
            headers={['#', 'Description', 'Category', 'Qty', 'Unit', 'Price', 'Wastage', 'Subtotal']}
            rows={sections.trimsAccessories.rows.map((r, i) => [
              i + 1,
              r.description || '—',
              r.category,
              r.qty,
              r.unit,
              inr(r.unitPrice),
              `${r.wastage || 0}%`,
              inr(r.qty * (r.unit === 'per dozen' ? 12 : 1) * r.unitPrice * (1 + (r.wastage || 0) / 100)),
            ])}
          />
          <PCostRow label="Trims & Accessories Total" value={inr(trimsAccessories)} bold />
        </PSection>
      )}

      {/* ── Section 5: Labour ── */}
      <PSection title="5 — Labour & Workmanship">
        {sections.labour.mode === 'Flat CMT' ? (
          <PCostRow label="Flat CMT Rate" value={inr(sections.labour.flatRate)} bold />
        ) : (
          <>
            <PTable
              headers={['#', 'Operation', 'Supplier', 'Rate Unit', 'Subtotal']}
              rows={(sections.labour.rows || []).map((r, i) => [
                i + 1,
                r.operationName || '—',
                r.supplierType,
                r.rateUnit,
                inr(calcLabourSubtotal({ mode: 'Operation-level', rows: [r] }, autoMetres, autoPPI)),
              ])}
            />
            <PCostRow label="Labour Total" value={inr(labour)} bold />
          </>
        )}
      </PSection>

      {/* ── Section 6: Logistics ── */}
      {(sections.logistics.rows.length > 0 || sections.logistics.compliance.length > 0) && (
        <PSection title="6 — Logistics & Export">
          {sections.logistics.rows.length > 0 && (
            <PTable
              headers={['#', 'Description', 'Supplier', 'Rate Unit', 'Rate', 'Subtotal']}
              rows={sections.logistics.rows.map((r, i) => [
                i + 1, r.description || '—', r.supplierType, r.rateUnit, inr(r.rate), inr(r.rate),
              ])}
            />
          )}
          {sections.logistics.compliance.length > 0 && (
            <>
              <p className="pv-field-row" style={{ marginTop: 8 }}><strong>Compliance & Testing</strong></p>
              <PTable
                headers={['#', 'Test / Certification', 'Cost', 'Unit', '₹/Piece']}
                rows={sections.logistics.compliance.map((c, i) => [
                  i + 1,
                  c.testName || '—',
                  inr(c.cost),
                  c.costUnit,
                  qty > 0 ? inr(c.cost / qty) : '—',
                ])}
              />
            </>
          )}
          <PCostRow label="Logistics Total" value={inr(logistics)} bold />
        </PSection>
      )}

      {/* ── Cost Summary ── */}
      <PSection title="Cost Summary">
        <div className="pv-summary">
          <PCostRow label="Raw Materials"        value={inr(rawMaterials)} />
          {weaveSurchargeTotal > 0 && (
            <PCostRow label={`${header.weaveType} Surcharge`}
              value={inr(weaveSurchargeTotal)} accent indent />
          )}
          <PCostRow label="Dyeing & Processing"  value={inr(dyeingProcessing)} />
          <PCostRow label="Trims & Accessories"  value={inr(trimsAccessories)} />
          <PCostRow label="Decoration & Finish"  value={inr(decoration)} />
          <PCostRow label="Labour & Workmanship" value={inr(labour)} />
          <PCostRow label="Logistics & Export"   value={inr(logistics)} />
          <PCostRow label="Packaging"            value={inr(packaging)} />
          <div className="pv-divider" />
          <PCostRow label="Total Cost Price"     value={inr(totalCost)} bold />
          {bufferPct > 0 && (
            <PCostRow label={`Wastage Buffer (${bufferPct}%)`}
              value={inr(totalCost * bufferPct / 100)} indent />
          )}
          <PCostRow label="Net Cost Price"       value={inr(netCost)} bold />
          <div className="pv-divider" />
          {pricingLayer.mode === 'Seller' && (
            <>
              <PCostRow label={`Profit Margin (${marginPct}%)`}
                value={inr(sellingPrice - netCost)} indent />
              <PCostRow label="Selling Price"    value={inr(sellingPrice)} bold />
            </>
          )}
          {pricingLayer.mode === 'Buyer' && (
            <>
              <PCostRow label="Target Retail Price"
                value={inr(pricingLayer.targetRetailPrice)} />
              <PCostRow label={`Allowable Cost (at ${pricingLayer.targetMargin}% margin)`}
                value={inr(Number(pricingLayer.targetRetailPrice) * (1 - Number(pricingLayer.targetMargin) / 100))} />
            </>
          )}
          {qty > 0 && (
            <>
              <div className="pv-divider" />
              <PCostRow label={`Total Order Value (× ${qty} pcs)`}
                value={inr(netCost * qty)} bold />
            </>
          )}
          {header.exchangeRate && header.secondaryCurrency && (
            <PCostRow
              label={`Net Cost in ${header.secondaryCurrency}`}
              value={fx(netCost, header.exchangeRate, header.secondaryCurrency) || '—'}
              indent
            />
          )}
        </div>
      </PSection>

      <div className="pv-footer">
        Generated by LoomLedger · {new Date().toLocaleDateString('en-IN', {
          day: 'numeric', month: 'long', year: 'numeric'
        })}
      </div>
    </div>
  )
}
