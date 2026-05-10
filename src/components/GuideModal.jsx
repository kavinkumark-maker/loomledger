import React, { useState } from 'react'

const TABS = [
  { id: 'start',      label: 'Getting started' },
  { id: 'costing',    label: 'Costing workflow' },
  { id: 'dimensions', label: 'Product dimensions' },
  { id: 'layout',     label: 'Fabric layout' },
  { id: 'summary',    label: 'Summary panel' },
  { id: 'export',     label: 'Export & share' },
  { id: 'manage',     label: 'Managing costings' },
]

function Step({ num, icon, title, children, tip }) {
  return (
    <div className="gd-step">
      <div className="gd-step-num">{icon ? <span className="gd-step-icon">{icon}</span> : num}</div>
      <div className="gd-step-body">
        <h3 className="gd-step-title">{title}</h3>
        <div className="gd-step-desc">{children}</div>
        {tip && <div className="gd-tip">{tip}</div>}
      </div>
    </div>
  )
}

function Card({ icon, title, children }) {
  return (
    <div className="gd-card">
      <div className="gd-card-icon">{icon}</div>
      <h3 className="gd-card-title">{title}</h3>
      <p className="gd-card-desc">{children}</p>
    </div>
  )
}

function Badge({ children, color = 'tc' }) {
  return <span className={`gd-badge gd-badge--${color}`}>{children}</span>
}

function FlowItem({ children }) {
  return <><span className="gd-flow-item">{children}</span><span className="gd-flow-arrow">→</span></>
}

// ── Tab content ───────────────────────────────────────────────────────────────
const CONTENT = {
  start: (
    <>
      <p className="gd-section-sub">LoomLedger works entirely in your browser. No login, no server. Your costings are saved locally and can be exported at any time.</p>
      <div className="gd-steps">
        <Step num={1} title="Fill in the costing header">
          Enter the costing name, article number, product type, weave type, order quantity, order length, date, and trade term. This information flows into all calculations below.
          <br/><br/>Choose your primary currency — the app supports INR, USD, EUR, GBP, AED and 18 more. The exchange rate auto-fetches and can be overridden manually.
        </Step>
        <Step num={2} title="Work through the sections in order">
          Each accordion section covers one cost category. Open them one by one and add rows. The summary panel on the right updates live as you type.
          <div className="gd-flow">
            <FlowItem>0 — Dimensions</FlowItem>
            <FlowItem>1 — Raw Materials</FlowItem>
            <FlowItem>2 — Dyeing</FlowItem>
            <FlowItem>3A — Printing</FlowItem>
            <FlowItem>3B — Embroidery</FlowItem>
            <FlowItem>4 — Trims</FlowItem>
            <FlowItem>5 — Labour</FlowItem>
            <span className="gd-flow-item">6 — Logistics</span>
          </div>
        </Step>
        <Step num={3} title="Save your costing" tip="Save early and often. The JSON export is your safety net — download it as a backup before clearing browser data.">
          Click Save at the top. Your costing is stored in the browser. You can save multiple costings, duplicate them for variations, and export a JSON backup at any time.
        </Step>
        <Step num={4} title="Set your selling price or check buyer target">
          In the summary panel, toggle between Seller mode (enter your margin %, get a selling price) and Buyer mode (enter the buyer's target retail price and required margin — see if your cost fits).
        </Step>
      </div>
    </>
  ),

  costing: (
    <>
      <p className="gd-section-sub">Each section adds a layer of cost. Every row has a subtotal, and each section has a production allowance % at the bottom to account for manufacturing overrun.</p>
      <div className="gd-cards">
        <Card icon="📦" title="1 — Raw Materials">Add yarn or fabric rows. Yarn supports manual qty or AUTO mode (EPI/PPI → GSM formula). Fabric rows include composition, GSM, count, width, and price per metre or kg.</Card>
        <Card icon="💧" title="2 — Dyeing & Processing">Add processes like yarn dyeing, bleaching, sanforizing. Rate units: ₹/kg, ₹/m, ₹/piece. Order qty and length auto-fill from the header.</Card>
        <Card icon="🖨️" title="3A — Printing">Digital (₹/m, ₹/sq.in, or ₹/piece), Table Screen, Rotary Screen, or TBD. Curing and washing are optional. Screen costs amortise over order quantity.</Card>
        <Card icon="🪡" title="3B — Embroidery">Standard placements (stitch count × rate) or continuous run (length × density). Digitising charge amortises over order qty. Also: appliqué, patchwork, tufting.</Card>
        <Card icon="✂️" title="4 — Trims & Accessories">Add zips, buttons, labels, ribbons, Velcro. Categories: Structural, Decorative, Labels & Tags. Units: per piece, per metre, per set, per dozen.</Card>
        <Card icon="🔧" title="5 — Labour">Flat CMT rate, or operation-level: ₹/hr (manhours + timeoff%), ₹/m, ₹/pick (auto-pulls PPI from S1), or ₹/piece for stitching.</Card>
        <Card icon="🚚" title="6 — Logistics">Trucking, inspection, shipping docs. Compliance tests (OEKO-TEX, REACH, AATCC) amortise over order qty → ₹/piece shown read-only.</Card>
      </div>
      <div className="gd-steps" style={{marginTop:'1rem'}}>
        <Step num="ℹ" title="Production allowance — in every section">
          At the bottom of each section is a Production Allowance % field. If your order is 100 pieces but you manufacture 110 to cover rejects, enter 10%. The adjusted cost per piece and total order cost update automatically. This stacks on top of row-level material wastage.
        </Step>
      </div>
    </>
  ),

  dimensions: (
    <>
      <p className="gd-section-sub">Section 0 has three tabs. It calculates how much fabric each product actually consumes and feeds that figure into Section 1 automatically.</p>
      <div className="gd-steps">
        <Step num={1} title="Dimensions tab — set up the fabric roll">
          Enter the fabric roll width and selvedge per side. The usable width calculates instantly. Then add panels — one for each piece of fabric in the product (e.g. a cushion has Front + Back).
          <br/><br/>Link each panel to a fabric row in Section 1. Once linked, clicking "Push to Section 1" auto-fills the qty field with the calculated consumption in metres per piece.
        </Step>
        <Step num={2} title="Per panel: finished size → cut size → consumption">
          Enter finished dimensions, stitching allowance (all sides or per side: top/bottom/left/right), marker efficiency %, and cutting wastage %. The app calculates: cut size → panels per row → fabric length per piece → adjusted consumption.
        </Step>
        <Step num={3} title="Spec Sheet tab — live preview">
          Switch to the Spec Sheet tab to see a formatted product specification sheet with panel diagrams, cut sizes, consumption figures, and fabric details. Click Print / Save as PDF to download.
        </Step>
        <Step num={4} title="Fabric Layout tab — width optimizer">
          Tests standard fabric widths and ranks them by lowest wastage. See the Fabric Layout section for details.
        </Step>
      </div>
    </>
  ),

  layout: (
    <>
      <p className="gd-section-sub">Given your panel dimensions, the optimizer tests standard fabric widths (36", 44", 45", 54", 58", 60", 72", 90", 108", 118") and ranks them by lowest wastage.</p>
      <div className="gd-steps">
        <Step num={1} title="Choose row arrangement">
          <Badge>Separate rows</Badge> — each panel type gets its own rows across the fabric. Simpler, easier to cut.<br/><br/>
          <Badge>Mixed rows</Badge> — all panel types packed side by side in each row. More efficient for products with panels of similar size.
        </Step>
        <Step num={2} title="Enable shrinkage if needed" tip="Typical cotton shrinkage: 3–5% warp, 2–3% weft. Pre-washed fabrics: 0–1%.">
          Toggle shrinkage on and enter warp % (length direction) and weft % (width direction). These are added to the cut size before calculating panels per row. Override per panel for different fabrics.
        </Step>
        <Step num={3} title="Set panel rotation">
          <Badge color="blue">Auto</Badge> — optimizer tries both orientations, picks whichever fits more per row.<br/>
          <Badge color="blue">Fixed</Badge> — keeps the original orientation.<br/>
          <Badge color="blue">Rotated</Badge> — forces 90° rotation.
        </Step>
        <Step num={4} title="Read the results table" tip="Enter your preferred fabric width — it appears in the table alongside standard widths so you can compare directly.">
          The width table ranks all widths from lowest to highest wastage. The Best badge marks the optimal width. Click any row to select it and update the marker diagram below.
        </Step>
        <Step num={5} title="Read the marker diagram">
          The SVG diagram shows how panels tile across the fabric width. Selvedge is hatched. Each panel type is a different colour. Click "Use this width in Dimensions tab" to apply the selected width back to Section 0.
        </Step>
      </div>
    </>
  ),

  summary: (
    <>
      <p className="gd-section-sub">The sticky panel on the right shows a live cost breakdown. It updates every time you change any field anywhere in the app.</p>
      <div className="gd-steps">
        <Step num="📋" title="Cost breakdown">
          Shows each section's subtotal (with allowances applied), packaging cost, total cost price, wastage buffer %, and net cost price.
        </Step>
        <Step num="🏷️" title="Seller mode">
          Enter your profit margin %. Selling price = Net Cost ÷ (1 − margin%). The margin amount is shown separately. Selling price displays in both primary and secondary currency.
        </Step>
        <Step num="🏪" title="Buyer mode" tip="Use buyer mode when negotiating — it shows exactly which cost category is pushing you over the buyer's target.">
          Enter the buyer's target retail price and required margin %. Allowable cost calculates automatically. A cost breakdown bar shows each section against the allowable budget. Green = fits, red = over.
        </Step>
        <Step num="🧮" title="Order totals — always visible">
          Cost per piece and total order value are always shown at the bottom. If order qty is set in the header, the total reflects the full order value in both currencies.
        </Step>
      </div>
    </>
  ),

  export: (
    <>
      <p className="gd-section-sub">The share bar sits below the save/load panel. All exports are generated instantly in the browser — no server involved.</p>
      <div className="gd-cards">
        <Card icon="📊" title="Excel (.xlsx)">Downloads a single-sheet workbook with all sections, cost summary, and order totals. Opens in Excel, Google Sheets, and Apple Numbers.</Card>
        <Card icon="📄" title="Cost PDF">Triggers the browser print dialog with a clean A4 costing sheet. Save as PDF from the print dialog.</Card>
        <Card icon="📐" title="Spec Sheet PDF">Prints the product specification sheet — panel diagrams, cut sizes, consumption, fabric details. Also available as a live preview in the Dimensions tab.</Card>
        <Card icon="✉️" title="Email">Opens your mail app with the costing summary pre-filled in the body. Attach the Excel or PDF manually.</Card>
        <Card icon="💬" title="WhatsApp">Opens WhatsApp with a formatted cost summary pre-filled. Bold formatting works natively in WhatsApp.</Card>
        <Card icon="📋" title="Copy to clipboard">Copies the full cost summary as formatted text. Paste into Slack, Teams, Notes, email — anything.</Card>
      </div>
      <div className="gd-steps" style={{marginTop:'1rem'}}>
        <Step num="⬆" title="Import — bring costings back in">
          <Badge color="green">↑ JSON</Badge> imports a JSON backup with 100% fidelity — all fields and settings restored exactly.<br/><br/>
          <Badge color="blue">↑ Excel</Badge> does a best-effort import from a downloaded .xlsx — header, raw materials, dyeing, trims, and labour are reconstructed. A warning bar notes what could not be restored.
        </Step>
      </div>
    </>
  ),

  manage: (
    <>
      <p className="gd-section-sub">The save/load panel at the top handles all costing management — saving, searching, duplicating, images, and backing up.</p>
      <div className="gd-steps">
        <Step num={1} title="Search">
          Open the saved costings list and type in the search bar. Filters in real time by costing name, article number, and product type. Click ✕ to clear.
        </Step>
        <Step num={2} title="Duplicate a costing">
          Click Copy next to any saved costing to create a duplicate. Use this for variations — different colourways, quantities, or trade terms — without starting from scratch.
        </Step>
        <Step num={3} title="Sample images" tip="Images are stored in the browser's IndexedDB. Back them up by downloading them manually if needed.">
          After saving a costing, upload up to 5 reference photos — fabric swatches, product samples, buyer references. Click any thumbnail to view full size or delete.
        </Step>
        <Step num={4} title="Export JSON backup" tip="Do this regularly. If you clear browser data without a backup, your costings are lost.">
          Click Export JSON to download all your costings as a single .json file. Store it on Google Drive or email it to yourself. Import it back anytime using ↑ JSON — even on a different device.
        </Step>
      </div>
    </>
  ),
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function GuideModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('start')

  return (
    <div className="gd-overlay" onClick={onClose}>
      <div className="gd-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="gd-modal-header">
          <div>
            <h2 className="gd-modal-title">LoomLedger — Feature Guide</h2>
            <p className="gd-modal-sub">A complete home textile and garment costing studio</p>
          </div>
          <button className="gd-close" onClick={onClose} title="Close">✕</button>
        </div>

        {/* Tab nav */}
        <div className="gd-tab-nav">
          {TABS.map(t => (
            <button key={t.id}
              className={`gd-tab${activeTab === t.id ? ' gd-tab--active' : ''}`}
              onClick={() => setActiveTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="gd-content">
          <div className="gd-section-title">{TABS.find(t => t.id === activeTab)?.label}</div>
          {CONTENT[activeTab]}
        </div>
      </div>
    </div>
  )
}
