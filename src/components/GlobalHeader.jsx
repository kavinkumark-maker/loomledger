import React, { useEffect, useRef } from 'react'
import useLoomStore from '../store/useLoomStore'
import { CURRENCIES, getCurrencySymbol } from '../utils/currency'

// ── Product types ─────────────────────────────────────────────────────────────
const HOME_TEXTILE_TYPES = [
  'Bedsheet', 'Duvet Cover', 'Pillowcase', 'Pillow',
  'Towel', 'Bath Robe', 'Bath Mat',
  'Kitchen Towel', 'Apron', 'Oven Mitt / Potholder',
  'Table Linen', 'Table Runner', 'Napkin', 'Placemat',
  'Cushion Cover', 'Throw / Blanket', 'Bed Runner',
  'Curtain / Fabric by metre',
]

const GARMENT_TYPES = [
  'Shirt / Blouse', 'T-Shirt / Polo', 'Trouser / Pants',
  'Dress', 'Skirt', 'Jacket / Coat', 'Blazer',
  'Shorts', 'Jeans / Denim', 'Nightwear / Pyjama',
  'Swimwear', 'Sportswear / Activewear',
  'Undergarment / Innerwear', 'Infant / Kids Wear',
]

const ALL_PRODUCT_TYPES = [
  ...HOME_TEXTILE_TYPES,
  '── Garments ──',   // visual separator (disabled)
  ...GARMENT_TYPES,
  '── Other ──',
  'Other',
]

const WEAVE_TYPES  = ['Plain / Twill / Satin', 'Dobby', 'Jacquard']
const TRADE_TERMS  = ['Domestic', 'FOB', 'CIF']
const SEPARATOR    = '──'

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
  const header       = useLoomStore(s => s.header)
  const updateHeader = useLoomStore(s => s.updateHeader)
  const fetchedFor   = useRef(null)

  // ── Live exchange rate fetch (primary → secondary) ────────────────────────
  useEffect(() => {
    const key = `${header.primaryCurrency}-${header.secondaryCurrency}`
    if (fetchedFor.current === key) return
    if (header.primaryCurrency === header.secondaryCurrency) {
      updateHeader('exchangeRate', '1')
      updateHeader('rateStatus', 'fetched')
      fetchedFor.current = key
      return
    }
    fetchedFor.current = key
    updateHeader('rateStatus', 'loading')

    fetch(`https://open.er-api.com/v6/latest/${header.primaryCurrency}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
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
      .catch(() => updateHeader('rateStatus', 'error'))
  }, [header.primaryCurrency, header.secondaryCurrency]) // eslint-disable-line

  const rateStatusLabel = {
    idle:    '',
    loading: '· Fetching live rate…',
    fetched: '· Live rate loaded',
    error:   '· Could not fetch — enter manually',
  }[header.rateStatus] || ''

  const weaveIsSpecial = header.weaveType !== 'Plain / Twill / Satin'
  const isOtherProduct = header.productType === 'Other'

  return (
    <section className="card global-header">
      <div className="card-header">
        <h2 className="section-title">Costing Details</h2>
        {header.costingName && (
          <span className="costing-pill">{header.costingName}</span>
        )}
      </div>

      <div className="header-grid">
        {/* Costing name + Article */}
        <FormField label="Costing Name">
          <input type="text" className="input"
            placeholder="e.g. SS25 King Bedsheet Plain White"
            value={header.costingName}
            onChange={e => updateHeader('costingName', e.target.value)} />
        </FormField>

        <FormField label="Article / Style No.">
          <input type="text" className="input"
            placeholder="e.g. BSH-100-KW"
            value={header.articleNo}
            onChange={e => updateHeader('articleNo', e.target.value)} />
        </FormField>

        {/* Product type + custom name */}
        <FormField label="Product Type">
          <select className="input" value={header.productType}
            onChange={e => updateHeader('productType', e.target.value)}>
            {ALL_PRODUCT_TYPES.map(t => {
              const isSep = t.startsWith(SEPARATOR)
              return (
                <option key={t} value={t} disabled={isSep}
                  style={isSep ? { color: '#9B8270', fontStyle: 'italic' } : {}}>
                  {t}
                </option>
              )
            })}
          </select>
        </FormField>

        <FormField label="Weave Type">
          <select className="input" value={header.weaveType}
            onChange={e => updateHeader('weaveType', e.target.value)}>
            {WEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </FormField>

        {/* Custom product name when Other selected */}
        {isOtherProduct && (
          <FormField label="Product Name" full>
            <input type="text" className="input"
              placeholder="Enter your product name"
              value={header.productTypeCustom || ''}
              onChange={e => updateHeader('productTypeCustom', e.target.value)} />
          </FormField>
        )}

        {/* Order qty + length */}
        <FormField label="Order Quantity (pieces)">
          <input type="number" className="input mono"
            placeholder="0" min="0" value={header.orderQty}
            onChange={e => updateHeader('orderQty', e.target.value)} />
        </FormField>

        <FormField label="Order Length (metres)"
          hint={header.weaveType === 'Jacquard' ? 'Used for Jacquard setup cost amortisation' : undefined}>
          <input type="number" className="input mono"
            placeholder="0" min="0" value={header.orderLength}
            onChange={e => updateHeader('orderLength', e.target.value)} />
        </FormField>

        {/* Date + Trade term */}
        <FormField label="Date">
          <input type="date" className="input mono" value={header.date}
            onChange={e => updateHeader('date', e.target.value)} />
        </FormField>

        <FormField label="Trade Term">
          <select className="input" value={header.tradeTerm}
            onChange={e => updateHeader('tradeTerm', e.target.value)}>
            {TRADE_TERMS.map(t => <option key={t}>{t}</option>)}
          </select>
        </FormField>

        {/* Primary currency */}
        <FormField label="Primary Currency">
          <select className="input" value={header.primaryCurrency}
            onChange={e => {
              fetchedFor.current = null
              updateHeader('primaryCurrency', e.target.value)
            }}>
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name} ({c.symbol})
              </option>
            ))}
          </select>
        </FormField>

        {/* Secondary currency */}
        <FormField label="Secondary Currency">
          <select className="input" value={header.secondaryCurrency}
            onChange={e => {
              fetchedFor.current = null
              updateHeader('secondaryCurrency', e.target.value)
            }}>
            {CURRENCIES.filter(c => c.code !== header.primaryCurrency).map(c => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name} ({c.symbol})
              </option>
            ))}
          </select>
        </FormField>

        {/* Exchange rate */}
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
            <span className="rate-eq">1 {header.primaryCurrency} =</span>
            <input type="number" className="input mono rate-field"
              placeholder="0.000000" step="0.000001" min="0"
              value={header.exchangeRate}
              onChange={e => {
                updateHeader('exchangeRate', e.target.value)
                updateHeader('rateStatus', 'idle')
              }} />
            <span className="rate-currency-label">{header.secondaryCurrency}</span>
            {header.exchangeRate && (
              <span className="rate-inverse">
                (1 {header.secondaryCurrency} ≈ {
                  getCurrencySymbol(header.primaryCurrency)
                }{(1 / Number(header.exchangeRate)).toFixed(2)})
              </span>
            )}
          </div>
        </FormField>
      </div>

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
