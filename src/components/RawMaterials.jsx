import React from 'react'
import useLoomStore from '../store/useLoomStore'
import SectionFooter from '../ui/SectionFooter'

// ── Constants ─────────────────────────────────────────────────────────────────
const ROLES         = ['Warp', 'Weft Ground', 'Weft Effect', 'Weft Binder', 'Pile', 'Interlining', 'Other']
const COUNT_SYSTEMS = ['Ne', 'Nm', 'Denier', 'Tex']
const FABRIC_TYPES  = ['Woven', 'Knitted', 'Non-woven']
const MATERIAL_TYPES = ['yarn', 'fabric', 'filling']
const FILLING_TYPES = ['Polyfill / Polyester Fibre', 'Foam', 'Batting / Wadding', 'Silicone Fibre', 'Duck Down', 'Other']
const WEFT_ROLES    = ['Weft Ground', 'Weft Effect', 'Weft Binder', 'Pile', 'Interlining', 'Other']

const ROLE_COLORS = {
  'Warp':        '#3A5A8A',
  'Weft Ground': '#2D7A44',
  'Weft Effect': '#7A6B2D',
  'Weft Binder': '#7A2D6B',
  'Pile':        '#B86040',
  'Interlining': '#5A6A7A',
  'Other':       '#6B7A8A',
}
const FABRIC_STRIPE  = '#5A7A6A'
const FILLING_STRIPE = '#8A6A4A'

// ── ID generators ─────────────────────────────────────────────────────────────
const genId = () => `rm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

// ── Empty row factories ───────────────────────────────────────────────────────
const emptyYarnRow = () => ({
  id:           genId(),
  materialType: 'yarn',
  materialName: '',
  fibreContent: '',
  role:         'Warp',
  countSystem:  'Ne',
  countValue:   '',
  ply:          '1',
  inputMode:    'manual',   // 'manual' | 'auto'
  qty:          '',
  qtyUnit:      'kg',
  wastage:      '5',
  supplier:     '',
  price:        '',
  priceUnit:    '₹/kg',
  // AUTO mode fields
  epi:               '',
  ppi:               '',
  finishedWidth:     '',   // inches — shared warp/weft
  finishedLength:    '',   // cm — for weft/pile
  crimp:             '',   // % — default set per role
})

const emptyFabricRow = () => ({
  id:           genId(),
  materialType: 'fabric',
  materialName: '',
  composition:  '',
  role:         'Other',
  fabricType:   'Woven',
  count:        '',
  gsm:          '',
  width:        '',
  widthUnit:    'inches',
  qty:          '',
  qtyUnit:      'metres',
  wastage:      '5',
  supplier:     '',
  price:        '',
  priceUnit:    '₹/metre',
})

const emptyFillingRow = () => ({
  id:           genId(),
  materialType: 'filling',
  materialName: '',
  fillingType:  'Polyfill / Polyester Fibre',
  weightPerPiece: '',    // grams per piece
  wastage:      '5',
  supplier:     '',
  price:        '',      // ₹/kg
})

// ── kg → ₹/metre converter helper ────────────────────────────────────────────
// Cost per metre = GSM × width_m × price_per_kg / 1000
export function calcFabricCostPerMetre(gsm, widthCm, pricePerKg) {
  const g = Number(gsm) || 0
  const w = Number(widthCm) || 0
  const p = Number(pricePerKg) || 0
  if (!g || !w || !p) return 0
  return (g * (w / 100) * p) / 1000
}
function toNe(countValue, countSystem, ply) {
  const val = Number(countValue) || 0
  const p   = Number(ply)        || 1
  if (val <= 0) return 0
  let ne
  switch (countSystem) {
    case 'Ne':     ne = val; break
    case 'Nm':     ne = val / 1.693; break
    case 'Denier': ne = 5315 / val;  break
    case 'Tex':    ne = 590.5 / val; break
    default:       ne = val
  }
  return ne / p   // ply divides the effective count
}

// ── GSM formula ───────────────────────────────────────────────────────────────
// Warp:  g/m² = (EPI × 39.384 × 453.4 × (crimp+100)) / (Ne × 0.914 × 840 × 100)
// Weft:  g/m² = (PPI × 39.384 × 453.4 × (crimp+100)) / (Ne × 0.914 × 840 × 100)
function calcGSM(epiOrPpi, ne, crimpPct) {
  if (!epiOrPpi || !ne) return 0
  const crimp = Number(crimpPct) || 0
  return (Number(epiOrPpi) * 39.384 * 453.4 * (crimp + 100)) /
         (ne * 0.914 * 840 * 100)
}

// ── kg/piece from g/m² ────────────────────────────────────────────────────────
function calcKgPerPiece(gsmVal, widthInches, lengthCm) {
  const widthM  = (Number(widthInches) || 0) * 0.0254
  const lengthM = (Number(lengthCm)    || 0) / 100
  const areaM2  = widthM * lengthM
  return (gsmVal * areaM2) / 1000
}

// ── Exported subtotal (used by SummaryPanel + App badge) ─────────────────────
export function calcRowSubtotal(row) {
  const waste = Number(row.wastage) || 0
  const price = Number(row.price)   || 0

  if (row.materialType === 'filling') {
    // weightPerPiece is in grams; price is ₹/kg
    const gPerPiece = Number(row.weightPerPiece) || 0
    const kgPerPiece = gPerPiece / 1000
    return kgPerPiece * (1 + waste / 100) * price
  }

  if (row.materialType === 'fabric') {
    return (Number(row.qty) || 0) * (1 + waste / 100) * price
  }

  // Yarn — AUTO mode
  if (row.inputMode === 'auto') {
    const ne    = toNe(row.countValue, row.countSystem, row.ply)
    const isWarp = row.role === 'Warp'
    const defaultCrimp = isWarp ? 5 : 8
    const crimp = row.crimp !== '' ? Number(row.crimp) : defaultCrimp
    const gsm   = isWarp
      ? calcGSM(row.epi, ne, crimp)
      : calcGSM(row.ppi, ne, crimp)
    const kgPc  = calcKgPerPiece(gsm, row.finishedWidth, row.finishedLength)
    return kgPc * (1 + waste / 100) * price
  }

  // Yarn — MANUAL mode
  const qty   = Number(row.qty) || 0
  const kgQty = row.qtyUnit === 'g' ? qty / 1000 : qty
  return kgQty * (1 + waste / 100) * price
}

// ── Get computed kg/piece for a yarn row in AUTO mode (for display) ───────────
export function getAutoComputed(row) {
  if (row.inputMode !== 'auto' || row.materialType !== 'yarn') return null
  const ne       = toNe(row.countValue, row.countSystem, row.ply)
  const isWarp   = row.role === 'Warp'
  const defCrimp = isWarp ? 5 : 8
  const crimp    = row.crimp !== '' ? Number(row.crimp) : defCrimp
  const epiPpi   = isWarp ? Number(row.epi) : Number(row.ppi)
  const gsm      = calcGSM(epiPpi, ne, crimp)
  const kgPc     = calcKgPerPiece(gsm, row.finishedWidth, row.finishedLength)
  return { gsm, kgPc, ne, epiPpi, crimp }
}

// ── Get aggregate PPI from weft AUTO rows (for Labour ₹/pick) ────────────────
export function getAggregatePPI(rows) {
  const weftAuto = rows.filter(
    r => r.materialType === 'yarn' && r.inputMode === 'auto' && WEFT_ROLES.includes(r.role)
  )
  if (weftAuto.length === 0) return null
  return weftAuto.reduce((acc, r) => acc + (Number(r.ppi) || 0), 0)
}

// ── Formatter ─────────────────────────────────────────────────────────────────
const inr = n =>
  `₹${Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const fmtNum = (n, dp = 3) => (Number(n) || 0).toFixed(dp)

// ── Cell ──────────────────────────────────────────────────────────────────────
function Cell({ label, children, width }) {
  return (
    <div className="rm-cell" style={width ? { flex: `0 0 ${width}px` } : {}}>
      {label && <span className="rm-cell-label">{label}</span>}
      {children}
    </div>
  )
}

// ── Type toggle ───────────────────────────────────────────────────────────────
function TypeToggle({ value, onChange }) {
  return (
    <div className="rm-type-toggle">
      {['yarn', 'fabric', 'filling'].map(t => (
        <button key={t}
          className={`rm-type-btn${value === t ? ' rm-type-btn--active' : ''}`}
          onClick={() => onChange(t)}>
          {t === 'yarn' ? '🧵 Yarn' : t === 'fabric' ? '🪢 Fabric' : '🧸 Filling'}
        </button>
      ))}
    </div>
  )
}

// ── Filling row ───────────────────────────────────────────────────────────────
function FillingRow({ row, onUpdate, onRemove }) {
  const set = (f, v) => onUpdate(row.id, f, v)
  const subtotal = calcRowSubtotal(row)
  const grams    = Number(row.weightPerPiece) || 0
  const waste    = Number(row.wastage) || 0
  const price    = Number(row.price) || 0
  const kgPc     = (grams / 1000) * (1 + waste / 100)

  return (
    <div className="rm-row-card rm-row-card--filling">
      <div className="rm-row-header">
        <TypeToggle value="filling"
          onChange={t => {
            if (t === 'yarn')   onUpdate(row.id, '_switchToYarn', null)
            if (t === 'fabric') onUpdate(row.id, '_switchToFabric', null)
          }} />
        <button className="btn btn-sm btn-danger rm-remove" onClick={() => onRemove(row.id)}>✕</button>
      </div>

      <div className="rm-row-line">
        <Cell label="Material Name">
          <input type="text" className="input input-sm"
            placeholder="e.g. Polyfill, Duck Down"
            value={row.materialName}
            onChange={e => set('materialName', e.target.value)} />
        </Cell>
        <Cell label="Filling Type">
          <select className="input input-sm" value={row.fillingType}
            onChange={e => set('fillingType', e.target.value)}>
            {FILLING_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </Cell>
        <Cell label="Supplier">
          <input type="text" className="input input-sm"
            placeholder="Supplier name"
            value={row.supplier || ''}
            onChange={e => set('supplier', e.target.value)} />
        </Cell>
      </div>

      <div className="rm-row-line">
        <Cell label="Weight / Piece (g)">
          <div className="qty-row">
            <input type="number" className="input input-sm mono"
              placeholder="0" min="0" step="1"
              value={row.weightPerPiece}
              onChange={e => set('weightPerPiece', e.target.value)} />
            <span className="unit-static">g</span>
          </div>
          {grams > 0 && <span className="qty-auto-tag">{fmtNum(kgPc, 4)} kg/pc incl. wastage</span>}
        </Cell>
        <Cell label="Wastage %">
          <div className="qty-row">
            <input type="number" className="input input-sm mono"
              placeholder="5" min="0" max="50" step="0.5"
              value={row.wastage}
              onChange={e => set('wastage', e.target.value)} />
            <span className="unit-static">%</span>
          </div>
        </Cell>
        <Cell label="Price (₹/kg)">
          <input type="number" className="input input-sm mono"
            placeholder="0.00" min="0" step="0.01"
            value={row.price}
            onChange={e => set('price', e.target.value)} />
        </Cell>
        <Cell label="Subtotal">
          <div className={`rm-subtotal${subtotal > 0 ? ' rm-subtotal--active' : ''}`}>
            {inr(subtotal)}
          </div>
        </Cell>
      </div>
    </div>
  )
}

// ── Input mode toggle (MANUAL | AUTO) ─────────────────────────────────────────
function ModeToggle({ value, onChange }) {
  return (
    <div className="rm-mode-toggle">
      {['manual', 'auto'].map(m => (
        <button key={m}
          className={`rm-mode-btn${value === m ? ' rm-mode-btn--active' : ''}`}
          onClick={() => onChange(m)}>
          {m === 'manual' ? 'Manual' : '⚡ AUTO'}
        </button>
      ))}
    </div>
  )
}

// ── AUTO fields for yarn row ──────────────────────────────────────────────────
function AutoFields({ row, set }) {
  const isWarp   = row.role === 'Warp'
  const defCrimp = isWarp ? 5 : 8
  const computed = getAutoComputed(row)

  return (
    <div className="auto-fields">
      <div className="rm-row-line">
        {isWarp ? (
          <Cell label="EPI (Ends per Inch)" width={140}>
            <input type="number" className="input input-sm mono"
              placeholder="0" min="0" value={row.epi}
              onChange={e => set('epi', e.target.value)} />
          </Cell>
        ) : (
          <Cell label="PPI (Picks per Inch)" width={140}>
            <input type="number" className="input input-sm mono"
              placeholder="0" min="0" value={row.ppi}
              onChange={e => set('ppi', e.target.value)} />
          </Cell>
        )}

        <Cell label="Finished Width" width={130}>
          <div className="qty-row">
            <input type="number" className="input input-sm mono"
              placeholder="0" min="0" step="0.1" value={row.finishedWidth}
              onChange={e => set('finishedWidth', e.target.value)} />
            <span className="unit-static">in</span>
          </div>
        </Cell>

        {!isWarp && (
          <Cell label="Finished Length" width={130}>
            <div className="qty-row">
              <input type="number" className="input input-sm mono"
                placeholder="0" min="0" step="0.1" value={row.finishedLength}
                onChange={e => set('finishedLength', e.target.value)} />
              <span className="unit-static">cm</span>
            </div>
          </Cell>
        )}

        {isWarp && (
          <Cell label="Finished Length (cm)" width={150}>
            <div className="qty-row">
              <input type="number" className="input input-sm mono"
                placeholder="0" min="0" step="0.1" value={row.finishedLength}
                onChange={e => set('finishedLength', e.target.value)} />
              <span className="unit-static">cm</span>
            </div>
          </Cell>
        )}

        <Cell label={`Crimp % (default ${defCrimp}%)`} width={130}>
          <div className="qty-row">
            <input type="number" className="input input-sm mono"
              placeholder={String(defCrimp)} min="0" max="50" step="0.1"
              value={row.crimp}
              onChange={e => set('crimp', e.target.value)} />
            <span className="unit-static">%</span>
          </div>
        </Cell>
      </div>

      {/* Computed values */}
      {computed && (computed.gsm > 0 || computed.kgPc > 0) && (
        <div className="auto-computed">
          <div className="auto-computed-chip">
            <span className="auto-computed-label">g/m²</span>
            <span className="auto-computed-value mono">{fmtNum(computed.gsm, 2)}</span>
          </div>
          <div className="auto-computed-chip">
            <span className="auto-computed-label">kg/piece</span>
            <span className="auto-computed-value mono">{fmtNum(computed.kgPc, 4)}</span>
          </div>
          {computed.ne > 0 && (
            <div className="auto-computed-chip auto-computed-chip--muted">
              <span className="auto-computed-label">Effective Ne</span>
              <span className="auto-computed-value mono">{fmtNum(computed.ne, 2)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Yarn row ──────────────────────────────────────────────────────────────────
function YarnRow({ row, set }) {
  const roleColor  = ROLE_COLORS[row.role] || '#6B7A8A'
  const isAuto     = row.inputMode === 'auto'

  return (
    <>
      <div className="rm-row-line">
        <Cell label="Material Name">
          <input type="text" className="input input-sm"
            placeholder="e.g. Warp Yarn, Cotton Ne 40"
            value={row.materialName}
            onChange={e => set('materialName', e.target.value)} />
        </Cell>
        <Cell label="Fibre Content">
          <input type="text" className="input input-sm"
            placeholder="e.g. 100% Cotton"
            value={row.fibreContent}
            onChange={e => set('fibreContent', e.target.value)} />
        </Cell>
        <Cell label="Role" width={130}>
          <select className="input input-sm" value={row.role}
            onChange={e => set('role', e.target.value)}
            style={{ color: roleColor, fontWeight: 500 }}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Cell>
      </div>

      <div className="rm-row-line">
        <Cell label="Count System" width={100}>
          <select className="input input-sm mono" value={row.countSystem}
            onChange={e => set('countSystem', e.target.value)}>
            {COUNT_SYSTEMS.map(c => <option key={c}>{c}</option>)}
          </select>
        </Cell>
        <Cell label="Count Value" width={90}>
          <input type="number" className="input input-sm mono"
            placeholder="0" min="0" value={row.countValue}
            onChange={e => set('countValue', e.target.value)} />
        </Cell>
        <Cell label="Ply" width={60}>
          <input type="number" className="input input-sm mono"
            placeholder="1" min="1" value={row.ply}
            onChange={e => set('ply', e.target.value)} />
        </Cell>

        {/* Input mode toggle */}
        <Cell label="Input Mode" width={140}>
          <ModeToggle value={row.inputMode || 'manual'}
            onChange={v => set('inputMode', v)} />
        </Cell>

        {/* Manual qty — only when not auto */}
        {!isAuto && (
          <>
            <Cell label="Qty / Piece">
              <div className="qty-row">
                <input type="number" className="input input-sm mono"
                  placeholder="0" min="0" step="0.001" value={row.qty}
                  onChange={e => set('qty', e.target.value)} />
                <select className="input input-sm mono unit-select" value={row.qtyUnit}
                  onChange={e => set('qtyUnit', e.target.value)}>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                </select>
              </div>
            </Cell>
            <Cell label="Wastage %" width={80}>
              <div className="qty-row">
                <input type="number" className="input input-sm mono"
                  placeholder="5" min="0" max="100" value={row.wastage}
                  onChange={e => set('wastage', e.target.value)} />
                <span className="unit-static">%</span>
              </div>
            </Cell>
          </>
        )}

        {/* When AUTO, show wastage only */}
        {isAuto && (
          <Cell label="Wastage %" width={80}>
            <div className="qty-row">
              <input type="number" className="input input-sm mono"
                placeholder="5" min="0" max="100" value={row.wastage}
                onChange={e => set('wastage', e.target.value)} />
              <span className="unit-static">%</span>
            </div>
          </Cell>
        )}
      </div>

      {/* AUTO fields */}
      {isAuto && <AutoFields row={row} set={set} />}

      <div className="rm-row-line rm-row-line--price">
        <Cell label="Supplier">
          <input type="text" className="input input-sm"
            placeholder="Supplier name (optional)" value={row.supplier}
            onChange={e => set('supplier', e.target.value)} />
        </Cell>
        <Cell label="Price (₹/kg)" width={120}>
          <input type="number" className="input input-sm mono"
            placeholder="0.00" min="0" step="0.01" value={row.price}
            onChange={e => set('price', e.target.value)} />
        </Cell>
      </div>
    </>
  )
}

// ── Fabric row ────────────────────────────────────────────────────────────────
function FabricRow({ row, set }) {
  const roleColor = ROLE_COLORS[row.role] || '#6B7A8A'
  return (
    <>
      <div className="rm-row-line">
        <Cell label="Material Name">
          <input type="text" className="input input-sm"
            placeholder="e.g. Grey Fabric, Lining, Base Cloth"
            value={row.materialName}
            onChange={e => set('materialName', e.target.value)} />
        </Cell>
        <Cell label="Role" width={130}>
          <select className="input input-sm" value={row.role}
            onChange={e => set('role', e.target.value)}
            style={{ color: roleColor, fontWeight: 500 }}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Cell>
        <Cell label="Fabric Type" width={110}>
          <select className="input input-sm" value={row.fabricType}
            onChange={e => set('fabricType', e.target.value)}>
            {FABRIC_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </Cell>
      </div>

      <div className="rm-row-line">
        <Cell label="Composition">
          <input type="text" className="input input-sm"
            placeholder="e.g. 100% Cotton, 55% Linen 45% Cotton"
            value={row.composition}
            onChange={e => set('composition', e.target.value)} />
        </Cell>
        <Cell label="Count" width={100}>
          <input type="text" className="input input-sm mono"
            placeholder="e.g. 40s" value={row.count}
            onChange={e => set('count', e.target.value)} />
        </Cell>
        <Cell label="GSM" width={90}>
          <div className="qty-row">
            <input type="number" className="input input-sm mono"
              placeholder="0" min="0" value={row.gsm}
              onChange={e => set('gsm', e.target.value)} />
            <span className="unit-static">g/m²</span>
          </div>
        </Cell>
        <Cell label="Width" width={130}>
          <div className="qty-row">
            <input type="number" className="input input-sm mono"
              placeholder="0" min="0" value={row.width}
              onChange={e => set('width', e.target.value)} />
            <select className="input input-sm mono unit-select" value={row.widthUnit}
              onChange={e => set('widthUnit', e.target.value)}>
              <option value="inches">in</option>
              <option value="cm">cm</option>
            </select>
          </div>
        </Cell>
      </div>

      <div className="rm-row-line rm-row-line--price">
        <Cell label="Qty / Piece">
          <div className="qty-row">
            <input type="number" className="input input-sm mono"
              placeholder="0" min="0" step="0.01" value={row.qty}
              onChange={e => set('qty', e.target.value)} />
            <select className="input input-sm mono unit-select" value={row.qtyUnit}
              onChange={e => set('qtyUnit', e.target.value)}>
              <option value="metres">m</option>
              <option value="kg">kg</option>
            </select>
          </div>
        </Cell>
        <Cell label="Wastage %" width={80}>
          <div className="qty-row">
            <input type="number" className="input input-sm mono"
              placeholder="5" min="0" max="100" value={row.wastage}
              onChange={e => set('wastage', e.target.value)} />
            <span className="unit-static">%</span>
          </div>
        </Cell>
        <Cell label="Supplier">
          <input type="text" className="input input-sm"
            placeholder="Supplier name (optional)" value={row.supplier}
            onChange={e => set('supplier', e.target.value)} />
        </Cell>
        <Cell label="Price" width={160}>
          <div className="qty-row">
            <input type="number" className="input input-sm mono"
              placeholder="0.00" min="0" step="0.01" value={row.price}
              onChange={e => set('price', e.target.value)} />
            <select className="input input-sm mono unit-select" value={row.priceUnit}
              onChange={e => set('priceUnit', e.target.value)}
              style={{ flex: '0 0 76px' }}>
              <option value="₹/metre">₹/m</option>
              <option value="₹/kg">₹/kg</option>
            </select>
          </div>
          {/* kg→₹/metre converter hint */}
          {row.priceUnit === '₹/kg' && row.gsm && row.width && row.price && (
            <span className="qty-auto-tag" style={{ marginTop: 3 }}>
              ≈ {inr(calcFabricCostPerMetre(
                row.gsm,
                row.widthUnit === 'inches' ? Number(row.width) * 2.54 : Number(row.width),
                row.price
              ))}/m
            </span>
          )}
        </Cell>
      </div>
    </>
  )
}

// ── Combined row wrapper ───────────────────────────────────────────────────────
function MaterialRow({ row, index, onUpdate, onRemove }) {
  const isFilling   = row.materialType === 'filling'
  const isFabric    = row.materialType === 'fabric'
  const subtotal    = calcRowSubtotal(row)
  const stripeColor = isFilling ? FILLING_STRIPE : isFabric ? FABRIC_STRIPE : (ROLE_COLORS[row.role] || '#6B7A8A')
  const set         = (field, value) => onUpdate(row.id, field, value)

  // Delegate filling rows to their own component
  if (isFilling) {
    return (
      <div className="rm-row">
        <div className="rm-row-index" style={{ '--role-color': stripeColor }}>
          <span className="rm-row-num">{index + 1}</span>
        </div>
        <div className="rm-row-body" style={{ padding: 0 }}>
          <FillingRow row={row} onUpdate={onUpdate} onRemove={onRemove} />
        </div>
      </div>
    )
  }

  const handleTypeChange = newType => {
    if (newType === 'fabric')  onUpdate(row.id, '_switchToFabric',  true)
    else if (newType === 'filling') onUpdate(row.id, '_switchToFilling', true)
    else                       onUpdate(row.id, '_switchToYarn',    true)
  }

  return (
    <div className="rm-row">
      <div className="rm-row-index" style={{ '--role-color': stripeColor }}>
        <span className="rm-row-num">{index + 1}</span>
      </div>

      <div className="rm-row-body">
        <div className="rm-row-line rm-type-line">
          <TypeToggle value={row.materialType || 'yarn'} onChange={handleTypeChange} />
          {isFabric && <span className="rm-fabric-badge">Fabric Purchase</span>}
          {!isFabric && row.inputMode === 'auto' && (
            <span className="rm-auto-badge">⚡ AUTO</span>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <button className="btn btn-sm btn-danger"
              onClick={() => onRemove(row.id)} title="Remove">✕</button>
          </div>
        </div>

        {isFabric
          ? <FabricRow row={row} set={set} />
          : <YarnRow   row={row} set={set} />
        }

        <div className="rm-row-line rm-row-line--price" style={{ borderTop: 'none', paddingTop: 4 }}>
          <Cell label="Subtotal" width={120}>
            <div className={`rm-subtotal${subtotal > 0 ? ' rm-subtotal--active' : ''}`}>
              {inr(subtotal)}
            </div>
          </Cell>
        </div>
      </div>
    </div>
  )
}

// ── Weave surcharge calculator (exported for SummaryPanel + App) ──────────────
export function calcWeaveSurcharge(rm, weaveType) {
  const baseSubtotal = rm.rows.reduce((acc, r) => acc + calcRowSubtotal(r), 0)
  if (weaveType === 'Dobby') {
    const pct = Number(rm.dobbySurcharge) || 0
    return { dobby: baseSubtotal * pct / 100, jacquardPremium: 0, jacquardSetup: 0 }
  }
  if (weaveType === 'Jacquard') {
    const pct     = Number(rm.jacquardPremium)   || 0
    const setup   = Number(rm.jacquardSetupCost) || 0
    return {
      dobby: 0,
      jacquardPremium: baseSubtotal * pct / 100,
      jacquardSetup: setup,
    }
  }
  return { dobby: 0, jacquardPremium: 0, jacquardSetup: 0 }
}

// ── Weave surcharge block (shown inside Section 1) ────────────────────────────
function WeaveSurchargeBlock({ rm, weaveType, orderQty, orderLength, setRm }) {
  const baseSubtotal = rm.rows.reduce((acc, r) => acc + calcRowSubtotal(r), 0)
  const qty    = Number(orderQty)     || 0
  const metres = Number(orderLength)  || 0

  if (weaveType === 'Dobby') {
    const pct       = Number(rm.dobbySurcharge) || 0
    const surcharge = baseSubtotal * pct / 100
    return (
      <div className="weave-block weave-block--dobby">
        <div className="weave-block-header">
          <span className="weave-notice-icon">◈</span>
          <span className="weave-block-title">Dobby Surcharge</span>
          <span className="weave-block-hint">
            Covers extra warp ends, dobby loom complexity, and slower production speed
          </span>
        </div>
        <div className="weave-block-fields">
          <div className="pr-field" style={{ flex: '0 0 160px' }}>
            <span className="rm-cell-label">Surcharge %</span>
            <div className="qty-row">
              <input type="number" className="input input-sm mono"
                placeholder="10" min="0" max="100" step="0.5"
                value={rm.dobbySurcharge}
                onChange={e => setRm(prev => ({ ...prev, dobbySurcharge: e.target.value }))} />
              <span className="unit-static">%</span>
            </div>
            <span className="pr-field-hint">Typical: 10–20%</span>
          </div>
          <div className="pr-field">
            <span className="rm-cell-label">Applied to Raw Materials</span>
            <div className="rm-subtotal rm-subtotal--active weave-block-result">
              {inr(surcharge)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (weaveType === 'Jacquard') {
    const pct         = Number(rm.jacquardPremium)   || 0
    const setupCost   = Number(rm.jacquardSetupCost) || 0
    const premium     = baseSubtotal * pct / 100
    const setupPerM   = metres > 0 ? setupCost / metres : 0
    const setupPerPc  = qty    > 0 ? setupCost / qty    : 0
    return (
      <div className="weave-block weave-block--jacquard">
        <div className="weave-block-header">
          <span className="weave-notice-icon">◈</span>
          <span className="weave-block-title">Jacquard Premium & Setup</span>
        </div>
        <div className="weave-block-fields">
          <div className="pr-field" style={{ flex: '0 0 160px' }}>
            <span className="rm-cell-label">Jacquard Premium %</span>
            <div className="qty-row">
              <input type="number" className="input input-sm mono"
                placeholder="35" min="0" max="100" step="0.5"
                value={rm.jacquardPremium}
                onChange={e => setRm(prev => ({ ...prev, jacquardPremium: e.target.value }))} />
              <span className="unit-static">%</span>
            </div>
            <span className="pr-field-hint">Simple 25–35% · Medium 35–50% · Complex 50–70%</span>
          </div>
          <div className="pr-field">
            <span className="rm-cell-label">Premium on Raw Materials</span>
            <div className="rm-subtotal rm-subtotal--active weave-block-result">
              {inr(premium)}
            </div>
          </div>
          <div className="pr-field" style={{ flex: '0 0 180px' }}>
            <span className="rm-cell-label">One-time Setup Cost (₹)</span>
            <input type="number" className="input input-sm mono"
              placeholder="0.00" min="0" step="1"
              value={rm.jacquardSetupCost}
              onChange={e => setRm(prev => ({ ...prev, jacquardSetupCost: e.target.value }))} />
          </div>
          <div className="pr-field">
            <span className="rm-cell-label">Setup Amortised</span>
            <div className="weave-amort-chips">
              <div className="weave-amort-chip">
                <span>{metres > 0 ? inr(setupPerM) : '—'}</span>
                <span className="weave-amort-unit">₹/m</span>
              </div>
              <div className="weave-amort-chip weave-amort-chip--piece">
                <span>{qty > 0 ? inr(setupPerPc) : '—'}</span>
                <span className="weave-amort-unit">₹/piece</span>
              </div>
            </div>
            {(!metres || !qty) && (
              <span className="pr-field-hint">Enter order qty & length in header</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}

// ── Section-level GSM summary ─────────────────────────────────────────────────
function GSMSummary({ rows }) {
  const autoRows = rows.filter(r => r.materialType === 'yarn' && r.inputMode === 'auto')
  if (autoRows.length === 0) return null

  const warpGSM = autoRows
    .filter(r => r.role === 'Warp')
    .reduce((acc, r) => {
      const c = getAutoComputed(r)
      return acc + (c ? c.gsm : 0)
    }, 0)

  const weftGSM = autoRows
    .filter(r => r.role !== 'Warp')
    .reduce((acc, r) => {
      const c = getAutoComputed(r)
      return acc + (c ? c.gsm : 0)
    }, 0)

  const totalGSM = warpGSM + weftGSM

  return (
    <div className="gsm-summary">
      <span className="gsm-summary-label">Computed GSM</span>
      <div className="gsm-chips">
        {warpGSM > 0 && (
          <div className="gsm-chip">
            <span>Warp</span>
            <span className="mono">{fmtNum(warpGSM, 1)}</span>
          </div>
        )}
        {weftGSM > 0 && (
          <div className="gsm-chip">
            <span>Weft</span>
            <span className="mono">{fmtNum(weftGSM, 1)}</span>
          </div>
        )}
        <div className="gsm-chip gsm-chip--total">
          <span>Total</span>
          <span className="mono">{fmtNum(totalGSM, 1)} g/m²</span>
        </div>
      </div>
      <span className="gsm-hint">Validate against physical spec sheet</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RawMaterials() {
  const rm            = useLoomStore(s => s.sections.rawMaterials)
  const header        = useLoomStore(s => s.header)
  const orderQty      = header.orderQty
  const updateSection = useLoomStore(s => s.updateSection)
  const setRm         = updater => updateSection('rawMaterials', updater)

  const addYarnRow    = () => setRm(prev => ({ ...prev, rows: [...prev.rows, emptyYarnRow()] }))
  const addFabricRow  = () => setRm(prev => ({ ...prev, rows: [...prev.rows, emptyFabricRow()] }))
  const addFillingRow = () => setRm(prev => ({ ...prev, rows: [...prev.rows, emptyFillingRow()] }))

  const updateRow = (id, field, value) =>
    setRm(prev => ({
      ...prev,
      rows: prev.rows.map(r => {
        if (r.id !== id) return r
        if (field === '_switchToFabric')  return { ...emptyFabricRow(),  id: r.id, materialName: r.materialName }
        if (field === '_switchToYarn')    return { ...emptyYarnRow(),    id: r.id, materialName: r.materialName }
        if (field === '_switchToFilling') return { ...emptyFillingRow(), id: r.id, materialName: r.materialName }
        return { ...r, [field]: value }
      }),
    }))

  const removeRow = id => setRm(prev => ({ ...prev, rows: prev.rows.filter(r => r.id !== id) }))

  const subtotal      = rm.rows.reduce((acc, r) => acc + calcRowSubtotal(r), 0)
  const yarnCount     = rm.rows.filter(r => (r.materialType || 'yarn') === 'yarn').length
  const fabricCount   = rm.rows.filter(r => r.materialType === 'fabric').length
  const fillingCount  = rm.rows.filter(r => r.materialType === 'filling').length

  return (
    <div className="rm-section">
      {rm.rows.length === 0 ? (
        <div className="rm-empty">
          <p>No materials added yet.</p>
          <p className="rm-empty-sub">Add yarn for weaving, or purchase fabric directly.</p>
        </div>
      ) : (
        <div className="rm-rows">
          {rm.rows.map((row, i) => (
            <MaterialRow key={row.id} row={row} index={i}
              onUpdate={updateRow} onRemove={removeRow} />
          ))}
        </div>
      )}

      {/* Section-level GSM summary */}
      <GSMSummary rows={rm.rows} />

      <div className="rm-footer">
        <div className="rm-add-btns">
          <button className="btn btn-ghost btn-add-row" onClick={addYarnRow}>+ Add Yarn</button>
          <button className="btn btn-ghost btn-add-row" onClick={addFabricRow}>+ Add Fabric</button>
          <button className="btn btn-ghost btn-add-row" onClick={addFillingRow}>+ Add Filling</button>
        </div>

        {rm.rows.length > 0 && (
          <div className="rm-total-row">
            <span className="rm-total-label">
              Raw Materials Subtotal
              <span className="rm-row-count">
                ({[yarnCount > 0 && `${yarnCount} yarn`, fabricCount > 0 && `${fabricCount} fabric`, fillingCount > 0 && `${fillingCount} filling`].filter(Boolean).join(', ')})
              </span>
            </span>
            <span className="rm-total-value mono">{inr(subtotal)}</span>
          </div>
        )}
      </div>

      {/* Weave surcharge block — Dobby / Jacquard */}
      {header.weaveType !== 'Plain / Twill / Satin' && (
        <WeaveSurchargeBlock
          rm={rm}
          weaveType={header.weaveType}
          orderQty={header.orderQty}
          orderLength={header.orderLength}
          setRm={setRm}
        />
      )}

      <SectionFooter
        label="Raw Materials"
        baseCostPerPiece={subtotal}
        orderQty={orderQty}
        allowancePct={rm.allowancePct || ''}
        onAllowanceChange={v => setRm(prev => ({ ...prev, allowancePct: v }))}
        show={rm.rows.length > 0}
      />
    </div>
  )
}
