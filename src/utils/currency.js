// ── Currency registry ─────────────────────────────────────────────────────────
export const CURRENCIES = [
  { code: 'INR', symbol: '₹',   name: 'Indian Rupee' },
  { code: 'USD', symbol: '$',   name: 'US Dollar' },
  { code: 'EUR', symbol: '€',   name: 'Euro' },
  { code: 'GBP', symbol: '£',   name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$',  name: 'Singapore Dollar' },
  { code: 'AUD', symbol: 'A$',  name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$',  name: 'Canadian Dollar' },
  { code: 'JPY', symbol: '¥',   name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥',   name: 'Chinese Yuan' },
  { code: 'BDT', symbol: '৳',   name: 'Bangladeshi Taka' },
  { code: 'LKR', symbol: 'Rs',  name: 'Sri Lankan Rupee' },
  { code: 'PKR', symbol: '₨',   name: 'Pakistani Rupee' },
  { code: 'MYR', symbol: 'RM',  name: 'Malaysian Ringgit' },
  { code: 'THB', symbol: '฿',   name: 'Thai Baht' },
  { code: 'VND', symbol: '₫',   name: 'Vietnamese Dong' },
  { code: 'SAR', symbol: '﷼',   name: 'Saudi Riyal' },
  { code: 'QAR', symbol: '﷼',   name: 'Qatari Riyal' },
  { code: 'KWD', symbol: 'KD',  name: 'Kuwaiti Dinar' },
  { code: 'TRY', symbol: '₺',   name: 'Turkish Lira' },
  { code: 'ZAR', symbol: 'R',   name: 'South African Rand' },
  { code: 'NGN', symbol: '₦',   name: 'Nigerian Naira' },
]

export const getCurrency = code =>
  CURRENCIES.find(c => c.code === code) || CURRENCIES[0]

export const getCurrencySymbol = code => getCurrency(code).symbol

// ── Formatter ─────────────────────────────────────────────────────────────────
// dp: decimal places (JPY/VND typically 0, others 2)
export function formatAmount(n, currencyCode = 'INR') {
  const { symbol } = getCurrency(currencyCode)
  const dp = ['JPY', 'VND', 'KWD'].includes(currencyCode) ? 0 : 2
  const locale = currencyCode === 'INR' ? 'en-IN' : 'en-US'
  return `${symbol}${Number(n || 0).toLocaleString(locale, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })}`
}

// Shorthand for secondary currency display
export function formatSecondary(n, rate, code) {
  if (!rate || !Number(rate)) return null
  const converted = Number(n || 0) * Number(rate)
  const { symbol } = getCurrency(code)
  return `${code} ${symbol}${converted.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
