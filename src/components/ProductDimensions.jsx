import React, { useState } from 'react'
import useLoomStore from '../store/useLoomStore'
import SectionFooter from '../ui/SectionFooter'
import SpecSheet from './SpecSheet'
import FabricLayout from './FabricLayout'

// ── ID generator ──────────────────────────────────────────────────────────────
const genId = () => `pd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

// ── Empty panel factory ───────────────────────────────────────────────────────
const emptyPanel = () => ({
  id:               genId(),
  name:             '',
  linkedFabricId:   '',
  panelMode:        'standard', // 'standard' | 'curtain' | 'knit'
  headingStyle:     'Custom',   // curtain heading preset
  // Finished dimensions
  finishedLength:   '',
  finishedWidth:    '',
  dimUnit:          'cm',
  // Curtain fullness
  fullnessRatio:    '2',        // 2–2.5 typical
  // Knit mode (kg/dozen)
  knitGSM:          '',         // g/m²
  knitWidth:        '',         // cm
  knitQtyPerDozen:  '',         // kg/dozen
  // Processing shrinkage (greige→finished, before cutting)
  processShrinkageEnabled: false,
  processShrinkageWarp:    '5', // % — typical for cotton after bleaching
  processShrinkageWeft:    '3',
  // Stitching allowance
  allowanceMode:    'all',
  allowanceAll:     '1',
  allowanceTop:     '1',
  allowanceBottom:  '1',
  allowanceLeft:    '1',
  allowanceRight:   '1',
  // Cutting efficiency
  markerEfficiency: '85',
  wastage:          '5',
  // Override
  consumptionOverride: false,
  consumptionManual:   '',
})

// ── Curtain heading presets (from Sotexpro technical data sheets) ─────────────
const CURTAIN_HEADINGS = [
  { label: 'Eyelet',               fullness: '2.0',  bottomCm: '2',  sideCm: '1' },
  { label: 'Wave',                  fullness: '2.1',  bottomCm: '2',  sideCm: '2' },
  { label: 'Hollow Pleat',          fullness: '1.5',  bottomCm: '10', sideCm: '2' },
  { label: 'Flat Pleat',            fullness: '1.15', bottomCm: '10', sideCm: '2' },
  { label: 'Prepleated (Blackout)', fullness: '1.3',  bottomCm: '1',  sideCm: '1' },
  { label: 'Prepleated (Solar)',     fullness: '1.5',  bottomCm: '10', sideCm: '1' },
  { label: 'Microflex',             fullness: '1.6',  bottomCm: '2',  sideCm: '2' },
  { label: 'Standard / Rings',      fullness: '1.25', bottomCm: '2',  sideCm: '1' },
  { label: 'Custom',                fullness: '',     bottomCm: '',   sideCm: ''  },
]
const toCm = (val, unit) => unit === 'inches' ? Number(val) * 2.54 : Number(val)
const toInches = (val, unit) => unit === 'cm' ? Number(val) / 2.54 : Number(val)

// ── Panel calculation ─────────────────────────────────────────────────────────
export function calcPanelConsumption(panel, fabricWidthCm, selvedgeCm) {
  // ── Knit mode (kg/dozen) ──────────────────────────────────────────────────
  if (panel.panelMode === 'knit') {
    const kgDoz = Number(panel.knitQtyPerDozen) || 0
    // Return consumption in kg/piece (÷12) — stored as adjustedPerPiece in kg unit
    return {
      cutLength: 0, cutWidth: 0, panelsPerRow: 0,
      fabricPerPiece: kgDoz / 12,
      adjustedPerPiece: kgDoz / 12,
      isKnit: true,
      kgPerDozen: kgDoz,
    }
  }

  const fl = Number(panel.finishedLength) || 0
  let   fw = Number(panel.finishedWidth)  || 0
  if (!fl || !fw) return { cutLength: 0, cutWidth: 0, panelsPerRow: 0, fabricPerPiece: 0, adjustedPerPiece: 0 }

  // ── Curtain mode: apply fullness ratio to width ───────────────────────────
  if (panel.panelMode === 'curtain') {
    fw = fw * (Number(panel.fullnessRatio) || 2)
  }

  // Convert to cm
  const flCm = toCm(fl, panel.dimUnit)
  const fwCm = toCm(fw, panel.dimUnit)

  // Processing shrinkage — applied to cut size to account for greige→finished loss
  const procWarp = panel.processShrinkageEnabled ? (Number(panel.processShrinkageWarp) || 0) : 0
  const procWeft = panel.processShrinkageEnabled ? (Number(panel.processShrinkageWeft) || 0) : 0

  // Stitching allowances
  const aTop    = Number(panel.allowanceMode === 'all' ? panel.allowanceAll : panel.allowanceTop)    || 0
  const aBottom = Number(panel.allowanceMode === 'all' ? panel.allowanceAll : panel.allowanceBottom) || 0
  const aLeft   = Number(panel.allowanceMode === 'all' ? panel.allowanceAll : panel.allowanceLeft)   || 0
  const aRight  = Number(panel.allowanceMode === 'all' ? panel.allowanceAll : panel.allowanceRight)  || 0

  // Cut size before processing shrinkage compensation
  const cutLengthBase = flCm + aTop + aBottom
  const cutWidthBase  = fwCm + aLeft + aRight

  // Add processing shrinkage to cut size (fabric needs to be cut larger to account for shrinkage during processing)
  const cutLength = cutLengthBase * (1 + procWarp / 100)
  const cutWidth  = cutWidthBase  * (1 + procWeft / 100)

  // Usable fabric width
  const usableWidth = fabricWidthCm - (selvedgeCm * 2)
  if (usableWidth <= 0) return { cutLength, cutWidth, panelsPerRow: 0, fabricPerPiece: 0, adjustedPerPiece: 0 }

  const panelsPerRow = Math.floor(usableWidth / cutWidth)
  if (panelsPerRow <= 0) return { cutLength, cutWidth, panelsPerRow: 0, fabricPerPiece: 0, adjustedPerPiece: 0 }

  const fabricPerPieceCm = cutLength / panelsPerRow
  const fabricPerPiece   = fabricPerPieceCm / 100

  const efficiency = (Number(panel.markerEfficiency) || 85) / 100
  const wastage    = (Number(panel.wastage) || 0) / 100
  const adjustedPerPiece = (fabricPerPiece / efficiency) * (1 + wastage)

  return { cutLength, cutWidth, panelsPerRow, fabricPerPiece, adjustedPerPiece,
    procWarp, procWeft, isCurtain: panel.panelMode === 'curtain',
    effectiveFW: fwCm }
}

// ── Formatter ─────────────────────────────────────────────────────────────────
const inr = n =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtNum = (n, dp = 3) => (Number(n) || 0).toFixed(dp)

// ── Sub-components ────────────────────────────────────────────────────────────
function Cell({ label, hint, children, width }) {
  return (
    <div className="rm-cell" style={width ? { flex: `0 0 ${width}px` } : {}}>
      {label && <span className="rm-cell-label">{label}</span>}
      {children}
      {hint && <span className="pr-field-hint">{hint}</span>}
    </div>
  )
}

function ReadOnly({ label, value, accent }) {
  return (
    <Cell label={label}>
      <div className={`rm-subtotal rm-subtotal--active${accent ? ' pd-accent-chip' : ''}`}>
        {value}
      </div>
    </Cell>
  )
}

// ── Single panel ──────────────────────────────────────────────────────────────
function PanelRow({ panel, index, fabricRows, fabricWidthCm, selvedgeCm, onUpdate, onRemove, onUpdateSection1 }) {
  const set = (field, value) => onUpdate(panel.id, field, value)
  const calc = calcPanelConsumption(panel, fabricWidthCm, selvedgeCm)
  const effectiveConsumption = panel.consumptionOverride
    ? Number(panel.consumptionManual) || 0
    : calc.adjustedPerPiece
  const linkedFabric = fabricRows.find(r => r.id === panel.linkedFabricId)

  return (
    <div className="pd-panel-card">
      {/* Panel header */}
      <div className="pd-panel-header">
        <div className="pd-panel-index">{String.fromCharCode(65 + index)}</div>
        <input type="text" className="input input-sm pd-panel-name"
          placeholder='Panel name e.g. "Front", "Back", "Drop"'
          value={panel.name} onChange={e => set('name', e.target.value)} />
        {/* Panel mode toggle */}
        <div className="pr-unit-toggle" style={{ marginLeft: 'auto' }}>
          {[['standard','Standard'],['curtain','Curtain'],['knit','Knit (kg/doz)']].map(([v,l]) => (
            <button key={v}
              className={`pr-unit-btn${(panel.panelMode||'standard') === v ? ' pr-unit-btn--active' : ''}`}
              onClick={() => set('panelMode', v)}>{l}</button>
          ))}
        </div>
        <button className="btn btn-sm btn-danger" onClick={() => onRemove(panel.id)}>✕</button>
      </div>

      {/* Linked fabric */}
      <div className="rm-row-line" style={{ marginTop: 10 }}>
        <Cell label="Linked Fabric (Section 1)">
          <select className="input input-sm" value={panel.linkedFabricId}
            onChange={e => set('linkedFabricId', e.target.value)}>
            <option value="">— select fabric row —</option>
            {fabricRows.map(r => (
              <option key={r.id} value={r.id}>
                {r.materialName || 'Unnamed fabric'}{r.composition ? ` · ${r.composition}` : ''}
              </option>
            ))}
          </select>
        </Cell>
        {panel.panelMode !== 'knit' && (
          <Cell label="Unit" width={100}>
            <select className="input input-sm" value={panel.dimUnit}
              onChange={e => set('dimUnit', e.target.value)}>
              <option value="cm">cm</option>
              <option value="inches">inches</option>
            </select>
          </Cell>
        )}
      </div>

      {/* ── Knit mode ── */}
      {panel.panelMode === 'knit' && (
        <div className="pd-allowance-block">
          <p className="rm-cell-label" style={{ marginBottom: 8 }}>
            Knit fabric consumption — enter kg per dozen pieces
          </p>
          <div className="rm-row-line">
            <Cell label="GSM (g/m²)">
              <input type="number" className="input input-sm mono"
                placeholder="0" min="0" value={panel.knitGSM}
                onChange={e => set('knitGSM', e.target.value)} />
            </Cell>
            <Cell label="Fabric Width (cm)">
              <input type="number" className="input input-sm mono"
                placeholder="0" min="0" value={panel.knitWidth}
                onChange={e => set('knitWidth', e.target.value)} />
            </Cell>
            <Cell label="Qty (kg/dozen)">
              <div className="qty-row">
                <input type="number" className="input input-sm mono"
                  placeholder="0.00" min="0" step="0.01" value={panel.knitQtyPerDozen}
                  onChange={e => set('knitQtyPerDozen', e.target.value)} />
                <span className="unit-static">kg/doz</span>
              </div>
            </Cell>
            {calc.fabricPerPiece > 0 && (
              <Cell label="Per Piece">
                <div className="rm-subtotal rm-subtotal--active">
                  {fmtNum(calc.fabricPerPiece, 4)} kg/pc
                </div>
              </Cell>
            )}
          </div>
        </div>
      )}

      {/* ── Standard / Curtain dims ── */}
      {panel.panelMode !== 'knit' && (
        <>
          {/* Curtain fullness */}
          {panel.panelMode === 'curtain' && (
            <div className="pd-allowance-block">
              <div className="pd-allowance-header">
                <span className="rm-cell-label">Curtain Heading Style & Fullness</span>
              </div>
              <div className="rm-row-line">
                <Cell label="Heading Style">
                  <select className="input input-sm" value={panel.headingStyle || 'Custom'}
                    onChange={e => {
                      const preset = CURTAIN_HEADINGS.find(h => h.label === e.target.value)
                      set('headingStyle', e.target.value)
                      if (preset && preset.label !== 'Custom') {
                        set('fullnessRatio', preset.fullness)
                        if (preset.bottomCm) set('allowanceBottom', preset.bottomCm)
                        if (preset.sideCm)   { set('allowanceLeft', preset.sideCm); set('allowanceRight', preset.sideCm) }
                        set('allowanceMode', 'per-side')
                      }
                    }}>
                    {CURTAIN_HEADINGS.map(h => <option key={h.label}>{h.label}</option>)}
                  </select>
                </Cell>
                <Cell label="Fullness Ratio" width={150} hint="Finished width × ratio = cut width (1.15–2.8)">
                  <div className="qty-row">
                    <input type="number" className="input input-sm mono"
                      placeholder="2.0" min="1" max="4" step="0.05"
                      value={panel.fullnessRatio}
                      onChange={e => set('fullnessRatio', e.target.value)} />
                    <span className="unit-static">×</span>
                  </div>
                </Cell>
                {panel.finishedWidth && panel.fullnessRatio && (
                  <Cell label="Effective Width">
                    <div className="rm-subtotal rm-subtotal--active">
                      {fmtNum(Number(panel.finishedWidth) * Number(panel.fullnessRatio), 1)} {panel.dimUnit}
                    </div>
                  </Cell>
                )}
              </div>
            </div>
          )}

          {/* Finished dimensions */}
          <div className="rm-row-line">
            <Cell label={`Finished Length (${panel.dimUnit})`}>
              <input type="number" className="input input-sm mono"
                placeholder="0" min="0" step="0.1" value={panel.finishedLength}
                onChange={e => set('finishedLength', e.target.value)} />
            </Cell>
            <Cell label={`Finished Width (${panel.dimUnit})${panel.panelMode === 'curtain' ? ' (before fullness)' : ''}`}>
              <input type="number" className="input input-sm mono"
                placeholder="0" min="0" step="0.1" value={panel.finishedWidth}
                onChange={e => set('finishedWidth', e.target.value)} />
            </Cell>
          </div>

          {/* Processing shrinkage */}
          <div className="pd-allowance-block">
            <div className="pd-allowance-header">
              <span className="rm-cell-label">Processing Shrinkage (greige → finished)</span>
              <button
                className={`toggle-btn${panel.processShrinkageEnabled ? ' toggle-btn--on' : ''}`}
                style={{ width: 36, height: 20 }}
                onClick={() => set('processShrinkageEnabled', !panel.processShrinkageEnabled)}>
                <span className="toggle-knob" style={{ width: 14, height: 14 }} />
              </button>
            </div>
            {panel.processShrinkageEnabled && (
              <div className="rm-row-line">
                <Cell label="Warp / Length %" hint="After bleaching/dyeing (typical 5–10%)">
                  <div className="qty-row">
                    <input type="number" className="input input-sm mono"
                      placeholder="5" min="0" max="30" step="0.5"
                      value={panel.processShrinkageWarp}
                      onChange={e => set('processShrinkageWarp', e.target.value)} />
                    <span className="unit-static">%</span>
                  </div>
                </Cell>
                <Cell label="Weft / Width %" hint="Typical 2–5%">
                  <div className="qty-row">
                    <input type="number" className="input input-sm mono"
                      placeholder="3" min="0" max="30" step="0.5"
                      value={panel.processShrinkageWeft}
                      onChange={e => set('processShrinkageWeft', e.target.value)} />
                    <span className="unit-static">%</span>
                  </div>
                </Cell>
                {calc.cutLength > 0 && (
                  <Cell label="Cut size (incl. processing shrinkage)">
                    <div className="rm-subtotal rm-subtotal--active" style={{ fontSize: 11 }}>
                      {fmtNum(calc.cutLength, 1)} × {fmtNum(calc.cutWidth, 1)} cm
                    </div>
                  </Cell>
                )}
              </div>
            )}
          </div>

          {/* Stitching allowance */}
          <div className="pd-allowance-block">
            <div className="pd-allowance-header">
              <span className="rm-cell-label">Stitching Allowance (cm)</span>
              <div className="pr-unit-toggle">
                {['all', 'per-side'].map(m => (
                  <button key={m}
                    className={`pr-unit-btn${panel.allowanceMode === m ? ' pr-unit-btn--active' : ''}`}
                    onClick={() => set('allowanceMode', m)}>
                    {m === 'all' ? 'All sides' : 'Per side'}
                  </button>
                ))}
              </div>
            </div>
            {panel.allowanceMode === 'all' ? (
              <div className="rm-row-line">
                <Cell label="All sides (cm)" width={140}>
                  <div className="qty-row">
                    <input type="number" className="input input-sm mono"
                      placeholder="1" min="0" step="0.1" value={panel.allowanceAll}
                      onChange={e => set('allowanceAll', e.target.value)} />
                    <span className="unit-static">cm</span>
                  </div>
                </Cell>
                {!panel.processShrinkageEnabled && calc.cutLength > 0 && (
                  <>
                    <ReadOnly label="Cut Length" value={`${fmtNum(calc.cutLength, 1)} cm`} />
                    <ReadOnly label="Cut Width"  value={`${fmtNum(calc.cutWidth, 1)} cm`} />
                  </>
                )}
              </div>
            ) : (
              <div className="pd-perside-grid">
                {['Top','Bottom','Left','Right'].map(side => (
                  <Cell key={side} label={`${side} (cm)`}>
                    <div className="qty-row">
                      <input type="number" className="input input-sm mono"
                        placeholder="1" min="0" step="0.1"
                        value={panel[`allowance${side}`]}
                        onChange={e => set(`allowance${side}`, e.target.value)} />
                      <span className="unit-static">cm</span>
                    </div>
                  </Cell>
                ))}
              </div>
            )}
          </div>

          {/* Efficiency + wastage */}
          <div className="rm-row-line">
            <Cell label="Marker Efficiency %" hint="Typically 80–90%">
              <div className="qty-row">
                <input type="number" className="input input-sm mono"
                  placeholder="85" min="1" max="100" step="1"
                  value={panel.markerEfficiency}
                  onChange={e => set('markerEfficiency', e.target.value)} />
                <span className="unit-static">%</span>
              </div>
            </Cell>
            <Cell label="Cutting Wastage %">
              <div className="qty-row">
                <input type="number" className="input input-sm mono"
                  placeholder="5" min="0" max="100" step="0.5"
                  value={panel.wastage}
                  onChange={e => set('wastage', e.target.value)} />
                <span className="unit-static">%</span>
              </div>
            </Cell>
          </div>
        </>
      )}

      {/* Computed results */}
      {fabricWidthCm > 0 && (calc.adjustedPerPiece > 0 || calc.fabricPerPiece > 0) && (
        <div className="pd-results">
          {!calc.isKnit && (
            <>
              <div className="pd-result-chip">
                <span className="pd-result-label">Panels / row</span>
                <span className="pd-result-value mono">{calc.panelsPerRow || '—'}</span>
              </div>
              <div className="pd-result-chip">
                <span className="pd-result-label">Raw fabric / piece</span>
                <span className="pd-result-value mono">{fmtNum(calc.fabricPerPiece, 4)} m</span>
              </div>
            </>
          )}
          <div className="pd-result-chip pd-result-chip--main">
            <span className="pd-result-label">
              {calc.isKnit ? 'Consumption / piece' : 'Adjusted consumption'}
            </span>
            <span className="pd-result-value mono">
              {fmtNum(calc.adjustedPerPiece, 4)} {calc.isKnit ? 'kg' : 'm'} / piece
            </span>
          </div>
        </div>
      )}

      {/* Consumption override + push */}
      {panel.linkedFabricId && (
        <div className="pd-push-row">
          <div className="pd-push-consumption">
            <span className="rm-cell-label">Consumption to use</span>
            <div className="qty-row">
              <input type="number"
                className={`input input-sm mono${!panel.consumptionOverride ? ' input--auto' : ''}`}
                placeholder="0.0000" min="0" step="0.0001"
                value={panel.consumptionOverride ? panel.consumptionManual : fmtNum(calc.adjustedPerPiece, 4)}
                onChange={e => { set('consumptionManual', e.target.value); set('consumptionOverride', true) }} />
              <span className="pr-unit">{calc.isKnit ? 'kg/pc' : 'm/pc'}</span>
              {panel.consumptionOverride && (
                <button className="qty-reset-btn" title="Reset to calculated"
                  onClick={() => { set('consumptionOverride', false); set('consumptionManual', '') }}>↺</button>
              )}
            </div>
            {!panel.consumptionOverride && calc.adjustedPerPiece > 0 && (
              <span className="qty-auto-tag" style={{ marginTop: 3 }}>auto · from dimensions</span>
            )}
          </div>

          <button className="btn btn-ghost pd-push-btn"
            onClick={() => onUpdateSection1(panel.linkedFabricId, effectiveConsumption)}
            disabled={!effectiveConsumption}
            title="Push consumption to Section 1">
            → Push to Section 1
          </button>

          {linkedFabric && (
            <span className="pd-linked-badge">→ {linkedFabric.materialName || 'Unnamed fabric'}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProductDimensions() {
  const pd            = useLoomStore(s => s.sections.productDimensions) || { fabricWidth: '', fabricWidthUnit: 'inches', selvedgePerSide: '1', selvedgeUnit: 'inches', panels: [], allowancePct: '' }
  const rmRows        = useLoomStore(s => s.sections.rawMaterials.rows)
  const orderQty      = useLoomStore(s => s.header.orderQty)
  const updateSection = useLoomStore(s => s.updateSection)
  const [activeTab,   setActiveTab] = useState('dimensions')

  const setPd  = updater => updateSection('productDimensions', updater)
  const setRm  = updater => updateSection('rawMaterials', updater)

  const fabricRows    = rmRows.filter(r => r.materialType === 'fabric')
  const fabricWidthCm = toCm(pd.fabricWidth || 0, pd.fabricWidthUnit)
  const selvedgeCm    = toCm(pd.selvedgePerSide || 0, pd.selvedgeUnit)
  const usableWidthCm = fabricWidthCm - selvedgeCm * 2

  const addPanel = () =>
    setPd(prev => ({ ...prev, panels: [...(prev.panels || []), emptyPanel()] }))

  const updatePanel = (id, field, value) =>
    setPd(prev => ({
      ...prev,
      panels: prev.panels.map(p => p.id === id ? { ...p, [field]: value } : p),
    }))

  const removePanel = id =>
    setPd(prev => ({ ...prev, panels: prev.panels.filter(p => p.id !== id) }))

  const pushToSection1 = (fabricRowId, consumption) => {
    setRm(prev => ({
      ...prev,
      rows: prev.rows.map(r => {
        if (r.id !== fabricRowId) return r
        return { ...r, qty: String(Number(consumption).toFixed(4)), qtyUnit: 'metres', consumptionFromDims: true }
      }),
    }))
  }

  const panels = pd.panels || []
  const totalFabricCost = panels.reduce((acc, panel) => {
    const calc = calcPanelConsumption(panel, fabricWidthCm, selvedgeCm)
    const consumption = panel.consumptionOverride
      ? Number(panel.consumptionManual) || 0
      : calc.adjustedPerPiece
    const linkedFabric = rmRows.find(r => r.id === panel.linkedFabricId)
    const price = Number(linkedFabric?.price) || 0
    return acc + consumption * price
  }, 0)

  const TABS = [
    { id: 'dimensions', label: '📐 Dimensions' },
    { id: 'layout',     label: '🧵 Fabric Layout' },
    { id: 'spec',       label: '📄 Spec Sheet' },
  ]

  return (
    <div className="pd-tabbed">
      {/* Tab bar */}
      <div className="pd-tab-bar">
        {TABS.map(t => (
          <button key={t.id}
            className={`pd-tab-btn${activeTab === t.id ? ' pd-tab-btn--active' : ''}`}
            onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Dimensions tab ── */}
      {activeTab === 'dimensions' && (
        <div className="rm-section">
          <div className="pd-roll-setup">
            <div className="pd-roll-title">Fabric Roll</div>
            <div className="rm-row-line">
              <Cell label="Fabric Width">
                <div className="qty-row">
                  <input type="number" className="input input-sm mono"
                    placeholder="0" min="0" step="0.5"
                    value={pd.fabricWidth}
                    onChange={e => setPd(prev => ({ ...prev, fabricWidth: e.target.value }))} />
                  <select className="input input-sm mono unit-select" value={pd.fabricWidthUnit}
                    onChange={e => setPd(prev => ({ ...prev, fabricWidthUnit: e.target.value }))}>
                    <option value="inches">in</option>
                    <option value="cm">cm</option>
                  </select>
                </div>
              </Cell>
              <Cell label="Selvedge / Side">
                <div className="qty-row">
                  <input type="number" className="input input-sm mono"
                    placeholder="1" min="0" step="0.25"
                    value={pd.selvedgePerSide}
                    onChange={e => setPd(prev => ({ ...prev, selvedgePerSide: e.target.value }))} />
                  <select className="input input-sm mono unit-select" value={pd.selvedgeUnit}
                    onChange={e => setPd(prev => ({ ...prev, selvedgeUnit: e.target.value }))}>
                    <option value="inches">in</option>
                    <option value="cm">cm</option>
                  </select>
                </div>
              </Cell>
              {usableWidthCm > 0 && (
                <Cell label="Usable Width">
                  <div className="rm-subtotal rm-subtotal--active">
                    {fmtNum(usableWidthCm, 1)} cm &nbsp;·&nbsp; {fmtNum(usableWidthCm / 2.54, 2)} in
                  </div>
                </Cell>
              )}
            </div>
            {fabricRows.length === 0 && (
              <p className="pr-field-hint" style={{ marginTop: 6 }}>
                Add fabric rows in Section 1 first to link panels.
              </p>
            )}
          </div>

          {panels.length === 0 ? (
            <div className="rm-empty">
              <p>No panels added yet.</p>
              <p className="rm-empty-sub">
                Add a panel for each fabric piece — e.g. Front, Back, Flap, Sleeve.
              </p>
            </div>
          ) : (
            <div className="pd-panels">
              {panels.map((panel, i) => (
                <PanelRow key={panel.id} panel={panel} index={i}
                  fabricRows={fabricRows} fabricWidthCm={fabricWidthCm}
                  selvedgeCm={selvedgeCm}
                  onUpdate={updatePanel} onRemove={removePanel}
                  onUpdateSection1={pushToSection1} />
              ))}
            </div>
          )}

          <div className="rm-footer">
            <button className="btn btn-ghost btn-add-row" onClick={addPanel}>+ Add Panel</button>
            {/* Curtain lining suggestion — shown when any curtain panel exists without a lining panel */}
            {panels.some(p => p.panelMode === 'curtain') &&
             !panels.some(p => p.name?.toLowerCase().includes('lining')) && (
              <div className="pd-lining-suggest">
                <span>💡 Curtain detected — add a lining panel?</span>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  const newPanel = emptyPanel()
                  newPanel.panelMode = 'standard'
                  newPanel.name = 'Lining'
                  setPd(prev => ({ ...prev, panels: [...(prev.panels || []), newPanel] }))
                }}>+ Add Lining Panel</button>
              </div>
            )}
            {panels.length > 0 && totalFabricCost > 0 && (
              <div className="rm-total-row">
                <span className="rm-total-label">
                  Total Fabric Cost / Piece
                  <span className="rm-row-count">({panels.length} panel{panels.length !== 1 ? 's' : ''})</span>
                </span>
                <span className="rm-total-value mono">{inr(totalFabricCost)}</span>
              </div>
            )}
          </div>

          <SectionFooter
            label="Product Dimensions"
            baseCostPerPiece={totalFabricCost}
            orderQty={orderQty}
            allowancePct={pd.allowancePct || ''}
            onAllowanceChange={v => setPd(prev => ({ ...prev, allowancePct: v }))}
            show={panels.length > 0 && totalFabricCost > 0}
          />
        </div>
      )}

      {/* ── Fabric Layout tab ── */}
      {activeTab === 'layout' && <FabricLayout />}

      {/* ── Spec Sheet tab ── */}
      {activeTab === 'spec' && (
        <div className="pd-spec-preview">
          <div className="pd-spec-actions">
            <button className="btn btn-ghost share-btn"
              onClick={() => { document.body.dataset.printMode = 'spec'; window.print() }}>
              ⎙ Print / Save as PDF
            </button>
          </div>
          <div className="pd-spec-live">
            <SpecSheet />
          </div>
        </div>
      )}
    </div>
  )
}
