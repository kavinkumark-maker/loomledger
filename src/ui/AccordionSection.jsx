import React, { useState } from 'react'

export default function AccordionSection({ title, locked = false, badge, children }) {
  const [open, setOpen] = useState(false)

  const toggle = () => {
    if (!locked) setOpen(v => !v)
  }

  return (
    <div className={`accordion${locked ? ' accordion--locked' : ''}${open ? ' accordion--open' : ''}`}>
      <button
        className="accordion-trigger"
        onClick={toggle}
        aria-expanded={open}
        disabled={locked}
      >
        <span className="accordion-title">{title}</span>
        <div className="accordion-trigger-right">
          {badge && <span className="accordion-badge">{badge}</span>}
          {locked
            ? <span className="accordion-phase-tag">Phase 2–7</span>
            : <span className="accordion-chevron" aria-hidden>{open ? '▲' : '▼'}</span>
          }
        </div>
      </button>

      {open && !locked && (
        <div className="accordion-body">
          {children ?? (
            <p className="accordion-empty">No content yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
