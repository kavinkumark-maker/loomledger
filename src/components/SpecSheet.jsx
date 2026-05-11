import React from 'react'
import useLoomStore from '../store/useLoomStore'
import { calcPanelConsumption } from './ProductDimensions'
import { getCurrencySymbol } from '../utils/currency'

const fmtNum = (n, dp = 2) => (Number(n) || 0).toFixed(dp)
const fmtDate = iso => {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ── SVG panel diagram ─────────────────────────────────────────────────────────
function PanelDiagram({ panel, usableWidthCm }) {
  const fl = Number(panel.finishedLength) || 0
  const fw = Number(panel.finishedWidth)  || 0
  if (!fl || !fw) return null

  const toCm = (v, u) => u === 'inches' ? v * 2.54 : v
  const flCm = toCm(fl, panel.dimUnit)
  const fwCm = toCm(fw, panel.dimUnit)

  const aAll    = Number(panel.allowanceAll) || 0
  const cutL    = flCm + (panel.allowanceMode === 'all' ? aAll * 2 : (Number(panel.allowanceTop) + Number(panel.allowanceBottom)))
  const cutW    = fwCm + (panel.allowanceMode === 'all' ? aAll * 2 : (Number(panel.allowanceLeft) + Number(panel.allowanceRight)))

  // SVG dimensions — scale to fit 240×180 viewbox
  const scale  = Math.min(200 / cutL, 160 / cutW, 3)
  const svgW   = cutW * scale
  const svgH   = cutL * scale
  const finW   = fwCm * scale
  const finH   = flCm * scale
  const padX   = (svgW - finW) / 2
  const padY   = (svgH - finH) / 2

  return (
    <svg viewBox={`-20 -20 ${svgW + 40} ${svgH + 40}`} className="spec-diagram"
      width={svgW + 40} height={svgH + 40}>
      {/* Cut size box (dashed) */}
      <rect x="0" y="0" width={svgW} height={svgH}
        fill="#FAF7F4" stroke="#B86040" strokeWidth="1" strokeDasharray="4 3" rx="2" />
      {/* Finished size box */}
      <rect x={padX} y={padY} width={finW} height={finH}
        fill="rgba(184,96,64,0.08)" stroke="#B86040" strokeWidth="1.5" rx="1" />
      {/* Labels */}
      <text x={svgW / 2} y={svgH + 14} textAnchor="middle" fontSize="9" fill="#9B8270">
        Cut: {fmtNum(cutW, 1)} cm
      </text>
      <text x={-14} y={svgH / 2} textAnchor="middle" fontSize="9" fill="#9B8270"
        transform={`rotate(-90, -14, ${svgH / 2})`}>
        Cut: {fmtNum(cutL, 1)} cm
      </text>
      <text x={svgW / 2} y={padY + finH / 2 + 4} textAnchor="middle" fontSize="9" fill="#B86040" fontWeight="600">
        {fmtNum(fwCm, 1)} × {fmtNum(flCm, 1)} cm
      </text>
    </svg>
  )
}

// ── Main SpecSheet ────────────────────────────────────────────────────────────
export default function SpecSheet() {
  const header  = useLoomStore(s => s.header)
  const pd      = useLoomStore(s => s.sections.productDimensions) || { fabricWidth: '', fabricWidthUnit: 'inches', selvedgePerSide: '1', selvedgeUnit: 'inches', panels: [] }
  const rmRows  = useLoomStore(s => s.sections.rawMaterials.rows)

  const fabricRows     = rmRows.filter(r => r.materialType === 'fabric')
  const fillingRows    = rmRows.filter(r => r.materialType === 'filling')
  const innerCoverRows = rmRows.filter(r => r.materialType === 'inner-cover')
  const toCm           = (v, u) => u === 'inches' ? Number(v) * 2.54 : Number(v)
  const fabricWidthCm  = toCm(pd.fabricWidth || 0, pd.fabricWidthUnit)
  const selvedgeCm     = toCm(pd.selvedgePerSide || 0, pd.selvedgeUnit)
  const usableWidthCm  = fabricWidthCm - selvedgeCm * 2
  const panels         = pd.panels || []

  const productName = header.productType === 'Other'
    ? (header.productTypeCustom || 'Custom Product')
    : header.productType

  const currencySymbol = getCurrencySymbol(header.primaryCurrency || 'INR')

  // ── Product weight estimate ─────────────────────────────────────────────────
  const fabricWeightG = panels.reduce((acc, panel) => {
    const linkedFabric = fabricRows.find(r => r.id === panel.linkedFabricId)
    if (!linkedFabric?.gsm) return acc
    const gsm  = Number(linkedFabric.gsm) || 0
    const calc = calcPanelConsumption(panel, fabricWidthCm, selvedgeCm)
    const areaM2 = (calc.cutLength / 100) * (calc.cutWidth / 100)
    return acc + gsm * areaM2
  }, 0)

  const fillingWeightG = fillingRows.reduce((acc, r) => acc + (Number(r.weightPerPiece) || 0), 0)
  const totalWeightG   = fabricWeightG + fillingWeightG
  const totalWeightKg  = totalWeightG / 1000

  return (
    <div className="spec-root">
      {/* Header */}
      <div className="spec-header">
        <div className="spec-header-left">
          <div className="spec-brand">LoomLedger</div>
          <div className="spec-doc-title">Product Specification Sheet</div>
        </div>
        <div className="spec-header-right">
          <div className="spec-meta-row"><span>Date</span><span>{fmtDate(header.date)}</span></div>
          <div className="spec-meta-row"><span>Article</span><span>{header.articleNo || '—'}</span></div>
          <div className="spec-meta-row"><span>Trade Term</span><span>{header.tradeTerm}</span></div>
        </div>
      </div>

      {/* Product identity */}
      <div className="spec-identity">
        <div className="spec-product-name">{header.costingName || productName}</div>
        <div className="spec-product-sub">
          {productName}
          {header.weaveType && ` · ${header.weaveType}`}
          {header.orderQty  && ` · Order: ${header.orderQty} pcs`}
        </div>
      </div>

      {/* Fabric Roll */}
      {fabricWidthCm > 0 && (
        <div className="spec-section">
          <div className="spec-section-title">Fabric Roll</div>
          <div className="spec-kv-grid">
            <div className="spec-kv"><span>Roll Width</span><span>{pd.fabricWidth} {pd.fabricWidthUnit} ({fmtNum(fabricWidthCm, 1)} cm)</span></div>
            <div className="spec-kv"><span>Selvedge / Side</span><span>{pd.selvedgePerSide} {pd.selvedgeUnit} ({fmtNum(selvedgeCm, 1)} cm)</span></div>
            <div className="spec-kv spec-kv--accent"><span>Usable Width</span><span>{fmtNum(usableWidthCm, 1)} cm · {fmtNum(usableWidthCm / 2.54, 2)} in</span></div>
          </div>
        </div>
      )}

      {/* Panels */}
      {panels.length > 0 && (
        <div className="spec-section">
          <div className="spec-section-title">Panel Specifications</div>
          {panels.map((panel, i) => {
            const calc = calcPanelConsumption(panel, fabricWidthCm, selvedgeCm)
            const linkedFabric = fabricRows.find(r => r.id === panel.linkedFabricId)
            const consumption = panel.consumptionOverride
              ? Number(panel.consumptionManual) || 0
              : calc.adjustedPerPiece
            const fabricCost = consumption * (Number(linkedFabric?.price) || 0)

            return (
              <div key={panel.id} className="spec-panel">
                <div className="spec-panel-header">
                  <div className="spec-panel-letter">{String.fromCharCode(65 + i)}</div>
                  <div className="spec-panel-name">{panel.name || `Panel ${String.fromCharCode(65 + i)}`}</div>
                  {linkedFabric && (
                    <div className="spec-panel-fabric">
                      {linkedFabric.materialName || 'Unnamed'}
                      {linkedFabric.composition ? ` · ${linkedFabric.composition}` : ''}
                      {linkedFabric.gsm ? ` · ${linkedFabric.gsm} g/m²` : ''}
                    </div>
                  )}
                </div>

                <div className="spec-panel-body">
                  {/* Diagram */}
                  <div className="spec-panel-diagram">
                    <PanelDiagram panel={panel} usableWidthCm={usableWidthCm} />
                  </div>

                  {/* Specs */}
                  <div className="spec-panel-specs">
                    <div className="spec-kv-grid">
                      <div className="spec-kv">
                        <span>Finished Size</span>
                        <span>{panel.finishedLength} × {panel.finishedWidth} {panel.dimUnit}</span>
                      </div>
                      <div className="spec-kv">
                        <span>Cut Size</span>
                        <span>{fmtNum(calc.cutLength, 1)} × {fmtNum(calc.cutWidth, 1)} cm</span>
                      </div>
                      <div className="spec-kv">
                        <span>Allowance Mode</span>
                        <span>
                          {panel.allowanceMode === 'all'
                            ? `${panel.allowanceAll} cm all sides`
                            : `T${panel.allowanceTop} B${panel.allowanceBottom} L${panel.allowanceLeft} R${panel.allowanceRight} cm`}
                        </span>
                      </div>
                      <div className="spec-kv">
                        <span>Panels per Row</span>
                        <span>{calc.panelsPerRow || '—'}</span>
                      </div>
                      <div className="spec-kv">
                        <span>Marker Efficiency</span>
                        <span>{panel.markerEfficiency}%</span>
                      </div>
                      <div className="spec-kv">
                        <span>Cutting Wastage</span>
                        <span>{panel.wastage}%</span>
                      </div>
                      <div className="spec-kv spec-kv--accent">
                        <span>Fabric Consumption</span>
                        <span>{fmtNum(consumption, 4)} m / piece</span>
                      </div>
                      {linkedFabric?.price && (
                        <div className="spec-kv spec-kv--accent">
                          <span>Fabric Cost / Piece</span>
                          <span>{currencySymbol}{fmtNum(fabricCost, 2)}</span>
                        </div>
                      )}
                    </div>

                    {/* Linked fabric details */}
                    {linkedFabric && (
                      <div className="spec-fabric-detail">
                        <span className="spec-fabric-label">Fabric</span>
                        <span>{linkedFabric.composition || '—'}</span>
                        {linkedFabric.count && <span>Count: {linkedFabric.count}</span>}
                        {linkedFabric.gsm   && <span>GSM: {linkedFabric.gsm} g/m²</span>}
                        {linkedFabric.width && <span>Width: {linkedFabric.width} {linkedFabric.widthUnit}</span>}
                        {linkedFabric.price && <span>Price: {currencySymbol}{linkedFabric.price}/{linkedFabric.priceUnit === '₹/metre' ? 'm' : 'kg'}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Summary */}
      {panels.length > 0 && (
        <div className="spec-section spec-summary">
          <div className="spec-section-title">Consumption Summary</div>
          <table className="spec-table">
            <thead>
              <tr>
                <th>Panel</th>
                <th>Fabric</th>
                <th>Composition</th>
                <th>GSM</th>
                <th>Consumption (m/pc)</th>
                <th>Price/{currencySymbol}m</th>
                <th>Cost/pc ({currencySymbol})</th>
              </tr>
            </thead>
            <tbody>
              {panels.map((panel, i) => {
                const calc = calcPanelConsumption(panel, fabricWidthCm, selvedgeCm)
                const consumption = panel.consumptionOverride
                  ? Number(panel.consumptionManual) || 0
                  : calc.adjustedPerPiece
                const linkedFabric = fabricRows.find(r => r.id === panel.linkedFabricId)
                const price = Number(linkedFabric?.price) || 0
                return (
                  <tr key={panel.id}>
                    <td>{panel.name || String.fromCharCode(65 + i)}</td>
                    <td>{linkedFabric?.materialName || '—'}</td>
                    <td>{linkedFabric?.composition || '—'}</td>
                    <td>{linkedFabric?.gsm ? `${linkedFabric.gsm} g/m²` : '—'}</td>
                    <td>{fmtNum(consumption, 4)}</td>
                    <td>{price || '—'}</td>
                    <td>{price ? fmtNum(consumption * price, 2) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Filling detail */}
      {fillingRows.length > 0 && (
        <div className="spec-section">
          <div className="spec-section-title">Filling</div>
          {fillingRows.map((r, i) => (
            <div key={r.id} className="spec-kv-grid" style={{ marginBottom: i < fillingRows.length - 1 ? 10 : 0 }}>
              <div className="spec-kv"><span>Type</span><span>{r.fillingType || '—'}</span></div>
              {r.materialName && <div className="spec-kv"><span>Material</span><span>{r.materialName}</span></div>}
              {r.weightPerPiece && <div className="spec-kv spec-kv--accent"><span>Weight / Piece</span><span>{r.weightPerPiece} g</span></div>}
              {r.supplier && <div className="spec-kv"><span>Supplier</span><span>{r.supplier}</span></div>}
            </div>
          ))}
        </div>
      )}

      {/* Inner cover detail */}
      {innerCoverRows.length > 0 && (
        <div className="spec-section">
          <div className="spec-section-title">Inner Cover</div>
          {innerCoverRows.map((r, i) => (
            <div key={r.id} className="spec-kv-grid" style={{ marginBottom: i < innerCoverRows.length - 1 ? 10 : 0 }}>
              {r.composition && <div className="spec-kv"><span>Composition</span><span>{r.composition}</span></div>}
              <div className="spec-kv"><span>Structure</span><span>{r.structure || 'Non-woven'}</span></div>
              {r.gsm && <div className="spec-kv"><span>Weight</span><span>{r.gsm} g/m²</span></div>}
              {r.qty && <div className="spec-kv spec-kv--accent"><span>Qty / Piece</span><span>{r.qty} m</span></div>}
              {r.supplier && <div className="spec-kv"><span>Supplier</span><span>{r.supplier}</span></div>}
            </div>
          ))}
        </div>
      )}

      {/* Product weight */}
      {(totalWeightG > 0 || fillingWeightG > 0) && (
        <div className="spec-section">
          <div className="spec-section-title">Product Weight Estimate</div>
          <div className="spec-kv-grid">
            {fabricWeightG > 0 && (
              <div className="spec-kv"><span>Fabric Weight</span><span>{fmtNum(fabricWeightG, 1)} g</span></div>
            )}
            {fillingWeightG > 0 && (
              <div className="spec-kv"><span>Filling Weight</span><span>{fmtNum(fillingWeightG, 1)} g</span></div>
            )}
            <div className="spec-kv spec-kv--accent">
              <span>Total Weight / Piece</span>
              <span>{fmtNum(totalWeightG, 1)} g ({fmtNum(totalWeightKg, 4)} kg)</span>
            </div>
          </div>
          <p className="spec-hint">Fabric weight estimated from GSM × cut area. Add trim weight manually if needed.</p>
        </div>
      )}

      <div className="spec-footer">
        Generated by LoomLedger · {new Date().toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric'
        })}
      </div>
    </div>
  )
}
