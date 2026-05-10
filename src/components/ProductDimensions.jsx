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
  linkedFabricId:   '',       // ID of a fabric row in Section 1
  // Finished dimensions
  finishedLength:   '',
  finishedWidth:    '',
  dimUnit:          'cm',     // 'cm' | 'inches'
  // Stitching allowance
  allowanceMode:    'all',    // 'all' | 'per-side'
  allowanceAll:     '1',      // cm
  allowanceTop:     '1',
  allowanceBottom:  '1',
  allowanceLeft:    '1',
  allowanceRight:   '1',
  // Efficiency
  markerEfficiency: '85',     // %
  wastage:          '5',      // %
  // Override
  consumptionOverride: false,
  consumptionManual:   '',
})

// ── Unit conversions ──────────────────────────────────────────────────────────
const toCm = (val, unit) => unit === 'inches' ? Number(val) * 2.54 : Number(val)
const toInches = (val, unit) => unit === 'cm' ? Number(val) / 2.54 : Number(val)

// ── Panel calculation ─────────────────────────────────────────────────────────
export function calcPanelConsumption(panel, fabricWidthCm, selvedgeCm) {
  const fl = Number(panel.finishedLength) || 0
  const fw = Number(panel.finishedWidth)  || 0
  if (!fl || !fw) return { cutLength: 0, cutWidth: 0, panelsPerRow: 0, fabricPerPiece: 0, adjustedPerPiece: 0 }

  // Convert finished dims to cm
  const flCm = toCm(fl, panel.dimUnit)
  const fwCm = toCm(fw, panel.dimUnit)

  // Stitching allowances (all in cm)
  const aTop    = Number(panel.allowanceMode === 'all' ? panel.allowanceAll : panel.allowanceTop)    || 0
  const aBottom = Number(panel.allowanceMode === 'all' ? panel.allowanceAll : panel.allowanceBottom) || 0
  const aLeft   = Number(panel.allowanceMode === 'all' ? panel.allowanceAll : panel.allowanceLeft)   || 0
  const aRight  = Number(panel.allowanceMode === 'all' ? panel.allowanceAll : panel.allowanceRight)  || 0

  const cutLength = flCm + aTop + aBottom   // cm
  const cutWidth  = fwCm + aLeft + aRight   // cm

  // Usable fabric width
  const usableWidth = fabricWidthCm - (selvedgeCm * 2)
  if (usableWidth <= 0) return { cutLength, cutWidth, panelsPerRow: 0, fabricPerPiece: 0, adjustedPerPiece: 0 }

  const panelsPerRow = Math.floor(usableWidth / cutWidth)
  if (panelsPerRow <= 0) return { cutLength, cutWidth, panelsPerRow: 0, fabricPerPiece: 0, adjustedPerPiece: 0 }

  // Fabric consumed per piece (in metres)
  const fabricPerPieceCm = cutLength / panelsPerRow
  const fabricPerPiece   = fabricPerPieceCm / 100  // metres

  // Apply marker efficiency and wastage
  const efficiency = (Number(panel.markerEfficiency) || 85) / 100
  const wastage    = (Number(panel.wastage) || 0) / 100
  const adjustedPerPiece = (fabricPerPiece / efficiency) * (1 + wastage)

  return { cutLength, cutWidth, panelsPerRow, fabricPerPiece, adjustedPerPiece }
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

  // Effective consumption to push to Section 1
  const effectiveConsumption = panel.consumptionOverride
    ? Number(panel.consumptionManual) || 0
    : calc.adjustedPerPiece

  // Find linked fabric name for display
  const linkedFabric = fabricRows.find(r => r.id === panel.linkedFabricId)

  return (
    <div className="pd-panel-card">
      {/* Panel header */}
      <div className="pd-panel-header">
        <div className="pd-panel-index">{String.fromCharCode(65 + index)}</div>
        <input
          type="text"
          className="input input-sm pd-panel-name"
          placeholder='Panel name, e.g. "Front", "Back", "Flap"'
          value={panel.name}
          onChange={e => set('name', e.target.value)}
        />
        <button className="btn btn-sm btn-danger" onClick={() => onRemove(panel.id)}>✕</button>
      </div>

      {/* Link to fabric row */}
      <div className="rm-row-line" style={{ marginTop: 10 }}>
        <Cell label="Linked Fabric (Section 1)">
          <select
            className="input input-sm"
            value={panel.linkedFabricId}
            onChange={e => set('linkedFabricId', e.target.value)}
          >
            <option value="">— select fabric row —</option>
            {fabricRows.map(r => (
              <option key={r.id} value={r.id}>
                {r.materialName || 'Unnamed fabric'} {r.composition ? `· ${r.composition}` : ''}
              </option>
            ))}
          </select>
        </Cell>

        {/* Dimension unit */}
        <Cell label="Unit" width={100}>
          <select className="input input-sm" value={panel.dimUnit}
            onChange={e => set('dimUnit', e.target.value)}>
            <option value="cm">cm</option>
            <option value="inches">inches</option>
          </select>
        </Cell>
      </div>

      {/* Finished dimensions */}
      <div className="rm-row-line">
        <Cell label={`Finished Length (${panel.dimUnit})`}>
          <input type="number" className="input input-sm mono"
            placeholder="0" min="0" step="0.1" value={panel.finishedLength}
            onChange={e => set('finishedLength', e.target.value)} />
        </Cell>
        <Cell label={`Finished Width (${panel.dimUnit})`}>
          <input type="number" className="input input-sm mono"
            placeholder="0" min="0" step="0.1" value={panel.finishedWidth}
            onChange={e => set('finishedWidth', e.target.value)} />
        </Cell>
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
            {calc.cutLength > 0 && (
              <>
                <ReadOnly label="Cut Length" value={`${fmtNum(calc.cutLength, 1)} cm`} />
                <ReadOnly label="Cut Width"  value={`${fmtNum(calc.cutWidth, 1)} cm`} />
              </>
            )}
          </div>
        ) : (
          <div className="pd-perside-grid">
            {['Top', 'Bottom', 'Left', 'Right'].map(side => (
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
            {calc.cutLength > 0 && (
              <>
                <ReadOnly label="Cut Length" value={`${fmtNum(calc.cutLength, 1)} cm`} />
                <ReadOnly label="Cut Width"  value={`${fmtNum(calc.cutWidth, 1)} cm`} />
              </>
            )}
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
        <Cell label="Wastage %" hint="Additional cutting wastage">
          <div className="qty-row">
            <input type="number" className="input input-sm mono"
              placeholder="5" min="0" max="100" step="0.5"
              value={panel.wastage}
              onChange={e => set('wastage', e.target.value)} />
            <span className="unit-static">%</span>
          </div>
        </Cell>
      </div>

      {/* Computed results */}
      {fabricWidthCm > 0 && calc.cutLength > 0 && (
        <div className="pd-results">
          <div className="pd-result-chip">
            <span className="pd-result-label">Panels / row</span>
            <span className="pd-result-value mono">{calc.panelsPerRow || '—'}</span>
          </div>
          <div className="pd-result-chip">
            <span className="pd-result-label">Raw fabric / piece</span>
            <span className="pd-result-value mono">{fmtNum(calc.fabricPerPiece, 4)} m</span>
          </div>
          <div className="pd-result-chip pd-result-chip--main">
            <span className="pd-result-label">Adjusted consumption</span>
            <span className="pd-result-value mono">{fmtNum(calc.adjustedPerPiece, 4)} m / piece</span>
          </div>
        </div>
      )}

      {/* Consumption override + push to Section 1 */}
      {panel.linkedFabricId && (
        <div className="pd-push-row">
          <div className="pd-push-consumption">
            <span className="rm-cell-label">Consumption to use</span>
            <div className="qty-row">
              <input
                type="number"
                className={`input input-sm mono${!panel.consumptionOverride ? ' input--auto' : ''}`}
                placeholder="0.0000"
                min="0"
                step="0.0001"
                value={panel.consumptionOverride
                  ? panel.consumptionManual
                  : fmtNum(calc.adjustedPerPiece, 4)}
                onChange={e => {
                  set('consumptionManual', e.target.value)
                  set('consumptionOverride', true)
                }}
              />
              <span className="pr-unit">m/pc</span>
              {panel.consumptionOverride && (
                <button className="qty-reset-btn" title="Reset to calculated"
                  onClick={() => { set('consumptionOverride', false); set('consumptionManual', '') }}>↺</button>
              )}
            </div>
            {!panel.consumptionOverride && calc.adjustedPerPiece > 0 && (
              <span className="qty-auto-tag" style={{ marginTop: 3 }}>auto · from dimensions</span>
            )}
          </div>

          <button
            className="btn btn-ghost pd-push-btn"
            onClick={() => onUpdateSection1(panel.linkedFabricId, effectiveConsumption)}
            disabled={!effectiveConsumption}
            title="Push consumption to Section 1"
          >
            → Push to Section 1
          </button>

          {linkedFabric && (
            <span className="pd-linked-badge">
              → {linkedFabric.materialName || 'Unnamed fabric'}
            </span>
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
