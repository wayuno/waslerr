import { useEffect, useRef } from 'react'
import Background from '../components/Background'
import { useStore } from '../store/StoreProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'
import { CheckIcon, PayPalMark, BinanceMark } from '../components/icons'

const METHODS = [
  { id: 'paypal', label: 'PayPal', desc: 'Pay with your PayPal balance or any card.', Mark: PayPalMark, markClass: 'paypal' },
  { id: 'binance', label: 'Binance Pay', desc: 'Pay with crypto — BTC, USDT or BNB.', Mark: BinanceMark, markClass: 'binance' },
]

const priceOf = (f) => (f && f.price ? parseFloat(String(f.price).replace(/[^0-9.]/g, '')) || 0 : 0)
const catLabel = (line) => (line === 'akashic' ? 'Akashic' : line === 'wealth' ? 'Wealth' : 'Desire')

export default function Checkout() {
  const { selectedProduct, payMethod, setPayMethod, payDone, orderId, pay, navigate, openDetail } = useStore()
  const ref = useRef(null)
  useReveal(ref)
  useMagnetic(ref)

  useEffect(() => {
    if (!selectedProduct) navigate('fields')
  }, [selectedProduct, navigate])
  if (!selectedProduct) return null

  const f = selectedProduct
  const total = priceOf(f)
  const free = total === 0
  const methodLabel = METHODS.find((m) => m.id === payMethod)?.label || 'PayPal'
  const payLabel = free ? 'Get your free field' : `Pay $${total} with ${methodLabel}`

  return (
    <div className="wf-app" ref={ref}>
      <Background resonanceTop="50%" />

      <section className="wf-section" style={{ maxWidth: 960, margin: '0 auto', padding: '110px 28px 100px' }}>
        {!payDone ? (
          <>
            <button className="wf-back" data-reveal onClick={() => openDetail(f.id)} style={{ marginBottom: 22 }}>
              ← Back to field
            </button>
            <div className="wf-eyebrow" data-reveal>
              Checkout
            </div>
            <h1 className="wf-detail-title" data-reveal style={{ marginBottom: 36 }}>
              Complete your order.
            </h1>

            <div className="wf-checkout-grid">
              <div data-reveal>
                {!free && (
                  <>
                    <div className="wf-field-label" style={{ marginBottom: 14 }}>
                      Payment method
                    </div>
                    <div className="wf-pay-list">
                      {METHODS.map((m) => (
                        <button
                          key={m.id}
                          className={`wf-pay-option${payMethod === m.id ? ' selected' : ''}`}
                          onClick={() => setPayMethod(m.id)}
                        >
                          <span className="wf-pay-radio" aria-hidden="true" />
                          <span className={`wf-pay-mark ${m.markClass}`}>
                            <m.Mark />
                          </span>
                          <span className="wf-pay-text">
                            <span className="wf-pay-name">{m.label}</span>
                            <span className="wf-pay-desc">{m.desc}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {free && (
                  <p className="wf-detail-desc">
                    This field is on the house — no payment required. Claim it and start listening tonight.
                  </p>
                )}
              </div>

              <div className="wf-order-card" data-reveal>
                <h3 className="wf-order-title">{f.title}</h3>
                <span className="wf-card-cat" style={{ display: 'block', marginBottom: 22 }}>
                  {catLabel(f.line)} · lifetime access
                </span>
                <div className="wf-order-row">
                  <span>Subtotal</span>
                  <span>{free ? '$0' : `$${total}`}</span>
                </div>
                <div className="wf-order-row">
                  <span>Fees</span>
                  <span>$0</span>
                </div>
                <div className="wf-order-row total">
                  <span>Total</span>
                  <span>{free ? '$0' : `$${total}`}</span>
                </div>
                <button className="wf-form-submit wf-mag" style={{ marginTop: 22, width: '100%' }} onClick={pay}>
                  {payLabel}
                </button>
                <p className="wf-form-note" style={{ marginTop: 14 }}>
                  Demo checkout — no real charge is made.
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="wf-checkout-success" data-reveal>
            <span className="wf-check-ring" aria-hidden="true">
              <span className="ring" />
              <span className="disc">
                <CheckIcon size={30} stroke={2.4} />
              </span>
            </span>
            <h1 className="wf-detail-title" style={{ fontStyle: 'italic', marginTop: 28 }}>
              Transformation unlocked.
            </h1>
            <p className="wf-detail-desc" style={{ maxWidth: 440, margin: '14px auto 6px' }}>
              Your field {f.title} is ready.{' '}
              {free ? 'Claimed for free.' : `Paid $${total} via ${methodLabel}.`}
            </p>
            <div className="wf-order-no">Order {orderId}</div>
            <button className="wf-btn wf-btn-gold wf-mag" style={{ marginTop: 28 }} onClick={() => navigate('fields')}>
              Explore more fields
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
