import { useEffect, useRef, useState } from 'react'
import Background from '../components/Background'
import { useStore } from '../store/StoreProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'

const truncate = (s, n = 22) => (s && s.length > n ? s.slice(0, n) + '…' : s || '—')

export default function Delivered() {
  const { deliveredParams, findProduct, navigate, openReviews } = useStore()
  const [burst, setBurst] = useState(false)
  const ref = useRef(null)
  useReveal(ref)
  useMagnetic(ref)

  useEffect(() => {
    const t = setTimeout(() => setBurst(true), 80)
    return () => clearTimeout(t)
  }, [])

  const params = deliveredParams || {}
  const f = findProduct(params.fieldId)
  const isComp = params.method === 'coupon' // unlocked with a full-discount code
  const methodLabel = isComp ? 'Discount code' : params.method === 'binance' ? 'Binance Pay' : 'PayPal'
  const amt = params.amount != null ? `$${params.amount}` : '—'
  const ref_ = params.ref || '—'
  const txn = params.txn || '—'
  const fieldName = f?.title || 'your field'

  return (
    <div className="wf-app" ref={ref}>
      <Background resonanceTop="40%" />

      <section className="wf-delivered-section">
        {/* Aurora burst */}
        <div className={`wf-burst-wrap${burst ? ' active' : ''}`} aria-hidden="true">
          <div className="wf-burst-ring wf-burst-ring-1" />
          <div className="wf-burst-ring wf-burst-ring-2" />
          <div className="wf-burst-ring wf-burst-ring-3" />
          <div className="wf-burst-disc">
            <svg className="wf-check-svg" viewBox="0 0 52 52" fill="none">
              <defs>
                <linearGradient id="wf-disc-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f6e7b4" />
                  <stop offset="48%" stopColor="#d4af37" />
                  <stop offset="100%" stopColor="#b8862b" />
                </linearGradient>
              </defs>
              <circle cx="26" cy="26" r="26" fill="url(#wf-disc-grad)" />
              <polyline className="wf-check-mark" points="14,27 22,35 38,18" stroke="#0d0b07" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div className="wf-delivered-body" data-reveal>
          <div className="wf-eyebrow" style={{ marginBottom: 14 }}>{isComp ? 'Access granted' : 'Payment verified'}</div>
          <h1 className="wf-detail-title" style={{ fontStyle: 'italic', marginBottom: 12 }}>
            Your field is unlocked.
          </h1>
          <p className="wf-detail-desc" style={{ maxWidth: 440, margin: '0 auto 36px' }}>
            {isComp ? 'Unlocked with your code · lifetime access granted.' : `${amt} via ${methodLabel} verified · lifetime access granted.`}
          </p>

          {/* Receipt card */}
          <div className="wf-receipt-card">
            <div className="wf-receipt-row" style={{ animationDelay: '0.05s' }}>
              <span>Field</span>
              <span>{fieldName}</span>
            </div>
            <div className="wf-receipt-row" style={{ animationDelay: '0.15s' }}>
              <span>{isComp ? 'Price' : 'Paid'}</span>
              <span>{isComp ? 'Free · Discount code' : `${amt} · ${methodLabel}`}</span>
            </div>
            <div className="wf-receipt-row" style={{ animationDelay: '0.25s' }}>
              <span>Reference</span>
              <span className="mono">{ref_}</span>
            </div>
            <div className="wf-receipt-row" style={{ animationDelay: '0.35s' }}>
              <span>Transaction ID</span>
              <span className="mono">{truncate(txn, 24)}</span>
            </div>
          </div>

          {/* CTAs */}
          <div className="wf-delivered-ctas">
            <button
              className="wf-btn wf-btn-gold wf-mag"
              onClick={() => params.fieldId != null ? navigate({ page: 'detail', id: params.fieldId }) : navigate('fields')}
            >
              Download your field
            </button>
            <button
              className="wf-btn wf-mag"
              onClick={() => openReviews(params.fieldId, true)}
            >
              Leave a review
            </button>
          </div>

          <button className="wf-back" style={{ marginTop: 24 }} onClick={() => navigate('fields')}>
            Browse more fields →
          </button>
        </div>
      </section>
    </div>
  )
}
