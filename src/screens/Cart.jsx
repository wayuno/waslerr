import { useRef } from 'react'
import Background from '../components/Background'
import { useStore } from '../store/StoreProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'
import { TrashIcon, ArrowRight } from '../components/icons'

const CAT = {
  desire: { label: 'Desire', cls: 'gold' },
  akashic: { label: 'Akashic', cls: 'cyan' },
  wealth: { label: 'Wealth', cls: 'gold' },
}
const priceOf = (f) =>
  f && f.priceNum != null ? Number(f.priceNum) : f && f.price ? parseFloat(String(f.price).replace(/[^0-9.]/g, '')) || 0 : 0

export default function Cart() {
  const { cart, removeFromCart, goCartCheckout, navigate, openDetail } = useStore()
  const ref = useRef(null)
  useReveal(ref)
  useMagnetic(ref)

  const total = cart.reduce((s, i) => s + priceOf(i), 0)

  return (
    <div className="wf-app" ref={ref}>
      <Background resonanceTop="46%" />
      <section className="wf-section" style={{ maxWidth: 780, margin: '0 auto', padding: '110px 28px 100px' }}>
        <button className="wf-back" data-reveal onClick={() => navigate('fields')} style={{ marginBottom: 24 }}>
          ← Continue browsing
        </button>
        <div className="wf-eyebrow" data-reveal>
          Your cart
        </div>
        <h1 className="wf-detail-title" data-reveal style={{ marginBottom: 30 }}>
          {cart.length ? 'Review your fields.' : 'Your cart is empty.'}
        </h1>

        {cart.length === 0 ? (
          <div data-reveal>
            <p className="wf-detail-desc" style={{ marginBottom: 28 }}>
              You haven&apos;t added any fields yet. Browse the library and add the ones that move you.
            </p>
            <button className="wf-btn wf-btn-gold wf-mag" onClick={() => navigate('fields')}>
              Explore fields <ArrowRight />
            </button>
          </div>
        ) : (
          <>
            <div className="wf-cart-list" data-reveal>
              {cart.map((f) => {
                const cat = CAT[f.line] || { label: 'Field', cls: 'gold' }
                return (
                  <div className="wf-cart-item" key={f.cartKey || f.id}>
                    <button className="wf-cart-tile" onClick={() => openDetail(f.id)} aria-label={`Open ${f.title}`}>
                      {f.image_url ? <img src={f.image_url} alt="" /> : <span>W</span>}
                    </button>
                    <div className="wf-cart-mid">
                      <button className="wf-cart-name" onClick={() => openDetail(f.id)}>
                        {f.title}
                      </button>
                      <span className={`wf-co-cat-pill ${cat.cls}`}>{cat.label}</span>
                    </div>
                    <div className="wf-cart-right">
                      <span className="wf-cart-price">${priceOf(f)}</span>
                      <button className="wf-del" aria-label={`Remove ${f.title}`} onClick={() => removeFromCart(f.cartKey || f.id)}>
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="wf-co-total-row" data-reveal style={{ marginTop: 26 }}>
              <span>
                Subtotal · {cart.length} field{cart.length === 1 ? '' : 's'}
              </span>
              <span className="wf-co-total-amt">${total}</span>
            </div>

            <button className="wf-form-submit wf-mag wf-co-continue" onClick={goCartCheckout} style={{ marginTop: 22 }}>
              <span>Proceed to checkout</span>
              <span className="wf-co-arrow" aria-hidden="true">
                →
              </span>
            </button>
          </>
        )}
      </section>
    </div>
  )
}
