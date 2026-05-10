import React, { useState } from 'react'
import useLoomStore from '../store/useLoomStore'
import { exportToExcel, buildShareText } from '../utils/exportUtils'

export default function ShareBar() {
  const header       = useLoomStore(s => s.header)
  const sections     = useLoomStore(s => s.sections)
  const pricingLayer = useLoomStore(s => s.pricingLayer)

  const [copied, setCopied] = useState(false)
  const [xlFlash, setXlFlash] = useState(false)

  const shareText = () => buildShareText(header, sections, pricingLayer)

  const handleExcel = () => {
    exportToExcel(header, sections, pricingLayer)
    setXlFlash(true)
    setTimeout(() => setXlFlash(false), 1800)
  }

  const handleEmail = () => {
    const subject = encodeURIComponent(`Costing Sheet — ${header.costingName || 'LoomLedger'}`)
    const body    = encodeURIComponent(shareText())
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  const handleWhatsApp = () => {
    const text = encodeURIComponent(shareText())
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText())
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = shareText()
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  const handleNativeShare = async () => {
    if (!navigator.share) return
    try {
      await navigator.share({
        title: `Costing — ${header.costingName || 'LoomLedger'}`,
        text: shareText(),
      })
    } catch (e) {
      // User cancelled or not supported
    }
  }

  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  return (
    <div className="share-bar">
      <span className="share-bar-label">Export & Share</span>

      <div className="share-bar-actions">
        {/* Excel */}
        <button
          className={`btn btn-ghost share-btn${xlFlash ? ' btn-flash' : ''}`}
          onClick={handleExcel}
          title="Download as Excel (.xlsx)"
        >
          {xlFlash ? '✓ Downloaded' : '📊 Excel'}
        </button>

        {/* Print / PDF */}
        <button
          className="btn btn-ghost share-btn"
          onClick={() => { document.body.dataset.printMode = 'costing'; window.print() }}
          title="Print or save costing as PDF"
        >
          ⎙ Cost PDF
        </button>

        {/* Spec Sheet */}
        <button
          className="btn btn-ghost share-btn"
          onClick={() => { document.body.dataset.printMode = 'spec'; window.print() }}
          title="Print product spec sheet"
        >
          📐 Spec Sheet
        </button>

        <div className="share-divider" />

        {/* Email */}
        <button
          className="btn btn-ghost share-btn"
          onClick={handleEmail}
          title="Share via Email"
        >
          ✉ Email
        </button>

        {/* WhatsApp */}
        <button
          className="btn btn-ghost share-btn share-btn--whatsapp"
          onClick={handleWhatsApp}
          title="Share via WhatsApp"
        >
          WhatsApp
        </button>

        {/* Native share (mobile) */}
        {hasNativeShare && (
          <button
            className="btn btn-ghost share-btn"
            onClick={handleNativeShare}
            title="Share via..."
          >
            ↑ Share
          </button>
        )}

        {/* Copy */}
        <button
          className={`btn btn-ghost share-btn${copied ? ' btn-flash' : ''}`}
          onClick={handleCopy}
          title="Copy summary to clipboard"
        >
          {copied ? '✓ Copied' : '⎘ Copy'}
        </button>
      </div>
    </div>
  )
}
