import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const SCHEMA_VERSION = 1

// ── Empty state factories ─────────────────────────────────────────────────────
// Using factory functions so we always get a fresh object, never a shared ref.

export const emptyHeader = () => ({
  costingName: '',
  articleNo: '',
  productType: 'Bedsheet',
  productTypeCustom: '',
  weaveType: 'Plain / Twill / Satin',
  orderQty: '',
  orderLength: '',
  date: new Date().toISOString().split('T')[0],
  tradeTerm: 'Domestic',
  primaryCurrency: 'INR',
  secondaryCurrency: 'USD',
  exchangeRate: '',
  rateStatus: 'idle',
})

export const emptySections = () => ({
  productDimensions: {
    fabricWidth: '',
    fabricWidthUnit: 'inches',
    selvedgePerSide: '1',
    selvedgeUnit: 'inches',
    panels: [],
    allowancePct: '',
  },
  rawMaterials: {
    rows: [],
    allowancePct: '',
    dobbySurcharge: 10,
    jacquardPremium: 35,
    jacquardSetupCost: 0,
  },
  dyeingProcessing: {
    rows: [],
    allowancePct: '',
  },
  trimsAccessories: {
    rows: [],
    allowancePct: '',
  },
  decorationFinishing: {
    allowancePct: '',       // 3A Printing allowance
    embDecoAllowancePct: '', // 3B Embroidery & Other Decoration allowance
    printing: { enabled: false, method: 'None', data: {} },
    embroidery: {
      enabled: false,
      mode: 'Standard Placements',
      placements: [],
      digitisingCharge: 0,
      continuous: {
        embLength: 0,
        stitchDensity: 0,
        machineRate: 0,
        backing: 0,
        digitisingCharge: 0,
      },
    },
    otherDecoration: { enabled: false, rows: [] },
  },
  labour: {
    mode: 'Flat CMT',
    flatRate: 0,
    rows: [],
    allowancePct: '',
  },
  logistics: {
    rows: [],
    compliance: [],
    allowancePct: '',
  },
})

export const emptyPricingLayer = () => ({
  packagingCost: '',
  wastageBuffer: '',
  overheadPct:   '',     // % of (material + labour) — typically 10–20%
  lcPaymentTerm: 'None', // 'None' | 'Sight (3%)' | '60-day (7.5%)' | '90-day (15%)'
  mode: 'Seller',
  profitMargin: '20',
  targetRetailPrice: '',
  targetMargin: '40',
})

// ── ID generator ──────────────────────────────────────────────────────────────
const generateId = () =>
  `ll_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

// ── Store ─────────────────────────────────────────────────────────────────────
const useLoomStore = create(
  persist(
    (set, get) => ({
      schemaVersion: SCHEMA_VERSION,

      // Current working costing
      currentId: null,
      header: emptyHeader(),
      sections: emptySections(),
      pricingLayer: emptyPricingLayer(),

      // Saved costings list
      savedCostings: [],

      // ── Header ──────────────────────────────────────────────────────────────
      updateHeader: (field, value) =>
        set(state => ({
          header: { ...state.header, [field]: value },
        })),

      // ── Sections (used by phases 2–7) ────────────────────────────────────
      updateSection: (section, updater) =>
        set(state => ({
          sections: {
            ...state.sections,
            [section]: updater(state.sections[section]),
          },
        })),

      // ── Pricing layer ────────────────────────────────────────────────────
      updatePricingLayer: (field, value) =>
        set(state => ({
          pricingLayer: { ...state.pricingLayer, [field]: value },
        })),

      // ── Save ─────────────────────────────────────────────────────────────
      saveCosting: () => {
        const state = get()
        const id = state.currentId || generateId()
        const name =
          state.header.costingName.trim() || 'Untitled Costing'
        const entry = {
          id,
          name,
          savedAt: new Date().toISOString(),
          header: state.header,
          sections: state.sections,
          pricingLayer: state.pricingLayer,
        }
        const rest = state.savedCostings.filter(c => c.id !== id)
        set({ savedCostings: [entry, ...rest], currentId: id })
        return entry
      },

      // ── Load ─────────────────────────────────────────────────────────────
      loadCosting: id => {
        const costing = get().savedCostings.find(c => c.id === id)
        if (!costing) return
        set({
          currentId: costing.id,
          header: costing.header,
          sections: costing.sections,
          pricingLayer: costing.pricingLayer,
        })
      },

      // ── Duplicate ────────────────────────────────────────────────────────
      duplicateCosting: id => {
        const costing = get().savedCostings.find(c => c.id === id)
        if (!costing) return
        const newId = generateId()
        const copy = {
          ...costing,
          id: newId,
          name: `${costing.name} (copy)`,
          savedAt: new Date().toISOString(),
          header: {
            ...costing.header,
            costingName: costing.header.costingName
              ? `${costing.header.costingName} (copy)`
              : 'Untitled Costing (copy)',
          },
        }
        set(state => ({ savedCostings: [copy, ...state.savedCostings] }))
      },

      // ── Delete ───────────────────────────────────────────────────────────
      deleteCosting: id =>
        set(state => ({
          savedCostings: state.savedCostings.filter(c => c.id !== id),
          currentId: state.currentId === id ? null : state.currentId,
        })),

      // ── New ──────────────────────────────────────────────────────────────
      newCosting: () =>
        set({
          currentId: null,
          header: emptyHeader(),
          sections: emptySections(),
          pricingLayer: emptyPricingLayer(),
        }),

      // ── Export JSON ──────────────────────────────────────────────────────
      exportToJSON: () => {
        const { savedCostings } = get()
        const json = JSON.stringify({ schemaVersion: SCHEMA_VERSION, costings: savedCostings }, null, 2)
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `loomledger-backup-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      },
    }),
    {
      name: 'loomledger_costings',
      storage: createJSONStorage(() => localStorage),
      version: SCHEMA_VERSION,
      // Migrations live here when the schema changes across phases
      migrate: (persistedState, _version) => {
        // Add productDimensions to any costing that predates it
        const defaultPd = { fabricWidth: '', fabricWidthUnit: 'inches', selvedgePerSide: '1', selvedgeUnit: 'inches', panels: [], allowancePct: '' }
        if (persistedState.sections && !persistedState.sections.productDimensions) {
          persistedState.sections.productDimensions = defaultPd
        }
        if (persistedState.savedCostings) {
          persistedState.savedCostings = persistedState.savedCostings.map(c => ({
            ...c,
            sections: c.sections?.productDimensions
              ? c.sections
              : { ...c.sections, productDimensions: defaultPd }
          }))
        }
        return persistedState
      },
    }
  )
)

export default useLoomStore
