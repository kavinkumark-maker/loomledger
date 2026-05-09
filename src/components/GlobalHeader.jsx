import React, { useEffect, useRef } from 'react'
import useLoomStore from '../store/useLoomStore'

const PRODUCT_TYPES = ['Bedsheet', 'Towel', 'Table Linen', 'Curtain / Fabric by metre']
const WEAVE_TYPES  = ['Plain / Twill / Satin', 'Dobby', 'Jacquard']
const TRADE_TERMS  = ['Domestic', 'FOB', 'CIF']
const CURRENCIES   = ['USD', 'EUR', 'GBP', 'AED']

const CURRENCY_NAMES = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  AED: 'UAE Dirham',
}

// Defined outside component so React doesn't recreate it on every render
function FormField({ label, hint, children, full }) {
  return (
    <div className={`field${full ? ' field--full' : ''}`}>
      <label className="field-label">{label}</label>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  )
}

export default function GlobalHeader() {
  const header         = useLoomStore(s => s.header)
  const updateHeader   = useLoomStore(s => s.updateHeader)
  const fetchedFor     = useRef(null) // track which currency we last fetched for

  // ── Live exchange rate fetch ───────────────────────────────────────────────
  useEffect(() => {
    if (fetchedFor.current === header.secondaryCurrency) return
    fetchedFor.current = header.secondaryCurrency

    updateHeader('rateStatus', 'loading')

    fetch('https://open.er-api.com/v6/latest/INR')
      .then(r => {
        if (!r.ok) throw new Error('Network error')
        return r.json()
      })
      .then(data => {
        if (data.result === 'success') {
          const rate = data.rates?.[header.secondaryCurrency]
          if (rate) {
            updateHeader('exchangeRate', String(parseFloat(rate.toFixed(6))))
            updateHeader('rateStatus', 'fetched')
          } else {
            updateHeader('rateStatus', 'error')
          }
        } else {
          updateHeader('rateStatus', 'error')
        }
      })
      .catch(() => {
        updateHeader('rateStatus', 'error')
      })
  }, [header.secondaryCurrency]) // eslint-disable-line react-hooks/exhaustive-deps

  const rateStatusLabel = {
    idle:    '',
    loading: '· Fetching live rate…',
    fetched: '· Live rate loaded',
    error:   '· Could not fetch — enter manually',
  }[header.rateStatus] || ''

  const weaveIsSpecial = header.weaveType !== 'Plain / Twill / Satin'

  return (
    <section className="card global-header">
      <div className="card-header">
        <h2 className="section-title">Costing Details</h2>
        {header.costingName && (
          <span className="costing-pill">{header.costingName}</span>
        )}
      </div>

      <div className="header-grid">
        {/* ── Row 1: Costing name + Article no ── */}
        <FormField label="Costing Name">
          <input
            type="text"
            className="input"
            placeholder="e.g. SS25 King Bedsheet Plain White"
            value={header.costingName}
            onChange={e => updateHeader('costingName', e.target.value)}
          />
        </FormField>

        <FormField label="Article / Style No.">
          <input
            type="text"
            className="input"
            placeholder="e.g. BSH-100-KW"
            value={header.articleNo}
            onChange={e => updateHeader('articleNo', e.target.value)}
          />
        </FormField>

        {/* ── Row 2: Product type + Weave type ── */}
        <FormField label="Product Type">
          <select
            className="input"
            value={header.productType}
            onChange={e => updateHeader('productType', e.target.value)}
          >
            {PRODUCT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </FormField>

        <FormField label="Weave Type">
          <select
            className="input"
            value={header.weaveType}
            onChange={e => updateHeader('weaveType', e.target.value)}
          >
            {WEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </FormField>

        {/* ── Row 3: Order qty + Order length ── */}
        <FormField label="Order Quantity (pieces)">
          <input
            type="number"
            className="input mono"
            placeholder="0"
            min="0"
            value={header.orderQty}
            onChange={e => updateHeader('orderQty', e.target.value)}
          />
        </FormField>

        <FormField
          label="Order Length (metres)"
          hint={header.weaveType === 'Jacquard' ? 'Used for Jacquard setup cost amortisation' : undefined}
        >
          <input
            type="number"
            className="input mono"
            placeholder="0"
            min="0"
            value={header.orderLength}
            onChange={e => updateHeader('orderLength', e.target.value)}
          />
        </FormField>

        {/* ── Row 4: Date + Trade term ── */}
        <FormField label="Date">
          <input
            type="date"
            className="input mono"
            value={header.date}
            onChange={e => updateHeader('date', e.target.value)}
          />
        </FormField>

        <FormField label="Trade Term">
          <select
            className="input"
            value={header.tradeTerm}
            onChange={e => updateHeader('tradeTerm', e.target.value)}
          >
            {TRADE_TERMS.map(t => <option key={t}>{t}</option>)}
          </select>
        </FormField>

        {/* ── Row 5: Primary currency (fixed) + Secondary currency ── */}
        <FormField label="Primary Currency">
          <div className="input input--static">
            <span className="currency-code">INR</span>
            <span className="currency-name">Indian Rupee</span>
          </div>
        </FormField>

        <FormField label="Secondary Currency">
          <select
            className="input"
            value={header.secondaryCurrency}
            onChange={e => {
              fetchedFor.current = null // reset so we fetch for the new currency
              updateHeader('secondaryCurrency', e.target.value)
            }}
          >
            {CURRENCIES.map(c => (
              <option key={c} value={c}>{c} — {CURRENCY_NAMES[c]}</option>
            ))}
          </select>
        </FormField>

        {/* ── Row 6: Exchange rate (full width) ── */}
        <FormField
          label={
            <>
              Exchange Rate
              <span className="rate-status-label">{rateStatusLabel}</span>
            </>
          }
          full
        >
          <div className="exchange-rate-row">
            <span className="rate-eq">1 INR =</span>
            <input
              type="number"
              className="input mono rate-field"
              placeholder="0.000000"
              step="0.000001"
              min="0"
              value={header.exchangeRate}
              onChange={e => {
                updateHeader('exchangeRate', e.target.value)
                updateHeader('rateStatus', 'idle')
              }}
            />
            <span className="rate-currency-label">{header.secondaryCurrency}</span>
            {header.exchangeRate && (
              <span className="rate-inverse">
                (1 {header.secondaryCurrency} ≈ ₹{(1 / Number(header.exchangeRate)).toFixed(2)})
              </span>
            )}
          </div>
        </FormField>
      </div>

      {/* ── Weave cascade indicator ── */}
      {weaveIsSpecial && (
        <div className={`weave-notice weave-notice--${header.weaveType.toLowerCase()}`}>
          <span className="weave-notice-icon">◈</span>
          <span>
            {header.weaveType === 'Dobby'
              ? 'Dobby weave selected — surcharge block will appear in Sections 1 & 5'
              : 'Jacquard weave selected — premium block & setup cost will appear in Sections 1 & 5'}
          </span>
        </div>
      )}
    </section>
  )
}
