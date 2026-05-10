import React from 'react'
import SaveLoadSection            from './components/SaveLoadSection'
import GlobalHeader               from './components/GlobalHeader'
import SummaryPanel               from './components/SummaryPanel'
import AccordionSection           from './ui/AccordionSection'
import RawMaterials               from './components/RawMaterials'
import DyeingProcessing           from './components/DyeingProcessing'
import { calcDPRowSubtotal }      from './components/DyeingProcessing'
import Printing                   from './components/Printing'
import { calcPrintingSubtotal }   from './components/Printing'
import Embroidery                 from './components/Embroidery'
import { calcEmbroiderySubtotal } from './components/Embroidery'
import OtherDecoration            from './components/OtherDecoration'
import { calcOtherDecoSubtotal }  from './components/OtherDecoration'
import TrimsAccessories           from './components/TrimsAccessories'
import { calcTrimsSubtotal }      from './components/TrimsAccessories'
import Labour                     from './components/Labour'
import { calcLabourSubtotal }     from './components/Labour'
import { getAggregatePPI }        from './components/RawMaterials'
import { calcWeaveSurcharge }     from './components/RawMaterials'
import Logistics                  from './components/Logistics'
import { calcLogisticsSubtotal }  from './components/Logistics'
import PrintView                  from './components/PrintView'
import ShareBar                   from './components/ShareBar'
import ProductDimensions          from './components/ProductDimensions'
import SpecSheet                  from './components/SpecSheet'
import SectionFooter, { withAllowance } from './ui/SectionFooter'
import useLoomStore               from './store/useLoomStore'

const fmt = n =>
  n > 0
    ? `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null

export default function App() {
  const sections       = useLoomStore(s => s.sections)
  const header         = useLoomStore(s => s.header)
  const updateSection  = useLoomStore(s => s.updateSection)

  // ── Section badges ────────────────────────────────────────────────────────
  const rmBase = sections.rawMaterials.rows.reduce((acc, r) => {
    const qty   = Number(r.qty)     || 0
    const waste = Number(r.wastage) || 0
    const price = Number(r.price)   || 0
    if (r.materialType === 'fabric') return acc + qty * (1 + waste / 100) * price
    const kg = r.qtyUnit === 'g' ? qty / 1000 : qty
    return acc + kg * (1 + waste / 100) * price
  }, 0)
  const weaveSurcharge = calcWeaveSurcharge(sections.rawMaterials, header.weaveType)
  const weaveSurchargeTotal = weaveSurcharge.dobby + weaveSurcharge.jacquardPremium +
    (Number(sections.rawMaterials.jacquardSetupCost) || 0)
  const rmSubtotal = withAllowance(rmBase, sections.rawMaterials.allowancePct) + weaveSurchargeTotal

  const dpSubtotal = sections.dyeingProcessing.rows.reduce((acc, r) => {
    const autoQty =
      r.rateUnit === '₹/m'     ? (Number(header.orderLength) || null) :
      r.rateUnit === '₹/piece' ? (Number(header.orderQty)    || null) : null
    const effectiveRow = (!r.qtyOverride && autoQty !== null)
      ? { ...r, qty: String(autoQty) }
      : r
    return acc + calcDPRowSubtotal(effectiveRow)
  }, 0)

  const df = sections.decorationFinishing
  const printingSubtotal   = calcPrintingSubtotal(df.printing, header.orderQty)
  const embroiderySubtotal = calcEmbroiderySubtotal(df.embroidery, header.orderQty)
  const otherDecoSubtotal  = calcOtherDecoSubtotal(df.otherDecoration)
  const trimsSubtotal = withAllowance(
    calcTrimsSubtotal(sections.trimsAccessories),
    sections.trimsAccessories.allowancePct
  )
  const autoMetres    = Number(header.orderLength) || null
  const autoPPI       = getAggregatePPI(sections.rawMaterials.rows)
  const labourSubtotal = withAllowance(
    calcLabourSubtotal(sections.labour, autoMetres, autoPPI),
    sections.labour.allowancePct
  )
  const logisticsSubtotal = withAllowance(
    calcLogisticsSubtotal(sections.logistics, header.orderQty),
    sections.logistics.allowancePct
  )

  return (
    <div className="app">
      <header className="app-bar">
        <div className="app-bar-brand">
          <svg className="app-bar-mark" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3"  y="3"  width="4" height="18" rx="1" fill="currentColor" opacity=".9"/>
            <rect x="10" y="3"  width="4" height="18" rx="1" fill="currentColor" opacity=".6"/>
            <rect x="17" y="3"  width="4" height="18" rx="1" fill="currentColor" opacity=".3"/>
            <rect x="3"  y="10" width="18" height="2"  rx="1" fill="currentColor"/>
          </svg>
          <span className="app-bar-name">LoomLedger</span>
          <span className="app-bar-sep" aria-hidden>|</span>
          <span className="app-bar-tag">Home Textile Costing Studio</span>
        </div>
        <div className="app-bar-right">
          <span className="app-bar-version">v1.0 · Complete</span>
        </div>
      </header>

      <main className="app-body">
        <SaveLoadSection />
        <ShareBar />
        <div className="main-layout">
          <div className="left-panel">
            <GlobalHeader />

            <AccordionSection title="0 — Product Dimensions">
              <ProductDimensions />
            </AccordionSection>

            <AccordionSection title="1 — Raw Materials" badge={fmt(rmSubtotal)}>
              <RawMaterials />
            </AccordionSection>

            <AccordionSection title="2 — Dyeing & Processing" badge={fmt(dpSubtotal)}>
              <DyeingProcessing />
            </AccordionSection>

            <AccordionSection title="3A — Printing" badge={fmt(printingSubtotal)}>
              <Printing />
            </AccordionSection>

            <AccordionSection
              title="3B — Embroidery & Other Decoration"
              badge={fmt(withAllowance(embroiderySubtotal + otherDecoSubtotal, df.embDecoAllowancePct))}
            >
              <div className="sub-section-group">
                <div className="sub-section-label">Embroidery</div>
                <Embroidery orderQty={header.orderQty} />
                <div className="sub-section-divider" />
                <div className="sub-section-label">Other Decoration</div>
                <OtherDecoration />
                <SectionFooter
                  label="Embroidery & Other Decoration"
                  baseCostPerPiece={embroiderySubtotal + otherDecoSubtotal}
                  orderQty={header.orderQty}
                  allowancePct={df.embDecoAllowancePct || ''}
                  onAllowanceChange={v =>
                    updateSection('decorationFinishing', prev => ({ ...prev, embDecoAllowancePct: v }))
                  }
                  show={
                    sections.decorationFinishing.embroidery.enabled ||
                    sections.decorationFinishing.otherDecoration.enabled
                  }
                />
              </div>
            </AccordionSection>

            <AccordionSection title="4 — Trims & Accessories" badge={fmt(trimsSubtotal)}>
              <TrimsAccessories />
            </AccordionSection>
            <AccordionSection title="5 — Labour & Workmanship" badge={fmt(labourSubtotal)}>
              <Labour />
            </AccordionSection>
            <AccordionSection title="6 — Logistics & Export" badge={fmt(logisticsSubtotal)}>
              <Logistics />
            </AccordionSection>
          </div>

          <div className="right-panel">
            <SummaryPanel />
          </div>
        </div>
      </main>

      {/* ── Print views — hidden on screen, shown when printing ── */}
      <div className="print-only print-only--costing">
        <PrintView />
      </div>
      <div className="print-only print-only--spec">
        <SpecSheet />
      </div>
    </div>
  )
}
