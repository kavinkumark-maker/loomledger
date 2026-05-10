import React, { useState, useMemo } from 'react'
import useLoomStore from '../store/useLoomStore'
import { optimizeWidth, calcLayout, PANEL_COLORS, STANDARD_WIDTHS_INCHES } from '../utils/layoutUtils'

const fmtNum = (n, dp = 2) => (Number(n) || 0).toFixed(dp)

// ── SVG Marker Diagram ────────────────────────────────────────────────────────
function MarkerDiagram({ layout, fabricWidthCm, selvedgeCm, panels }) {
  if (!layout || !layout.panelData) return null

  const usableWidth = fabricWidthCm - selvedgeCm * 2
  const showRows    = Math.min(layout.rowMode === 'mixed' ? 3 : layout.panelData[0]?.rowsNeeded || 3, 4)

  // SVG scale — fit into ~700px wide
  const scale = Math.min(560 / fabricWidthCm, 2.5)
  const svgW  = fabricWidthCm * scale
  const rowH  = layout.rowMode === 'mixed'
    ? (layout.panelData[0]?.mixedRowHeight || 50) * scale
    : (layout.panelData[0]?.dims?.length || 50) * scale
  const svgH  = rowH * showRows + 40
  const selvW = selvedgeCm * scale

  return (
    <div className="fl-diagram-wrap">
      <p className="fl-diagram-label">
        Marker Plan — {showRows} row{showRows !== 1 ? 's' : ''} shown
        {layout.totalLengthM ? ` · Total: ${fmtNum(layout.totalLengthM, 2)} m` : ''}
      </p>
      <div style={{ overflowX: 'auto' }}>
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: 'block' }}>
          {/* Fabric background */}
          <rect x={0} y={0} width={svgW} height={svgH - 30} fill="#FAF7F4" stroke="#E2D3C6" strokeWidth="1" />

          {/* Selvedge hatching */}
          {[0, svgW - selvW].map((x, i) => (
            <rect key={i} x={x} y={0} width={selvW} height={svgH - 30}
              fill="url(#hatch)" opacity="0.6" />
          ))}

          <defs>
            <pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6">
              <path d="M-1,1 l2,-2 M0,6 l6,-6 M5,7 l2,-2" stroke="#C4A998" strokeWidth="1"/>
            </pattern>
          </defs>

          {/* Panel placements */}
          {Array.from({ length: showRows }, (_, rowIdx) => {
            const y = rowIdx * rowH
            if (layout.rowMode === 'mixed') {
              // Place all panel types side by side
              let xCursor = selvW
              return layout.panelData.map((pd, pIdx) => {
                if (!pd.panelsPerRow) return null
                const color = PANEL_COLORS[pIdx % PANEL_COLORS.length]
                const pw = pd.dims.width * scale
                const ph = pd.dims.length * scale
                const el = (
                  <g key={`${rowIdx}-${pIdx}`}>
                    <rect x={xCursor} y={y} width={pw} height={ph}
                      fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.5" rx="2" />
                    <text x={xCursor + pw / 2} y={y + ph / 2 + 4}
                      textAnchor="middle" fontSize={Math.max(8, Math.min(11, pw / 5))}
                      fill={color} fontWeight="600">
                      {pd.name}
                    </text>
                    {pd.rotated && (
                      <text x={xCursor + pw / 2} y={y + ph / 2 + 16}
                        textAnchor="middle" fontSize="8" fill={color} opacity="0.7">↻</text>
                    )}
                  </g>
                )
                xCursor += pw
                return el
              })
            } else {
              // Separate rows — find which panel type this row belongs to
              let rowAccum = 0
              for (const pd of layout.panelData) {
                if (!pd.rowsNeeded) continue
                if (rowIdx < rowAccum + pd.rowsNeeded) {
                  const pIdx  = layout.panelData.indexOf(pd)
                  const color = PANEL_COLORS[pIdx % PANEL_COLORS.length]
                  const pw    = pd.dims.width * scale
                  const ph    = pd.dims.length * scale
                  const count = pd.panelsPerRow
                  return Array.from({ length: Math.min(count, Math.floor(usableWidth * scale / pw)) }, (_, k) => (
                    <g key={`${rowIdx}-${k}`}>
                      <rect x={selvW + k * pw} y={y} width={pw} height={ph}
                        fill={color} fillOpacity="0.22" stroke={color} strokeWidth="1.5" rx="2" />
                      {k === 0 && (
                        <text x={selvW + pw / 2} y={y + ph / 2 + 4}
                          textAnchor="middle" fontSize={Math.max(8, Math.min(11, pw / 5))}
                          fill={color} fontWeight="600">
                          {pd.name}
                        </text>
                      )}
                    </g>
                  ))
                }
                rowAccum += pd.rowsNeeded
              }
              return null
            }
          })}

          {/* Row dividers */}
          {Array.from({ length: showRows - 1 }, (_, i) => (
            <line key={i} x1={selvW} y1={(i + 1) * rowH} x2={svgW - selvW} y2={(i + 1) * rowH}
              stroke="#E2D3C6" strokeWidth="0.5" strokeDasharray="4 3" />
          ))}

          {/* Width dimension line */}
          <line x1={selvW} y1={svgH - 22} x2={svgW - selvW} y2={svgH - 22}
            stroke="#9B8270" strokeWidth="1" markerStart="url(#arr)" markerEnd="url(#arr)" />
          <text x={svgW / 2} y={svgH - 8} textAnchor="middle" fontSize="10" fill="#9B8270">
            Usable: {fmtNum(usableWidth, 1)} cm ({fmtNum(usableWidth / 2.54, 1)}")
          </text>

          <defs>
            <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
              <path d="M0,1 L3,3 L0,5" stroke="#9B8270" strokeWidth="1" fill="none"/>
            </marker>
          </defs>
        </svg>
      </div>

      {/* Legend */}
      <div className="fl-legend">
        {layout.panelData.map((pd, i) => (
          <div key={pd.id} className="fl-legend-item">
            <div className="fl-legend-swatch"
              style={{ background: PANEL_COLORS[i % PANEL_COLORS.length] }} />
            <span>{pd.name}</span>
            <span className="fl-legend-dim">
              {fmtNum(pd.dims.width, 1)} × {fmtNum(pd.dims.length, 1)} cm
              {pd.rotated ? ' ↻' : ''}
            </span>
          </div>
        ))}
        <div className="fl-legend-item">
          <div className="fl-legend-swatch fl-legend-swatch--hatch" />
          <span>Selvedge ({fmtNum(selvedgeCm, 1)} cm / side)</span>
        </div>
      </div>
    </div>
  )
}

// ── Width results table ───────────────────────────────────────────────────────
function WidthTable({ results, selectedWidthCm, onSelect }) {
  return (
    <div className="fl-width-table-wrap">
      <table className="fl-width-table">
        <thead>
          <tr>
            <th>Width</th>
            <th>cm</th>
            <th>Panels / row</th>
            <th>Total length</th>
            <th>Wastage %</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => {
            const isSelected = Math.abs(r.cm - selectedWidthCm) < 0.1
            const isBest     = i === 0
            return (
              <tr key={r.label}
                className={`fl-width-row${isSelected ? ' fl-width-row--selected' : ''}${isBest ? ' fl-width-row--best' : ''}`}
                onClick={() => onSelect(r.cm, r.label)}>
                <td>
                  {r.label}
                  {isBest && <span className="fl-best-badge">Best</span>}
                  {r.isPreferred && <span className="fl-pref-badge">Your width</span>}
                </td>
                <td className="mono">{fmtNum(r.cm, 1)}</td>
                <td className="mono">
                  {r.layout.panelData.map(pd => `${pd.name}: ${pd.panelsPerRow || '—'}`).join(', ')}
                </td>
                <td className="mono">{fmtNum(r.layout.totalLengthM, 2)} m</td>
                <td className="mono">
                  <span className={`fl-wastage${r.layout.wastagePct > 25 ? ' fl-wastage--high' : r.layout.wastagePct < 12 ? ' fl-wastage--low' : ''}`}>
                    {fmtNum(r.layout.wastagePct, 1)}%
                  </span>
                </td>
                <td>
                  <button className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={e => { e.stopPropagation(); onSelect(r.cm, r.label) }}>
                    {isSelected ? '✓ Selected' : 'Use'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main FabricLayout component ───────────────────────────────────────────────
export default function FabricLayout() {
  const pd            = useLoomStore(s => s.sections.productDimensions) || { fabricWidth: '', fabricWidthUnit: 'inches', selvedgePerSide: '1', selvedgeUnit: 'inches', panels: [] }
  const header        = useLoomStore(s => s.header)
  const updateSection = useLoomStore(s => s.updateSection)
  const setPd         = updater => updateSection('productDimensions', updater)

  const panels      = pd.panels || []
  const fabricRows  = useLoomStore(s => s.sections.rawMaterials.rows.filter(r => r.materialType === 'fabric'))

  // ── State ─────────────────────────────────────────────────────────────────
  const [rowMode,          setRowMode]          = useState('separate')
  const [globalShrinkage,  setGlobalShrinkage]  = useState({ warp: '3', weft: '2', enabled: false })
  const [panelOverrides,   setPanelOverrides]   = useState({})
  const [rotations,        setRotations]        = useState({})
  const [selectedWidthCm,  setSelectedWidthCm]  = useState(null)
  const [selectedLabel,    setSelectedLabel]    = useState(null)
  const [preferredWidth,   setPreferredWidth]   = useState({ value: pd.fabricWidth || '', unit: pd.fabricWidthUnit || 'inches' })

  const toCm = (v, u) => u === 'inches' ? Number(v) * 2.54 : Number(v)
  const selvedgeCm    = toCm(pd.selvedgePerSide || 0, pd.selvedgeUnit)
  const preferredWidthCm = preferredWidth.value
    ? toCm(preferredWidth.value, preferredWidth.unit) : null

  // ── Run optimizer ─────────────────────────────────────────────────────────
  const results = useMemo(() => {
    if (!panels.length) return []
    return optimizeWidth({
      panels, selvedgeCm, globalShrinkage, panelShrinkageOverrides: panelOverrides,
      rowMode, rotations, orderQty: header.orderQty, markerEfficiency: 85,
      preferredWidthCm,
    })
  }, [panels, selvedgeCm, globalShrinkage, panelOverrides, rowMode, rotations, header.orderQty, preferredWidthCm])

  // Layout for selected width
  const selectedLayout = useMemo(() => {
    if (!selectedWidthCm || !panels.length) return results[0]?.layout || null
    const match = results.find(r => Math.abs(r.cm - selectedWidthCm) < 0.1)
    return match?.layout || null
  }, [selectedWidthCm, results])

  const activeFabricWidthCm = selectedWidthCm || results[0]?.cm || 0
  const activeLayout        = selectedLayout || results[0]?.layout || null

  if (panels.length === 0) {
    return (
      <div className="rm-empty">
        <p>No panels defined yet.</p>
        <p className="rm-empty-sub">Add panels in the Dimensions tab first.</p>
      </div>
    )
  }

  return (
    <div className="fl-section">

      {/* ── Controls ── */}
      <div className="fl-controls">

        {/* Row mode */}
        <div className="fl-control-group">
          <span className="rm-cell-label">Panel row arrangement</span>
          <div className="pr-unit-toggle">
            {[['separate', 'Separate rows'], ['mixed', 'Mixed rows']].map(([v, l]) => (
              <button key={v}
                className={`pr-unit-btn${rowMode === v ? ' pr-unit-btn--active' : ''}`}
                onClick={() => setRowMode(v)}>{l}</button>
            ))}
          </div>
        </div>

        {/* Shrinkage */}
        <div className="fl-control-group">
          <label className="toggle-row">
            <span className="toggle-label">Shrinkage allowance</span>
            <button
              className={`toggle-btn${globalShrinkage.enabled ? ' toggle-btn--on' : ''}`}
              onClick={() => setGlobalShrinkage(p => ({ ...p, enabled: !p.enabled }))}>
              <span className="toggle-knob" />
            </button>
          </label>
          {globalShrinkage.enabled && (
            <div className="fl-shrinkage-row">
              <div className="pr-field">
                <span className="rm-cell-label">Warp (length) %</span>
                <div className="qty-row">
                  <input type="number" className="input input-sm mono fl-shrink-input"
                    placeholder="3" min="0" max="30" step="0.5"
                    value={globalShrinkage.warp}
                    onChange={e => setGlobalShrinkage(p => ({ ...p, warp: e.target.value }))} />
                  <span className="unit-static">%</span>
                </div>
              </div>
              <div className="pr-field">
                <span className="rm-cell-label">Weft (width) %</span>
                <div className="qty-row">
                  <input type="number" className="input input-sm mono fl-shrink-input"
                    placeholder="2" min="0" max="30" step="0.5"
                    value={globalShrinkage.weft}
                    onChange={e => setGlobalShrinkage(p => ({ ...p, weft: e.target.value }))} />
                  <span className="unit-static">%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Per-panel controls ── */}
      <div className="fl-panel-controls">
        {panels.map((panel, i) => {
          const rot = rotations[panel.id] || 'auto'
          const override = panelOverrides[panel.id] || { enabled: false, warp: '3', weft: '2' }
          return (
            <div key={panel.id} className="fl-panel-ctrl">
              <div className="fl-panel-ctrl-header">
                <div className="pd-panel-index" style={{ width: 22, height: 22, fontSize: 12 }}>
                  {String.fromCharCode(65 + i)}
                </div>
                <span className="fl-panel-ctrl-name">{panel.name || `Panel ${String.fromCharCode(65 + i)}`}</span>
              </div>

              {/* Rotation */}
              <div className="fl-panel-ctrl-row">
                <span className="rm-cell-label">Rotation</span>
                <div className="pr-unit-toggle">
                  {[['auto','Auto'],['off','Fixed'],['on','Rotated']].map(([v, l]) => (
                    <button key={v}
                      className={`pr-unit-btn${rot === v ? ' pr-unit-btn--active' : ''}`}
                      onClick={() => setRotations(p => ({ ...p, [panel.id]: v }))}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Per-panel shrinkage override */}
              {globalShrinkage.enabled && (
                <div className="fl-panel-ctrl-row">
                  <label className="toggle-row" style={{ gap: 6 }}>
                    <span className="rm-cell-label" style={{ textTransform: 'none' }}>Override shrinkage</span>
                    <button className={`toggle-btn${override.enabled ? ' toggle-btn--on' : ''}`}
                      style={{ width: 30, height: 18 }}
                      onClick={() => setPanelOverrides(p => ({
                        ...p, [panel.id]: { ...override, enabled: !override.enabled }
                      }))}>
                      <span className="toggle-knob" style={{ width: 12, height: 12 }} />
                    </button>
                  </label>
                  {override.enabled && (
                    <div className="fl-shrinkage-row" style={{ marginTop: 6 }}>
                      {['warp','weft'].map(dir => (
                        <div key={dir} className="qty-row">
                          <span className="rm-cell-label" style={{ textTransform: 'none', marginRight: 4 }}>{dir}</span>
                          <input type="number" className="input input-sm mono fl-shrink-input"
                            placeholder="3" min="0" step="0.5"
                            value={override[dir]}
                            onChange={e => setPanelOverrides(p => ({
                              ...p, [panel.id]: { ...override, [dir]: e.target.value }
                            }))} />
                          <span className="unit-static">%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Preferred width input ── */}
      <div className="fl-preferred-width">
        <span className="rm-cell-label">Your preferred fabric width (optional)</span>
        <div className="qty-row">
          <input type="number" className="input input-sm mono"
            placeholder="e.g. 58" min="0" step="0.5"
            value={preferredWidth.value}
            onChange={e => setPreferredWidth(p => ({ ...p, value: e.target.value }))} />
          <select className="input input-sm mono unit-select" value={preferredWidth.unit}
            onChange={e => setPreferredWidth(p => ({ ...p, unit: e.target.value }))}>
            <option value="inches">in</option>
            <option value="cm">cm</option>
          </select>
        </div>
      </div>

      {/* ── Width results ── */}
      {results.length > 0 ? (
        <>
          <div className="fl-results-header">
            <span className="fl-results-title">Width Recommendations</span>
            <span className="fl-results-sub">
              Ranked by lowest wastage — click a row to select and update the diagram
            </span>
          </div>
          <WidthTable
            results={results}
            selectedWidthCm={activeFabricWidthCm}
            onSelect={(cm, label) => { setSelectedWidthCm(cm); setSelectedLabel(label) }}
          />
        </>
      ) : (
        <div className="rm-empty">
          <p className="rm-empty-sub">Fill in panel dimensions to see width recommendations.</p>
        </div>
      )}

      {/* ── Marker diagram ── */}
      {activeLayout && (
        <MarkerDiagram
          layout={activeLayout}
          fabricWidthCm={activeFabricWidthCm}
          selvedgeCm={selvedgeCm}
          panels={panels}
        />
      )}

      {/* ── Push selected width to Dimensions tab ── */}
      {activeFabricWidthCm > 0 && (
        <div className="fl-push-row">
          <button className="btn btn-ghost pd-push-btn"
            onClick={() => setPd(prev => ({
              ...prev,
              fabricWidth: String((activeFabricWidthCm / 2.54).toFixed(2)),
              fabricWidthUnit: 'inches',
            }))}>
            → Use this width in Dimensions tab
          </button>
          <span className="pd-linked-badge">
            {selectedLabel || results[0]?.label} · {fmtNum(activeFabricWidthCm / 2.54, 2)}" · {fmtNum(activeFabricWidthCm, 1)} cm
          </span>
        </div>
      )}
    </div>
  )
}
