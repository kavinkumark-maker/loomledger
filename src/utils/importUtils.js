import * as XLSX from 'xlsx'

// ── JSON import ───────────────────────────────────────────────────────────────
export function importFromJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result)
        // Handle both full backup { costings: [...] } and single costing object
        if (data.costings && Array.isArray(data.costings)) {
          resolve({ type: 'backup', costings: data.costings })
        } else if (data.header && data.sections) {
          resolve({ type: 'single', costing: data })
        } else {
          reject(new Error('Unrecognised JSON format'))
        }
      } catch {
        reject(new Error('Invalid JSON file'))
      }
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsText(file)
  })
}

// ── Excel import (best-effort) ────────────────────────────────────────────────
export function importFromExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb   = XLSX.read(e.target.result, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

        const costing = parseExcelRows(rows)
        resolve({ type: 'excel', costing, warnings: costing._warnings || [] })
      } catch (err) {
        reject(new Error('Could not parse Excel file: ' + err.message))
      }
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsArrayBuffer(file)
  })
}

// ── Excel row parser ──────────────────────────────────────────────────────────
function parseExcelRows(rows) {
  const warnings = []
  const genId    = () => `imp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

  // Find a row by its first-cell content
  const findRow  = label => rows.find(r => String(r[0]).toLowerCase().includes(label.toLowerCase()))
  const cellVal  = (row, col) => row ? String(row[col] || '').trim() : ''

  // ── Header fields ─────────────────────────────────────────────────────────
  const costingNameRow  = findRow('Costing Name') || rows[1]
  const articleRow      = findRow('Article')
  const productTypeRow  = findRow('Product Type')
  const weaveRow        = findRow('Weave Type')
  const orderQtyRow     = findRow('Order Qty')
  const orderLengthRow  = findRow('Order Length')
  const dateRow         = findRow('Date')
  const tradeTermRow    = findRow('Trade Term')
  const currencyRow     = findRow('Currency')

  const costingName = cellVal(rows[1], 0) || 'Imported Costing'

  // Parse currency from "INR / USD"
  const currStr   = cellVal(currencyRow, 1)
  const [primary, secondary] = currStr.split('/').map(s => s.trim())

  // ── Section parser helper ─────────────────────────────────────────────────
  // Find all rows between two section markers
  function getSectionRows(startLabel, endLabel) {
    let started = false
    const result = []
    for (const row of rows) {
      const cell = String(row[0] || '')
      if (!started && cell.toLowerCase().includes(startLabel.toLowerCase())) {
        started = true
        continue // skip header row itself
      }
      if (started) {
        if (endLabel && cell.toLowerCase().includes(endLabel.toLowerCase())) break
        if (cell.startsWith('──') && result.length > 0) break
        if (row.some(c => String(c).trim())) result.push(row)
      }
    }
    return result
  }

  // ── Raw Materials ─────────────────────────────────────────────────────────
  const rmDataRows = getSectionRows('1 — RAW MATERIALS', '2 —')
    .filter(r => !String(r[0]).includes('Subtotal') && !String(r[0]).includes('TOTAL') && r[0] !== '')
  
  const rawMaterialRows = rmDataRows.map(r => {
    const isFabric = String(r[2] || '').toLowerCase().includes('fabric')
    if (isFabric) {
      return {
        id: genId(), materialType: 'fabric',
        materialName: cellVal(r, 1), role: cellVal(r, 3),
        composition: cellVal(r, 4), count: cellVal(r, 5),
        gsm: cellVal(r, 6)?.replace(/[^\d.]/g, ''),
        qty: cellVal(r, 7)?.replace(/[^\d.]/g, ''),
        qtyUnit: 'metres', wastage: cellVal(r, 8)?.replace('%','') || '5',
        price: cellVal(r, 9)?.replace(/[^\d.]/g, '') || '',
        priceUnit: '₹/metre', fabricType: 'Woven',
      }
    }
    return {
      id: genId(), materialType: 'yarn',
      materialName: cellVal(r, 1), role: cellVal(r, 3) || 'Warp',
      fibreContent: cellVal(r, 4),
      countValue: cellVal(r, 5)?.replace(/[^\d.]/g, '') || '',
      countSystem: cellVal(r, 5)?.includes('Nm') ? 'Nm' : 'Ne',
      ply: '1', inputMode: 'manual',
      qty: cellVal(r, 7)?.replace(/[^\d.]/g, '') || '',
      qtyUnit: 'kg', wastage: cellVal(r, 8)?.replace('%','') || '5',
      price: cellVal(r, 9)?.replace(/[^\d.]/g, '') || '',
      priceUnit: '₹/kg',
    }
  })

  // ── Dyeing & Processing ───────────────────────────────────────────────────
  const dpDataRows = getSectionRows('2 — DYEING', '3')
    .filter(r => r[0] !== '' && !String(r[0]).includes('TOTAL'))

  const dpRows = dpDataRows.map(r => ({
    id: genId(), processName: cellVal(r, 1),
    supplierType: cellVal(r, 2) || 'Inhouse',
    rateUnit: cellVal(r, 3) || '₹/piece',
    qty: cellVal(r, 4)?.replace(/[^\d.]/g, '') || '',
    qtyOverride: true,
    wastage: cellVal(r, 5)?.replace('%','') || '0',
    rate: cellVal(r, 6)?.replace(/[^\d.]/g, '') || '',
  }))

  // ── Trims ─────────────────────────────────────────────────────────────────
  const taDataRows = getSectionRows('4 — TRIMS', '5 —')
    .filter(r => r[0] !== '' && !String(r[0]).includes('TOTAL'))

  const taRows = taDataRows.map(r => ({
    id: genId(), description: cellVal(r, 1),
    category: cellVal(r, 2) || 'Structural',
    qty: cellVal(r, 3) || '', unit: cellVal(r, 4) || 'per piece',
    unitPrice: cellVal(r, 5)?.replace(/[^\d.]/g, '') || '',
    wastage: cellVal(r, 6)?.replace('%','') || '0',
  }))

  // ── Labour ────────────────────────────────────────────────────────────────
  const labDataRows = getSectionRows('5 — LABOUR', '6 —')
    .filter(r => r[0] !== '' && !String(r[0]).includes('TOTAL'))

  let labourMode = 'Flat CMT'
  let flatRate   = ''
  const labRows  = []

  for (const r of labDataRows) {
    if (String(r[1]).toLowerCase().includes('flat cmt')) {
      labourMode = 'Flat CMT'
      flatRate   = cellVal(r, 1)?.replace(/[^\d.]/g, '') || ''
    } else if (r[0] !== '') {
      labourMode = 'Operation-level'
      labRows.push({
        id: genId(), operationName: cellVal(r, 1),
        supplierType: cellVal(r, 2) || 'Inhouse',
        rateUnit: cellVal(r, 3) || '₹/piece',
        rate: cellVal(r, 5)?.replace(/[^\d.]/g, '') || '',
        manhours: '', timeoffPct: '16', metresPerPiece: '', ppi: '',
      })
    }
  }

  // ── Pricing summary ───────────────────────────────────────────────────────
  const packagingRow    = findRow('Packaging')
  const wastageRow      = findRow('Wastage Buffer')
  const marginRow       = findRow('Profit Margin')
  const sellingPriceRow = findRow('SELLING PRICE')

  warnings.push('Excel import: AUTO mode, Dobby/Jacquard settings, and section allowances could not be restored — please review and adjust.')

  return {
    id: null,
    name: costingName,
    savedAt: new Date().toISOString(),
    _warnings: warnings,
    header: {
      costingName,
      articleNo:         cellVal(articleRow, 1),
      productType:       cellVal(productTypeRow, 1) || 'Bedsheet',
      productTypeCustom: '',
      weaveType:         cellVal(weaveRow, 1) || 'Plain / Twill / Satin',
      orderQty:          cellVal(orderQtyRow, 1)?.replace(/[^\d.]/g, '') || '',
      orderLength:       cellVal(orderLengthRow, 1)?.replace(/[^\d.]/g, '') || '',
      date:              new Date().toISOString().split('T')[0],
      tradeTerm:         cellVal(tradeTermRow, 1) || 'Domestic',
      primaryCurrency:   primary || 'INR',
      secondaryCurrency: secondary || 'USD',
      exchangeRate: '', rateStatus: 'idle',
    },
    sections: {
      productDimensions: { fabricWidth: '', fabricWidthUnit: 'inches', selvedgePerSide: '1', selvedgeUnit: 'inches', panels: [], allowancePct: '' },
      rawMaterials: { rows: rawMaterialRows, allowancePct: '', dobbySurcharge: 10, jacquardPremium: 35, jacquardSetupCost: 0 },
      dyeingProcessing: { rows: dpRows, allowancePct: '' },
      trimsAccessories: { rows: taRows, allowancePct: '' },
      decorationFinishing: { allowancePct: '', embDecoAllowancePct: '', printing: { enabled: false, method: 'None', data: {} }, embroidery: { enabled: false, mode: 'Standard Placements', placements: [], digitisingCharge: 0, continuous: { embLength: 0, stitchDensity: 0, machineRate: 0, backing: 0, digitisingCharge: 0 } }, otherDecoration: { enabled: false, rows: [] } },
      labour: { mode: labourMode, flatRate, rows: labRows, allowancePct: '' },
      logistics: { rows: [], compliance: [], allowancePct: '' },
    },
    pricingLayer: {
      packagingCost:      cellVal(packagingRow, 2)?.replace(/[^\d.]/g, '') || '',
      wastageBuffer:      cellVal(wastageRow, 2)?.replace(/[^\d.%]/g, '').replace(/%.*/, '') || '',
      mode:               marginRow ? 'Seller' : 'Buyer',
      profitMargin:       cellVal(marginRow, 2)?.replace(/[^\d.]/g, '') || '20',
      targetRetailPrice:  '',
      targetMargin:       '40',
    },
  }
}
