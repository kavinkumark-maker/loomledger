import * as XLSX from 'xlsx'
import { calcRowSubtotal, calcWeaveSurcharge, getAutoComputed, getAggregatePPI } from '../components/RawMaterials'
import { calcDPRowSubtotal } from '../components/DyeingProcessing'
import { calcPrintingSubtotal } from '../components/Printing'
import { calcEmbroiderySubtotal } from '../components/Embroidery'
import { calcOtherDecoSubtotal } from '../components/OtherDecoration'
import { calcTrimsSubtotal, calcTrimRowSubtotal } from '../components/TrimsAccessories'
import { calcLabourSubtotal, calcLabourRowSubtotal } from '../components/Labour'
import { calcLogisticsSubtotal } from '../components/Logistics'
import { withAllowance } from '../ui/SectionFooter'

const num  = v => Number(v) || 0
const pct  = v => `${v || 0}%`
const rupee = v => `Rs.${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ── Recalculate all costs ─────────────────────────────────────────────────────
function calcAllCosts(header, sections, pricingLayer) {
  const autoMetres = num(header.orderLength) || null
  const autoPPI    = getAggregatePPI(sections.rawMaterials.rows)
  const rawBase    = sections.rawMaterials.rows.reduce((acc, r) => acc + calcRowSubtotal(r), 0)
  const rawMaterials = withAllowance(rawBase, sections.rawMaterials.allowancePct)
  const weaveSurcharge = calcWeaveSurcharge(sections.rawMaterials, header.weaveType)
  const weaveSurchargeTotal = weaveSurcharge.dobby + weaveSurcharge.jacquardPremium + num(sections.rawMaterials.jacquardSetupCost)

  const dyeingProcessing = withAllowance(
    sections.dyeingProcessing.rows.reduce((acc, r) => {
      const autoQty = r.rateUnit === '₹/m' ? (num(header.orderLength) || null) :
        r.rateUnit === '₹/piece' ? (num(header.orderQty) || null) : null
      const er = (!r.qtyOverride && autoQty !== null) ? { ...r, qty: String(autoQty) } : r
      return acc + calcDPRowSubtotal(er)
    }, 0), sections.dyeingProcessing.allowancePct)

  const df = sections.decorationFinishing
  const printing   = calcPrintingSubtotal(df.printing, header.orderQty)
  const embroidery = calcEmbroiderySubtotal(df.embroidery, header.orderQty)
  const otherDeco  = calcOtherDecoSubtotal(df.otherDecoration)
  const decoration = withAllowance(printing, df.allowancePct) +
    withAllowance(embroidery + otherDeco, df.embDecoAllowancePct)

  const trimsAccessories = withAllowance(calcTrimsSubtotal(sections.trimsAccessories), sections.trimsAccessories.allowancePct)
  const labour    = withAllowance(calcLabourSubtotal(sections.labour, autoMetres, autoPPI), sections.labour.allowancePct)
  const logistics = withAllowance(calcLogisticsSubtotal(sections.logistics, header.orderQty), sections.logistics.allowancePct)
  const packaging  = num(pricingLayer.packagingCost)
  const totalCost  = rawMaterials + weaveSurchargeTotal + dyeingProcessing + trimsAccessories + decoration + labour + logistics + packaging
  const bufferPct  = num(pricingLayer.wastageBuffer)
  const netCost    = totalCost * (1 + bufferPct / 100)
  const marginPct  = num(pricingLayer.profitMargin)
  const sellingPrice = marginPct < 100 ? netCost / (1 - marginPct / 100) : 0
  const qty = num(header.orderQty)

  return { rawBase, rawMaterials, weaveSurchargeTotal, weaveSurcharge, dyeingProcessing,
    decoration, printing, embroidery, otherDeco, trimsAccessories, labour, logistics,
    packaging, totalCost, netCost, sellingPrice, qty, autoMetres, autoPPI, df, bufferPct, marginPct }
}

// ── Excel export ──────────────────────────────────────────────────────────────
export function exportToExcel(header, sections, pricingLayer) {
  const c = calcAllCosts(header, sections, pricingLayer)
  const rows = []
  const push  = row => rows.push(row)
  const blank = ()  => rows.push([''])
  const sec   = label => rows.push([`── ${label}`])

  // Title
  push(['LoomLedger — Home Textile Costing Sheet'])
  push([header.costingName || 'Untitled Costing'])
  blank()
  push(['Article / Style', header.articleNo || '—', '', 'Product Type', header.productType || '—'])
  push(['Weave Type',      header.weaveType  || '—', '', 'Trade Term',   header.tradeTerm  || '—'])
  push(['Order Qty (pcs)', header.orderQty   || '—', '', 'Order Length (m)', header.orderLength || '—'])
  push(['Date',            header.date       || '—', '', 'Currency', `INR / ${header.secondaryCurrency || 'USD'}`])
  blank()

  // Section 1
  sec('1 — RAW MATERIALS')
  push(['#', 'Material Name', 'Type', 'Role', 'Fibre / Composition', 'Count', 'GSM', 'Qty/Piece', 'Wastage %', 'Price', 'Subtotal (Rs.)'])
  sections.rawMaterials.rows.forEach((r, i) => {
    const isFabric = r.materialType === 'fabric'
    const isAuto   = !isFabric && r.inputMode === 'auto'
    const computed = isAuto ? getAutoComputed(r) : null
    push([
      i + 1, r.materialName || '—',
      isFabric ? `Fabric (${r.fabricType})` : 'Yarn',
      r.role,
      isFabric ? (r.composition || '—') : (r.fibreContent || '—'),
      isFabric ? (r.count || '—') : `${r.countValue} ${r.countSystem}${num(r.ply) > 1 ? `/${r.ply}` : ''}`,
      isFabric ? (r.gsm ? `${r.gsm} g/m2` : '—') : (computed ? `${computed.gsm.toFixed(1)} g/m2` : '—'),
      isAuto && computed ? `${computed.kgPc.toFixed(4)} kg` : `${r.qty} ${r.qtyUnit}`,
      pct(r.wastage),
      isFabric ? `${r.price} (${r.priceUnit})` : `Rs.${r.price}/kg`,
      calcRowSubtotal(r),
    ])
  })
  push(['', '', '', '', '', '', '', '', '', 'Raw Materials Subtotal', c.rawBase])
  if (c.weaveSurchargeTotal > 0) push(['', '', '', '', '', '', '', '', '', `${header.weaveType} Surcharge`, c.weaveSurchargeTotal])
  if (sections.rawMaterials.allowancePct) push(['', '', '', '', '', '', '', '', '', `Production Allowance (${sections.rawMaterials.allowancePct}%)`, c.rawMaterials - c.rawBase])
  push(['', '', '', '', '', '', '', '', '', 'TOTAL RAW MATERIALS', c.rawMaterials + c.weaveSurchargeTotal])
  blank()

  // Section 2
  if (sections.dyeingProcessing.rows.length > 0) {
    sec('2 — DYEING & PROCESSING')
    push(['#', 'Process', 'Supplier', 'Rate Unit', 'Qty', 'Wastage %', 'Rate (Rs.)', 'Subtotal (Rs.)'])
    sections.dyeingProcessing.rows.forEach((r, i) => {
      const autoQty = r.rateUnit === '₹/m' ? (num(header.orderLength) || null) :
        r.rateUnit === '₹/piece' ? (num(header.orderQty) || null) : null
      const er = (!r.qtyOverride && autoQty !== null) ? { ...r, qty: String(autoQty) } : r
      push([i + 1, r.processName || '—', r.supplierType, r.rateUnit,
        `${er.qty}${!r.qtyOverride && autoQty ? ' (auto)' : ''}`,
        pct(r.wastage), num(r.rate), calcDPRowSubtotal(er)])
    })
    push(['', '', '', '', '', '', 'TOTAL DYEING & PROCESSING', c.dyeingProcessing])
    blank()
  }

  // Section 3A
  if (c.df.printing.enabled && c.df.printing.method !== 'None') {
    sec('3A — PRINTING')
    push(['Method', c.df.printing.method])
    push(['Cost / Piece (Rs.)', c.printing])
    blank()
  }

  // Section 3B
  if (c.df.embroidery.enabled || c.df.otherDecoration.enabled) {
    sec('3B — EMBROIDERY & OTHER DECORATION')
    if (c.df.embroidery.enabled) {
      push(['Embroidery Mode', c.df.embroidery.mode])
      push(['Cost / Piece (Rs.)', c.embroidery])
    }
    if (c.df.otherDecoration.enabled && c.df.otherDecoration.rows?.length > 0) {
      push(['#', 'Description', 'Cost / Piece (Rs.)'])
      c.df.otherDecoration.rows.forEach((r, i) => push([i + 1, r.description, num(r.cost)]))
    }
    push(['', 'TOTAL DECORATION', c.decoration])
    blank()
  }

  // Section 4
  if (sections.trimsAccessories.rows.length > 0) {
    sec('4 — TRIMS & ACCESSORIES')
    push(['#', 'Description', 'Category', 'Qty/Piece', 'Unit', 'Unit Price (Rs.)', 'Wastage %', 'Subtotal (Rs.)'])
    sections.trimsAccessories.rows.forEach((r, i) =>
      push([i + 1, r.description || '—', r.category, r.qty, r.unit, num(r.unitPrice), pct(r.wastage), calcTrimRowSubtotal(r)]))
    push(['', '', '', '', '', '', 'TOTAL TRIMS & ACCESSORIES', c.trimsAccessories])
    blank()
  }

  // Section 5
  sec('5 — LABOUR & WORKMANSHIP')
  if (sections.labour.mode === 'Flat CMT') {
    push(['Mode', 'Flat CMT'])
    push(['CMT Rate (Rs./piece)', num(sections.labour.flatRate)])
  } else {
    push(['#', 'Operation', 'Supplier', 'Rate Unit', 'Details', 'Subtotal (Rs.)'])
    ;(sections.labour.rows || []).forEach((r, i) => {
      let details = ''
      if (r.rateUnit === '₹/hr')    details = `${r.manhours}hr x (1+${r.timeoffPct}%) x Rs.${r.rate}`
      if (r.rateUnit === '₹/m')     details = `${c.autoMetres || r.metresPerPiece}m x Rs.${r.rate}`
      if (r.rateUnit === '₹/pick')  details = `Rs.${r.rate} x ${c.autoPPI || r.ppi}ppi x ${c.autoMetres || r.metresPerPiece}m`
      if (r.rateUnit === '₹/piece') details = `Rs.${r.rate}/piece`
      push([i + 1, r.operationName || '—', r.supplierType, r.rateUnit, details,
        calcLabourRowSubtotal(r, c.autoMetres, c.autoPPI)])
    })
  }
  push(['', '', '', '', 'TOTAL LABOUR', c.labour])
  blank()

  // Section 6
  if (sections.logistics.rows.length > 0 || sections.logistics.compliance.length > 0) {
    sec('6 — LOGISTICS & EXPORT')
    if (sections.logistics.rows.length > 0) {
      push(['#', 'Description', 'Supplier', 'Rate Unit', 'Rate (Rs.)', 'Subtotal (Rs.)'])
      sections.logistics.rows.forEach((r, i) =>
        push([i + 1, r.description || '—', r.supplierType, r.rateUnit, num(r.rate), num(r.rate)]))
    }
    if (sections.logistics.compliance.length > 0) {
      push([''])
      push(['#', 'Test / Certification', 'Cost (Rs.)', 'Unit', 'Rs./Piece (amortised)'])
      sections.logistics.compliance.forEach((comp, i) =>
        push([i + 1, comp.testName || '—', num(comp.cost), comp.costUnit,
          c.qty > 0 ? (num(comp.cost) / c.qty).toFixed(2) : '—']))
    }
    push(['', '', '', '', 'TOTAL LOGISTICS', c.logistics])
    blank()
  }

  // Summary
  sec('COST SUMMARY')
  push(['Raw Materials',             '', c.rawMaterials])
  if (c.weaveSurchargeTotal > 0) push([`${header.weaveType} Surcharge`, '', c.weaveSurchargeTotal])
  push(['Dyeing & Processing',       '', c.dyeingProcessing])
  push(['Trims & Accessories',       '', c.trimsAccessories])
  push(['Decoration & Finish',       '', c.decoration])
  push(['Labour & Workmanship',      '', c.labour])
  push(['Logistics & Export',        '', c.logistics])
  push(['Packaging',                 '', c.packaging])
  push(['Total Cost Price',          '', c.totalCost])
  if (c.bufferPct > 0) push([`Wastage Buffer (${c.bufferPct}%)`, '', c.totalCost * c.bufferPct / 100])
  push(['NET COST PRICE',            '', c.netCost])
  if (pricingLayer.mode === 'Seller') {
    push([`Profit Margin (${c.marginPct}%)`, '', c.sellingPrice - c.netCost])
    push(['SELLING PRICE',           '', c.sellingPrice])
  }
  if (pricingLayer.mode === 'Buyer') {
    push(['Target Retail Price',     '', num(pricingLayer.targetRetailPrice)])
    push([`Allowable Cost (${pricingLayer.targetMargin}% margin)`, '',
      num(pricingLayer.targetRetailPrice) * (1 - num(pricingLayer.targetMargin) / 100)])
  }
  if (c.qty > 0) {
    push(['Cost / Piece',             '', c.netCost])
    push([`Total Order Value (x${c.qty} pcs)`, '', c.netCost * c.qty])
  }
  if (header.exchangeRate && header.secondaryCurrency) {
    push([`Net Cost in ${header.secondaryCurrency}`, '',
      (c.netCost * num(header.exchangeRate)).toFixed(2) + ' ' + header.secondaryCurrency])
  }

  // Write file
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 4 }, { wch: 32 }, { wch: 16 }, { wch: 16 },
    { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
    { wch: 10 }, { wch: 28 }, { wch: 18 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Costing Sheet')
  const filename = `LoomLedger_${(header.costingName || 'Costing').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
  XLSX.writeFile(wb, filename)
  return filename
}

// ── Share text builder ────────────────────────────────────────────────────────
export function buildShareText(header, sections, pricingLayer) {
  const c = calcAllCosts(header, sections, pricingLayer)
  const lines = [
    `*LoomLedger Costing Sheet*`,
    `${header.costingName || 'Untitled Costing'}`,
    ``,
    `Product: ${header.productType || '—'} | Weave: ${header.weaveType || '—'}`,
    `Article: ${header.articleNo || '—'} | Date: ${header.date || '—'}`,
    `Order: ${c.qty || '—'} pcs | Term: ${header.tradeTerm || '—'}`,
    ``,
    `*Cost Breakdown (per piece)*`,
    `Raw Materials:        ${rupee(c.rawMaterials + c.weaveSurchargeTotal)}`,
    `Dyeing & Processing:  ${rupee(c.dyeingProcessing)}`,
    `Decoration:           ${rupee(c.decoration)}`,
    `Trims & Accessories:  ${rupee(c.trimsAccessories)}`,
    `Labour:               ${rupee(c.labour)}`,
    `Logistics:            ${rupee(c.logistics)}`,
    `Packaging:            ${rupee(c.packaging)}`,
    `──────────────────────────`,
    `Net Cost Price:       ${rupee(c.netCost)}`,
    pricingLayer.mode === 'Seller' ? `Selling Price:        ${rupee(c.sellingPrice)}` : null,
    c.qty > 0 ? `Total Order Value:    ${rupee(c.netCost * c.qty)}` : null,
    header.exchangeRate && header.secondaryCurrency
      ? `In ${header.secondaryCurrency}:               ${header.secondaryCurrency} ${(c.netCost * num(header.exchangeRate)).toFixed(2)}`
      : null,
    ``,
    `_Generated by LoomLedger_`,
  ].filter(l => l !== null).join('\n')
  return lines
}
