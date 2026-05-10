// ── Standard industry fabric widths (inches) ──────────────────────────────────
export const STANDARD_WIDTHS_INCHES = [36, 44, 45, 54, 58, 60, 72, 90, 108, 118]

// ── Unit helpers ──────────────────────────────────────────────────────────────
const toCm = (v, unit) => unit === 'inches' ? Number(v) * 2.54 : Number(v)

// ── Apply shrinkage to a dimension ────────────────────────────────────────────
// shrinkagePct: e.g. 3 means add 3% to cut size to account for shrinkage
function withShrinkage(dim, shrinkagePct) {
  return dim * (1 + (Number(shrinkagePct) || 0) / 100)
}

// ── Get effective cut size for a panel after shrinkage ────────────────────────
export function getEffectiveCutSize(panel, globalShrinkage, panelShrinkageOverrides) {
  const dimUnit = panel.dimUnit || 'cm'
  const flCm = toCm(Number(panel.finishedLength) || 0, dimUnit)
  const fwCm = toCm(Number(panel.finishedWidth)  || 0, dimUnit)

  // Stitching allowances
  const aTop    = Number(panel.allowanceMode === 'all' ? panel.allowanceAll : panel.allowanceTop)    || 0
  const aBottom = Number(panel.allowanceMode === 'all' ? panel.allowanceAll : panel.allowanceBottom) || 0
  const aLeft   = Number(panel.allowanceMode === 'all' ? panel.allowanceAll : panel.allowanceLeft)   || 0
  const aRight  = Number(panel.allowanceMode === 'all' ? panel.allowanceAll : panel.allowanceRight)  || 0

  const cutLength = flCm + aTop + aBottom
  const cutWidth  = fwCm + aLeft + aRight

  // Shrinkage — per panel overrides global if set
  const override    = panelShrinkageOverrides?.[panel.id]
  const warpPct     = override?.enabled  ? Number(override.warp)  : Number(globalShrinkage.warp)  || 0
  const weftPct     = override?.enabled  ? Number(override.weft)  : Number(globalShrinkage.weft)  || 0

  return {
    cutLength,                                   // before shrinkage
    cutWidth,
    effLength: withShrinkage(cutLength, warpPct), // after shrinkage (warp = length direction)
    effWidth:  withShrinkage(cutWidth, weftPct),  // after shrinkage (weft = width direction)
  }
}

// ── Try a specific rotation for a panel ───────────────────────────────────────
// Returns {length, width} in cm considering optional 90° rotation
function panelDims(effLength, effWidth, rotated) {
  return rotated
    ? { length: effWidth, width: effLength }
    : { length: effLength, width: effWidth }
}

// ── Calculate layout for one fabric width ────────────────────────────────────
export function calcLayout({
  panels,
  fabricWidthCm,
  selvedgeCm,
  globalShrinkage,
  panelShrinkageOverrides,
  rowMode,           // 'separate' | 'mixed'
  rotations,         // { [panelId]: 'off' | 'on' | 'auto' }
  orderQty,
  markerEfficiency,  // global fallback %
}) {
  const usableWidth = fabricWidthCm - selvedgeCm * 2
  if (usableWidth <= 0 || !panels.length) return null

  const qty = Number(orderQty) || 1

  // Build effective cut sizes
  const panelData = panels.map(p => {
    const { effLength, effWidth } = getEffectiveCutSize(p, globalShrinkage, panelShrinkageOverrides)
    const rot = rotations?.[p.id] || 'auto'

    // For 'auto': pick whichever rotation fits more across the width
    let useRotated = false
    if (rot === 'on') {
      useRotated = true
    } else if (rot === 'auto') {
      const normalFit  = Math.floor(usableWidth / effWidth)
      const rotatedFit = Math.floor(usableWidth / effLength)
      useRotated = rotatedFit > normalFit
    }

    const dims = panelDims(effLength, effWidth, useRotated)
    const panelsPerRow = Math.floor(usableWidth / dims.width)
    const eff = (Number(p.markerEfficiency) || Number(markerEfficiency) || 85) / 100

    return {
      id: p.id,
      name: p.name || `Panel ${p.id}`,
      effLength,
      effWidth,
      rotated: useRotated,
      dims,
      panelsPerRow: panelsPerRow > 0 ? panelsPerRow : 0,
      rowsNeeded: panelsPerRow > 0 ? Math.ceil(qty / panelsPerRow) : null,
      lengthPerSet: panelsPerRow > 0 ? dims.length : null, // cm per row of panels
      markerEff: eff,
    }
  })

  // ── Separate rows mode ────────────────────────────────────────────────────
  if (rowMode === 'separate') {
    let totalLength = 0
    const strips = panelData.map(pd => {
      if (!pd.panelsPerRow) return { ...pd, totalLength: null }
      const rawLength = (pd.rowsNeeded * pd.dims.length) / pd.markerEff
      totalLength += rawLength
      return { ...pd, rawLength, totalLength: rawLength }
    })
    const totalLengthM  = totalLength / 100
    const fabricAreaM2  = (usableWidth / 100) * totalLengthM
    const usedAreaM2    = panelData.reduce((acc, pd) => {
      if (!pd.panelsPerRow) return acc
      return acc + (pd.dims.length / 100) * (pd.dims.width / 100) * qty
    }, 0)
    const wastagePct    = fabricAreaM2 > 0
      ? ((fabricAreaM2 - usedAreaM2) / fabricAreaM2) * 100 : 100

    return { panelData: strips, totalLengthCm: totalLength, totalLengthM, wastagePct, rowMode: 'separate' }
  }

  // ── Mixed rows mode ────────────────────────────────────────────────────────
  // One of each panel type per row, greedily packed left-to-right
  let totalLength = 0
  const strips = []

  // How many complete sets (one of each panel) per row across the fabric?
  // Greedy: place panels left to right until width is full
  const rowWidthUsed = panelData.reduce((acc, pd) => acc + (pd.panelsPerRow > 0 ? pd.dims.width : 0), 0)
  const setsPerRow   = panelData.every(pd => pd.panelsPerRow > 0)
    ? Math.max(1, Math.floor(usableWidth / rowWidthUsed))
    : null

  if (setsPerRow && setsPerRow > 0) {
    const rowsNeeded = Math.ceil(qty / setsPerRow)
    const rowHeight  = Math.max(...panelData.map(pd => pd.dims.length))
    const avgEff     = panelData.reduce((a, pd) => a + pd.markerEff, 0) / panelData.length
    const rawLength  = (rowsNeeded * rowHeight) / avgEff
    totalLength      = rawLength

    panelData.forEach(pd => {
      strips.push({ ...pd, rowsNeeded, setsPerRow, mixedRowHeight: rowHeight })
    })
  } else {
    // Fallback to separate if mixed doesn't work
    return calcLayout({ panels, fabricWidthCm, selvedgeCm, globalShrinkage,
      panelShrinkageOverrides, rowMode: 'separate', rotations, orderQty, markerEfficiency })
  }

  const totalLengthM = totalLength / 100
  const fabricAreaM2 = (usableWidth / 100) * totalLengthM
  const usedAreaM2   = panelData.reduce((acc, pd) => {
    return acc + (pd.dims.length / 100) * (pd.dims.width / 100) * qty
  }, 0)
  const wastagePct   = fabricAreaM2 > 0
    ? ((fabricAreaM2 - usedAreaM2) / fabricAreaM2) * 100 : 100

  return { panelData: strips, totalLengthCm: totalLength, totalLengthM, wastagePct, rowMode: 'mixed', setsPerRow }
}

// ── Width optimizer ───────────────────────────────────────────────────────────
export function optimizeWidth({
  panels, selvedgeCm, globalShrinkage, panelShrinkageOverrides,
  rowMode, rotations, orderQty, markerEfficiency, preferredWidthCm,
}) {
  const widthsCm = STANDARD_WIDTHS_INCHES.map(w => ({
    label: `${w}"`,
    cm: w * 2.54,
    isStandard: true,
  }))

  if (preferredWidthCm && preferredWidthCm > 0) {
    widthsCm.push({
      label: 'Your width',
      cm: preferredWidthCm,
      isPreferred: true,
    })
  }

  const results = widthsCm.map(w => {
    const layout = calcLayout({
      panels, fabricWidthCm: w.cm, selvedgeCm, globalShrinkage,
      panelShrinkageOverrides, rowMode, rotations, orderQty, markerEfficiency,
    })
    return { ...w, layout }
  }).filter(r => r.layout && r.layout.totalLengthM > 0)

  // Sort by wastage % ascending
  results.sort((a, b) => a.layout.wastagePct - b.layout.wastagePct)
  return results
}

// ── PANEL COLORS for SVG ──────────────────────────────────────────────────────
export const PANEL_COLORS = [
  '#B86040', '#3A5A8A', '#2D7A44', '#7A2D6B',
  '#7A6B2D', '#2D6B7A', '#6B2D2D', '#2D4A6B',
]
