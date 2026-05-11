import React from 'react'
import useLoomStore from '../store/useLoomStore'
import SectionFooter from '../ui/SectionFooter'

// ── Constants ─────────────────────────────────────────────────────────────────
const METHODS      = ['TBD', 'Digital', 'Pigment', 'Reactive', 'Discharge', 'Resist / Batik / Wax', 'Table Screen', 'Rotary Screen', 'Heat Transfer']
const DIGITAL_UNITS = ['₹/m', '₹/sq.in', '₹/piece']
const SCREEN_UNITS  = ['₹/m', '₹/piece']
// Methods that use screen/process cost structure
const SCREEN_METHODS = ['Table Screen', 'Rotary Screen']
// Methods that use combined rate structure (same as digital)
const COMBINED_METHODS = ['Pigment', 'Reactive', 'Discharge', 'Resist / Batik / Wax', 'Heat Transfer']

// ── Formatters ────────────────────────────────────────────────────────────────
const inr = n =>
  `₹${Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
const num = v => Number(v) || 0

// ── Subtotal calculator (exported for SummaryPanel + App badge) ───────────────
export function calcPrintingSubtotal(printing, orderQty) {
  if (!printing.enabled) return 0
  const { method, data } = printing
  const d   = data || {}
  const qty = num(orderQty)

  if (method === 'TBD') {
    return num(d.flatRate) * num(d.metresPerPiece)
  }

  if (method === 'Digital' || COMBINED_METHODS.includes(method)) {
    let basePerPiece = 0
    if (d.rateUnit === '₹/piece') {
      basePerPiece = num(d.combinedRate)
    } else if (d.rateUnit === '₹/sq.in') {
      const sqIn = num(d.widthInches) * num(d.lengthMetres) * 39.3701
      basePerPiece = num(d.combinedRate) * sqIn
    } else {
      basePerPiece = num(d.combinedRate) * num(d.metresPerPiece)
    }
    const prePerPiece  = d.preTreatment ? num(d.preTreatmentRate) * num(d.metresPerPiece) : 0
    const curePerPiece = d.curing       ? num(d.curingRate)        * num(d.metresPerPiece) : 0
    const washPerPiece = d.washing      ? num(d.washingRate)       * num(d.metresPerPiece) : 0
    return basePerPiece + prePerPiece + curePerPiece + washPerPiece
  }

  if (SCREEN_METHODS.includes(method)) {
    const colours     = num(d.numColours)
    const mpp         = num(d.metresPerPiece)
    const screenAmort = qty > 0 ? (num(d.screenCostPerColour) * colours) / qty : 0
    let processPerPiece = 0
    if (d.processUnit === '₹/piece') {
      processPerPiece = num(d.processRate)
    } else {
      processPerPiece = num(d.processRate) * mpp
    }
    const curePerPiece  = d.curing  ? num(d.curingRate)  * mpp : 0
    const washPerPiece  = d.washing ? num(d.washingRate)  * mpp : 0
    return screenAmort + processPerPiece + curePerPiece + washPerPiece
  }

  return 0
}

// ── Reusable sub-components ───────────────────────────────────────────────────
function Toggle({ value, onChange, label }) {
  return (
    <label className="toggle-row">
      <span className="toggle-label">{label}</span>
      <button
        className={`toggle-btn${value ? ' toggle-btn--on' : ''}`}
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
      >
        <span className="toggle-knob" />
      </button>
    </label>
  )
}

function Field({ label, hint, children, width, span2 }) {
  return (
    <div
      className="pr-field"
      style={{
        ...(width  ? { flex: `0 0 ${width}px` } : {}),
        ...(span2  ? { gridColumn: '1 / -1' }   : {}),
      }}
    >
      <span className="rm-cell-label">{label}</span>
      {children}
      {hint && <span className="pr-field-hint">{hint}</span>}
    </div>
  )
}

function RateInput({ value, onChange, placeholder = '0.00', unit }) {
  return (
    <div className="pr-rate-row">
      <input
        type="number"
        className="input input-sm mono"
        placeholder={placeholder}
        min="0"
        step="0.01"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
      />
      {unit && <span className="pr-unit">{unit}</span>}
    </div>
  )
}

function ReadOnly({ label, value }) {
  return (
    <Field label={label}>
      <div className="rm-subtotal rm-subtotal--active">{value}</div>
    </Field>
  )
}

// ── Optional checkbox row ─────────────────────────────────────────────────────
function OptionalField({ label, hint, checked, onToggle, children }) {
  return (
    <div className="pr-optional">
      <label className="pr-optional-label">
        <input
          type="checkbox"
          className="pr-checkbox"
          checked={checked}
          onChange={e => onToggle(e.target.checked)}
        />
        <span>{label}</span>
        {hint && <span className="pr-optional-hint">{hint}</span>}
      </label>
      {checked && (
        <div className="pr-optional-body">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Unit toggle (pill tabs) ───────────────────────────────────────────────────
function UnitToggle({ value, options, onChange }) {
  return (
    <div className="pr-unit-toggle">
      {options.map(u => (
        <button
          key={u}
          className={`pr-unit-btn${value === u ? ' pr-unit-btn--active' : ''}`}
          onClick={() => onChange(u)}
        >
          {u}
        </button>
      ))}
    </div>
  )
}

// ── TBD form ──────────────────────────────────────────────────────────────────
function TBDForm({ data, set }) {
  return (
    <div className="pr-form-row">
      <Field label="Estimated Rate">
        <RateInput value={data.flatRate} onChange={v => set('flatRate', v)} unit="₹/m" />
      </Field>
      <Field label="Metres / Piece">
        <RateInput value={data.metresPerPiece} onChange={v => set('metresPerPiece', v)} />
      </Field>
      <ReadOnly
        label="Subtotal / Piece"
        value={inr(num(data.flatRate) * num(data.metresPerPiece))}
      />
    </div>
  )
}

// ── Digital form ──────────────────────────────────────────────────────────────
function DigitalForm({ data, set, orderQty, subtotal }) {
  const rateUnit = data.rateUnit || '₹/m'

  return (
    <div className="pr-form-grid">
      {/* Combined rate + unit toggle */}
      <Field label="Combined Process Rate" span2>
        <div className="pr-combined-row">
          <UnitToggle
            value={rateUnit}
            options={DIGITAL_UNITS}
            onChange={v => set('rateUnit', v)}
          />
          <RateInput
            value={data.combinedRate}
            onChange={v => set('combinedRate', v)}
            unit={rateUnit}
          />
        </div>
        <p className="pr-field-hint">Covers machine, ink, and all included charges</p>
      </Field>

      {/* Area / length fields depend on rate unit */}
      {rateUnit === '₹/sq.in' && (
        <>
          <Field label="Print Width (inches)">
            <RateInput value={data.widthInches} onChange={v => set('widthInches', v)} unit="in" />
          </Field>
          <Field label="Print Length / Piece (metres)">
            <RateInput value={data.lengthMetres} onChange={v => set('lengthMetres', v)} unit="m" />
          </Field>
          <ReadOnly
            label="Area / Piece"
            value={`${(num(data.widthInches) * num(data.lengthMetres) * 39.3701).toFixed(1)} sq.in`}
          />
        </>
      )}

      {rateUnit === '₹/m' && (
        <Field label="Metres / Piece">
          <RateInput value={data.metresPerPiece} onChange={v => set('metresPerPiece', v)} unit="m" />
        </Field>
      )}

      {/* Optional lines */}
      <div className="pr-optionals" style={{ gridColumn: '1 / -1' }}>
        <OptionalField
          label="Pre-treatment"
          checked={!!data.preTreatment}
          onToggle={v => set('preTreatment', v)}
        >
          <RateInput value={data.preTreatmentRate} onChange={v => set('preTreatmentRate', v)} unit="₹/m" />
        </OptionalField>

        <OptionalField
          label="Curing"
          hint="Usually included in process rate — enable only if charged separately"
          checked={!!data.curing}
          onToggle={v => set('curing', v)}
        >
          <RateInput value={data.curingRate} onChange={v => set('curingRate', v)} unit="₹/m" />
        </OptionalField>

        <OptionalField
          label="Washing"
          hint="Enable for wash-effect printing"
          checked={!!data.washing}
          onToggle={v => set('washing', v)}
        >
          <RateInput value={data.washingRate} onChange={v => set('washingRate', v)} unit="₹/m" />
        </OptionalField>
      </div>

      <ReadOnly label="Subtotal / Piece" value={inr(subtotal)} />
    </div>
  )
}

// ── Screen form ───────────────────────────────────────────────────────────────
function ScreenForm({ data, set, orderQty, subtotal }) {
  const qty         = num(orderQty)
  const colours     = num(data.numColours)
  const screenAmort = qty > 0
    ? (num(data.screenCostPerColour) * colours) / qty
    : 0
  const processUnit = data.processUnit || '₹/m'

  return (
    <div className="pr-form-grid">
      <Field label="Number of Colours">
        <input
          type="number"
          className="input input-sm mono"
          placeholder="1"
          min="1"
          step="1"
          value={data.numColours ?? ''}
          onChange={e => set('numColours', e.target.value)}
        />
      </Field>

      <Field label="Metres / Piece">
        <RateInput value={data.metresPerPiece} onChange={v => set('metresPerPiece', v)} unit="m" />
      </Field>

      <Field
        label="Screen / Roller Cost per Colour (₹)"
        hint="One-time cost, amortised over order quantity"
      >
        <RateInput value={data.screenCostPerColour} onChange={v => set('screenCostPerColour', v)} />
      </Field>

      <ReadOnly
        label="Screen Cost / Piece (amortised)"
        value={qty > 0 ? inr(screenAmort) : '— enter order qty in header'}
      />

      {/* Combined process rate */}
      <Field label="Combined Process Rate" span2>
        <div className="pr-combined-row">
          <UnitToggle
            value={processUnit}
            options={SCREEN_UNITS}
            onChange={v => set('processUnit', v)}
          />
          <RateInput
            value={data.processRate}
            onChange={v => set('processRate', v)}
            unit={processUnit}
          />
        </div>
        <p className="pr-field-hint">All-in rate covering paste, dye, and labour</p>
      </Field>

      {/* Optional lines */}
      <div className="pr-optionals" style={{ gridColumn: '1 / -1' }}>
        <OptionalField
          label="Curing"
          hint="Rarely charged separately — enable only if applicable"
          checked={!!data.curing}
          onToggle={v => set('curing', v)}
        >
          <RateInput value={data.curingRate} onChange={v => set('curingRate', v)} unit="₹/m" />
        </OptionalField>

        <OptionalField
          label="Washing"
          hint="Enable for wash-effect printing"
          checked={!!data.washing}
          onToggle={v => set('washing', v)}
        >
          <RateInput value={data.washingRate} onChange={v => set('washingRate', v)} unit="₹/m" />
        </OptionalField>
      </div>

      <ReadOnly label="Subtotal / Piece" value={inr(subtotal)} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Printing() {
  const header        = useLoomStore(s => s.header)
  const printing      = useLoomStore(s => s.sections.decorationFinishing.printing)
  const updateSection = useLoomStore(s => s.updateSection)

  const setPrinting = updater =>
    updateSection('decorationFinishing', prev => ({
      ...prev,
      printing: updater(prev.printing),
    }))

  const setEnabled = val => setPrinting(prev => ({ ...prev, enabled: val }))
  const setMethod  = val => setPrinting(prev => ({ ...prev, method: val, data: {} }))
  const setData    = (field, value) =>
    setPrinting(prev => ({ ...prev, data: { ...prev.data, [field]: value } }))

  const subtotal = calcPrintingSubtotal(printing, header.orderQty)
  const dfAllowance = useLoomStore(s => s.sections.decorationFinishing.allowancePct)

  return (
    <div className="pr-section">
      {/* ── On/off + method selector ── */}
      <div className="pr-controls">
        <Toggle
          value={printing.enabled}
          onChange={setEnabled}
          label="Include Printing in cost"
        />
        {printing.enabled && (
          <div className="pr-method-tabs">
            {METHODS.map(m => (
              <button
                key={m}
                className={`pr-tab${printing.method === m ? ' pr-tab--active' : ''}`}
                onClick={() => setMethod(m)}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Method form ── */}
      {printing.enabled && printing.method && printing.method !== 'None' && (
        <div className="pr-form-wrap">
          {printing.method === 'TBD' && (
            <TBDForm data={printing.data} set={setData} />
          )}
          {(printing.method === 'Digital' || COMBINED_METHODS.includes(printing.method)) && (
            <DigitalForm
              data={printing.data}
              set={setData}
              orderQty={header.orderQty}
              subtotal={subtotal}
            />
          )}
          {SCREEN_METHODS.includes(printing.method) && (
            <ScreenForm
              data={printing.data}
              set={setData}
              orderQty={header.orderQty}
              subtotal={subtotal}
            />
          )}

          <div className="pr-total-bar">
            <span className="rm-total-label">Printing Cost / Piece</span>
            <span className="rm-total-value mono">{inr(subtotal)}</span>
          </div>

          <SectionFooter
            label="Printing"
            baseCostPerPiece={subtotal}
            orderQty={header.orderQty}
            allowancePct={dfAllowance || ''}
            onAllowanceChange={v =>
              updateSection('decorationFinishing', prev => ({ ...prev, allowancePct: v }))
            }
            show={printing.enabled && printing.method !== 'None'}
          />
        </div>
      )}

      {!printing.enabled && (
        <p className="pr-disabled-note">
          Printing is excluded from the cost. Toggle on to include it.
        </p>
      )}
    </div>
  )
}
