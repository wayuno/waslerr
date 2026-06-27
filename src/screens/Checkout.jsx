import { useEffect, useRef, useState } from 'react'
import Background from '../components/Background'
import { useStore } from '../store/StoreProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'
import { PayPalMark, BinanceMark, CloseIcon, CheckIcon } from '../components/icons'

const PAYPAL_EMAIL = 'ck806180@gmail.com'
const BINANCE_ID = '767314103'

const METHODS = [
  { id: 'paypal', label: 'PayPal', desc: 'Pay with your PayPal balance or any card.' },
  { id: 'binance', label: 'Binance Pay', desc: 'Pay with crypto — BTC, USDT or BNB.' },
]

const TIMELINE = ['Waiting for payment', 'Payment detected', 'Confirming', 'Delivered']
const DOTS_SEQ = ['.', '..', '...']
const POLL_MS = 4000

const CAT = {
  desire: { label: 'Desire', cls: 'gold' },
  akashic: { label: 'Akashic', cls: 'cyan' },
  wealth: { label: 'Wealth', cls: 'gold' },
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const priceOf = (f) =>
  f && f.priceNum != null ? Number(f.priceNum) : f && f.price ? parseFloat(String(f.price).replace(/[^0-9.]/g, '')) || 0 : 0

// ---- module-level subcomponents (defined OUTSIDE render to avoid remount/reveal glitches) ----
function ProductCard({ f, cat, compact }) {
  return (
    <div className={`wf-co-product${compact ? ' compact' : ''}`}>
      <div className="wf-co-w-tile">W</div>
      <div className="wf-co-product-info">
        <span className="wf-co-purchasing">You're purchasing</span>
        <div className="wf-co-field-name">{f.title}</div>
        <span className={`wf-co-cat-pill ${cat.cls}`}>{cat.label}</span>
      </div>
    </div>
  )
}

function CopyRow({ label, value, copyKey, mono, copying, onCopy }) {
  const copied = copying === copyKey
  return (
    <div className="wf-cr-row">
      <div>
        <div className="wf-cr-label">{label}</div>
        <div className={`wf-cr-value${mono ? ' mono' : ''}`}>{value}</div>
      </div>
      <button className={`wf-payto-copy${copied ? ' copied' : ''}`} onClick={() => onCopy(value, copyKey)} aria-label={`Copy ${label}`}>
        {copied ? <CheckIcon size={13} stroke={2.5} /> : 'Copy'}
      </button>
    </div>
  )
}

export default function Checkout() {
  const { selectedProduct, payMethod, setPayMethod, navigate, openDetail, goDelivered, applyCoupon, user, loggedIn, authReady } = useStore()

  const [stage, setStage] = useState('method')

  // Method stage
  const [couponInput, setCouponInput] = useState('')
  const [couponMsg, setCouponMsg] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponBusy, setCouponBusy] = useState(false)

  // Verify stage
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [reference, setReference] = useState('')
  const [serverAmount, setServerAmount] = useState(null)
  const [binanceLinks, setBinanceLinks] = useState(null)
  const [countdown, setCountdown] = useState(15 * 60)
  const [isFlipping, setIsFlipping] = useState(false)
  const [phase, setPhase] = useState(0)         // 0..3 timeline position
  const [dotPhase, setDotPhase] = useState(0)
  const [fallbackOpen, setFallbackOpen] = useState(false)
  const [txnInput, setTxnInput] = useState('')
  const [txnError, setTxnError] = useState('')
  const [txnPending, setTxnPending] = useState(false)
  const [copying, setCopying] = useState(null)

  const ref = useRef(null)
  const pollRef = useRef(null)
  const finishRef = useRef(false)
  useReveal(ref)
  useMagnetic(ref)

  useEffect(() => {
    if (authReady && !loggedIn) navigate('login') // purchasing requires sign-in
    else if (!selectedProduct) navigate('fields')
  }, [selectedProduct, navigate, authReady, loggedIn])

  // countdown + reference refresh (new order on expiry)
  useEffect(() => {
    if (stage !== 'verify' || !reference) return
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          regenerateOrder()
          return 15 * 60
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, reference])

  // poll real backend status — the ONLY thing that delivers the field
  useEffect(() => {
    if (stage !== 'verify' || !reference) return
    finishRef.current = false
    const tick = async () => {
      try {
        const r = await fetch(`/api/checkout/status?reference=${encodeURIComponent(reference)}`)
        if (!r.ok) return
        const d = await r.json()
        if (d.status === 'delivered' || d.status === 'paid') {
          handleConfirmed(d.txid || '')
        } else if (d.status === 'detected') {
          setPhase((p) => (p < 1 ? 1 : p))
        } else {
          setPhase((p) => (p < 1 ? p : p)) // stay
        }
      } catch {
        /* network blip — keep polling */
      }
    }
    tick()
    pollRef.current = setInterval(tick, POLL_MS)
    return () => clearInterval(pollRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, reference])

  // trailing dots ticker
  useEffect(() => {
    if (stage !== 'verify' || phase >= 3) return
    const id = setInterval(() => setDotPhase((d) => (d + 1) % 3), 380)
    return () => clearInterval(id)
  }, [stage, phase])

  useEffect(() => () => clearInterval(pollRef.current), [])

  if (!selectedProduct) return null

  const f = selectedProduct
  const total = priceOf(f)
  const free = total === 0
  const discount = appliedCoupon
    ? appliedCoupon.type === 'percent'
      ? Math.round((total * appliedCoupon.value) / 100)
      : Math.min(appliedCoupon.value, total)
    : 0
  const clientPayable = Math.max(0, total - discount)
  const payable = serverAmount != null ? serverAmount : clientPayable
  const methodLabel = payMethod === 'binance' ? 'Binance Pay' : 'PayPal'
  const cat = CAT[f.line] || { label: 'Field', cls: 'gold' }

  const dotStatus = (i) => {
    if (i < phase) return 'done'
    if (i === phase && phase < 3) return 'active'
    if (i === phase && phase === 3) return 'done'
    return 'idle'
  }

  const persistLocal = (confirmedTxid) => {
    try {
      localStorage.setItem(`wf_purchased_${f.id}`, '1')
      const orders = JSON.parse(localStorage.getItem('wf_orders') || '[]')
      orders.unshift({ id: reference, name: f.title, method: payMethod, amount: payable, ref: reference, txn: confirmedTxid, ts: Date.now() })
      localStorage.setItem('wf_orders', JSON.stringify(orders.slice(0, 50)))
    } catch { /* ignore */ }
  }

  // called ONLY when the backend confirms payment
  const handleConfirmed = (confirmedTxid) => {
    if (finishRef.current) return
    finishRef.current = true
    clearInterval(pollRef.current)
    setPhase(2) // confirming
    setTimeout(() => setPhase(3), 600) // delivered
    setTimeout(() => {
      persistLocal(confirmedTxid)
      goDelivered({ fieldId: f.id, method: payMethod, amount: payable, ref: reference, txn: confirmedTxid })
    }, 1400)
  }

  const createOrder = async () => {
    setCreating(true)
    setCreateError('')
    try {
      const r = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldId: f.id, method: payMethod, coupon: appliedCoupon?.code || null, email: user || null }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.reference) {
        setCreateError(
          d.error === 'not_configured'
            ? 'Checkout is not available right now. Please contact support.'
            : 'Could not start checkout. Please try again.',
        )
        setCreating(false)
        return false
      }
      setReference(d.reference)
      setServerAmount(d.amount)
      setBinanceLinks(d.binance || null)
      setCountdown(15 * 60)
      setPhase(0)
      setCreating(false)
      return true
    } catch {
      setCreateError('Network error. Please try again.')
      setCreating(false)
      return false
    }
  }

  const regenerateOrder = async () => {
    setIsFlipping(true)
    clearInterval(pollRef.current)
    finishRef.current = false
    await createOrder()
    setTimeout(() => setIsFlipping(false), 350)
  }

  const enterVerify = async () => {
    if (free) {
      // free fields: deliver immediately, no payment
      persistLocal('')
      goDelivered({ fieldId: f.id, method: payMethod, amount: 0, ref: 'FREE', txn: '' })
      return
    }
    setStage('verify')
    await createOrder()
  }

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase()
    if (!code) return
    setCouponBusy(true)
    setCouponMsg('')
    const res = await applyCoupon(code, f.id) // validated against this field server-side
    setCouponBusy(false)
    if (res?.error) { setCouponMsg(res.error); return }
    setAppliedCoupon({ code, type: res.coupon.type, value: res.coupon.value })
  }

  const copyField = async (text, key) => {
    try { await navigator.clipboard.writeText(String(text)) } catch { /* noop */ }
    setCopying(key)
    setTimeout(() => setCopying((k) => (k === key ? null : k)), 1800)
  }

  const submitFallbackTxn = async () => {
    const tx = txnInput.trim()
    if (tx.length < 6) { setTxnError('Enter a valid Transaction ID (min. 6 chars).'); return }
    setTxnError('')
    setTxnPending(true)
    try {
      const r = await fetch('/api/checkout/verify-txid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, txid: tx }),
      })
      const d = await r.json().catch(() => ({}))
      setTxnPending(false)
      if (d.status === 'delivered' || d.status === 'paid') {
        handleConfirmed(d.txid || tx)
      } else if (d.status === 'failed') {
        setTxnError('That transaction could not be verified. Check the ID and amount, or wait — we keep checking automatically.')
      } else {
        setTxnError('Not confirmed yet. We saved your ID and keep checking automatically — this can take a few minutes.')
      }
    } catch {
      setTxnPending(false)
      setTxnError('Network error. Please try again.')
    }
  }

  const goBackToMethod = () => {
    clearInterval(pollRef.current)
    finishRef.current = false
    setStage('method')
    setPhase(0)
    setReference('')
    setServerAmount(null)
    setBinanceLinks(null)
    setFallbackOpen(false)
    setTxnInput('')
    setTxnError('')
  }

  return (
    <div className="wf-app" ref={ref}>
      <Background resonanceTop="50%" />

      <section
        className="wf-section"
        style={{ maxWidth: stage === 'verify' ? 1060 : 560, margin: '0 auto', padding: '110px 28px 100px', transition: 'max-width 0.55s var(--wf-ease)' }}
      >

        {/* ===== STAGE: METHOD SELECT ===== */}
        {stage === 'method' && (
          <>
            <button className="wf-back" data-reveal onClick={() => openDetail(f.id)} style={{ marginBottom: 24 }}>
              ← Back to field
            </button>

            <div data-reveal><ProductCard f={f} cat={cat} /></div>

            <div className="wf-eyebrow" data-reveal style={{ marginTop: 30 }}>Checkout</div>
            <h1 className="wf-detail-title" data-reveal style={{ marginBottom: 30 }}>Complete your order.</h1>

            {free ? (
              <p className="wf-detail-desc" data-reveal>This field is on the house — no payment required.</p>
            ) : (
              <>
                <div className="wf-field-label" data-reveal style={{ marginBottom: 14 }}>Payment method</div>
                <div className="wf-pay-list" data-reveal>
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      className={`wf-pay-option${payMethod === m.id ? ' selected' : ''}`}
                      onClick={() => setPayMethod(m.id)}
                    >
                      <span className="wf-pay-radio" aria-hidden="true" />
                      <span className={`wf-pay-mark ${m.id}`}>
                        {m.id === 'paypal' ? <PayPalMark size={28} /> : <BinanceMark size={32} />}
                      </span>
                      <span className="wf-pay-text">
                        <span className="wf-pay-name">{m.label}</span>
                        <span className="wf-pay-desc">{m.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="wf-field-label" data-reveal style={{ margin: '22px 0 10px' }}>Discount code</div>
                {appliedCoupon ? (
                  <div className="wf-coupon-applied" data-reveal>
                    <span>
                      <strong>{appliedCoupon.code}</strong> applied ·{' '}
                      {appliedCoupon.type === 'percent' ? `${appliedCoupon.value}% off` : `$${appliedCoupon.value} off`}
                    </span>
                    <button type="button" aria-label="Remove coupon" onClick={() => { setAppliedCoupon(null); setCouponInput('') }}>
                      <CloseIcon size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="wf-coupon-row" data-reveal>
                    <input
                      className="wf-input"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                      placeholder="Enter code"
                    />
                    <button type="button" className="wf-coupon-apply wf-mag" onClick={handleApplyCoupon} disabled={couponBusy}>{couponBusy ? '…' : 'Apply'}</button>
                  </div>
                )}
                {couponMsg && <p className="wf-auth-error" style={{ marginTop: 10 }}>{couponMsg}</p>}

                <div className="wf-co-total-row" data-reveal>
                  <span>Total</span>
                  <span className="wf-co-total-amt">${clientPayable}</span>
                </div>
              </>
            )}

            <button className="wf-form-submit wf-mag wf-co-continue" data-reveal onClick={enterVerify}>
              <span>{free ? 'Get your field' : `Continue with ${methodLabel}`}</span>
              <span className="wf-co-arrow" aria-hidden="true">→</span>
            </button>
          </>
        )}

        {/* ===== STAGE: AUTO VERIFY ===== */}
        {stage === 'verify' && (
          <>
            <div className="wf-co-verify-top" data-reveal>
              <button className="wf-back" onClick={goBackToMethod}>← Change method</button>
              <span className="wf-co-auto-pill">✓ Automatic verification</span>
            </div>

            <div data-reveal><ProductCard f={f} cat={cat} compact /></div>

            {createError ? (
              <div className="wf-co-create-error" data-reveal>
                <p>{createError}</p>
                <button className="wf-form-submit wf-mag" onClick={createOrder} disabled={creating}>
                  {creating ? 'Starting…' : 'Try again'}
                </button>
              </div>
            ) : creating && !reference ? (
              <div className="wf-co-create-loading" data-reveal>
                <span className="wf-co-spin-glyph" aria-hidden="true">◌</span> Starting secure checkout…
              </div>
            ) : (
              <>
                {/* Reference banner */}
                <div className="wf-co-ref-banner" data-reveal>
                  <div className="wf-co-ref-inner">
                    <div>
                      <div className="wf-ref-eyebrow">Payment reference — include in your note</div>
                      <div className={`wf-ref-code${isFlipping ? ' flipping' : ''}`}>{reference}</div>
                    </div>
                    <button
                      className={`wf-payto-copy${copying === 'ref' ? ' copied' : ''}`}
                      style={{ alignSelf: 'center' }}
                      onClick={() => copyField(reference, 'ref')}
                    >
                      {copying === 'ref' ? <CheckIcon size={13} stroke={2.5} /> : 'Copy'}
                    </button>
                  </div>
                  <div className="wf-ref-timer">
                    <span className="wf-ref-time">{fmtTime(countdown)}</span>
                    <div className="wf-ref-bar">
                      <div className="wf-ref-bar-fill" style={{ width: `${(countdown / (15 * 60)) * 100}%` }} />
                    </div>
                    <span className="wf-ref-time-label">Reference refreshes automatically</span>
                  </div>
                </div>

                {/* Two-column grid */}
                <div className="wf-co-verify-grid">

                  {/* LEFT — send instructions */}
                  <div className="wf-co-send" data-reveal>
                    <div className="wf-co-send-title">
                      <span className={`wf-co-send-logo ${payMethod}`}>
                        {payMethod === 'paypal' ? <PayPalMark size={20} /> : <BinanceMark size={22} />}
                      </span>
                      <span>Send via {methodLabel}</span>
                    </div>

                    <div className="wf-co-amount-box">
                      <span className="wf-co-amount-label">Amount to pay</span>
                      <span className="wf-co-amount-value">${payable}</span>
                      <div className="wf-co-amount-shimmer" aria-hidden="true" />
                    </div>

                    <div className="wf-co-payee-block">
                      <CopyRow
                        label={payMethod === 'binance' ? 'Binance Pay UID' : 'PayPal email'}
                        value={payMethod === 'binance' ? BINANCE_ID : PAYPAL_EMAIL}
                        copyKey="target"
                        mono
                        copying={copying}
                        onCopy={copyField}
                      />
                      <div className="wf-co-payee-name">Payee: Waslerr Fields</div>
                    </div>

                    {payMethod === 'binance' && binanceLinks?.checkoutUrl && (
                      <a className="wf-co-binance-pay-btn wf-mag" href={binanceLinks.checkoutUrl} target="_blank" rel="noreferrer">
                        Pay instantly in Binance →
                      </a>
                    )}

                    <ol className="wf-co-steps">
                      {payMethod === 'binance' ? (
                        <>
                          <li>Open Binance → Pay → Send to Binance user</li>
                          <li>Paste the UID, send the exact amount, add the reference as a note</li>
                          <li>Done — we detect and verify your transfer automatically</li>
                        </>
                      ) : (
                        <>
                          <li>Open PayPal → Send Money</li>
                          <li>Paste the email, send the exact amount, add the reference in the note</li>
                          <li>Done — we detect and verify your transfer automatically</li>
                        </>
                      )}
                    </ol>

                    <div className="wf-co-encrypted">🔒 Encrypted in transit · verified server-side</div>
                  </div>

                  {/* RIGHT — live status */}
                  <div className="wf-co-watch" data-reveal>
                    <div className="wf-co-watch-title">
                      {phase < 2 ? 'Waiting for your payment…' : phase < 3 ? 'Confirming…' : 'Payment confirmed'}
                    </div>

                    <div className="wf-co-logo-rings">
                      <div className="wf-co-logo-center">
                        {payMethod === 'binance' ? (
                          <div style={{ animation: 'wf-binpulse 1.6s ease-in-out infinite' }}>
                            <BinanceMark size={46} />
                          </div>
                        ) : (
                          <div className="wf-pp-mark" style={{ width: 54, height: 54 }}>
                            <PayPalMark size={30} />
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="wf-co-watch-sub">
                      {phase < 3 ? 'Unlocks automatically once your payment is verified — nothing to submit.' : 'Your field has been delivered.'}
                    </p>

                    <div className="wf-co-timeline">
                      {TIMELINE.map((label, i) => {
                        const status = dotStatus(i)
                        return (
                          <div key={i} className={`wf-cot-row ${status}`}>
                            <span className={`wf-cot-dot ${status}`}>
                              {status === 'done' && <CheckIcon size={9} stroke={3} />}
                              {status === 'active' && <span className="wf-cot-spinner" />}
                            </span>
                            <span className="wf-cot-label">{label}</span>
                            {status === 'active' && <span className="wf-cot-trailing" aria-hidden="true">{DOTS_SEQ[dotPhase]}</span>}
                          </div>
                        )
                      })}
                    </div>

                    <div className="wf-co-autocheck">
                      <span className="wf-co-spin-glyph" aria-hidden="true">◌</span>
                      Auto-checking · verified on the server
                    </div>
                  </div>
                </div>

                {/* TXID fallback — last resort */}
                {phase < 2 && (
                  <div className="wf-co-fallback-wrap">
                    {!fallbackOpen ? (
                      <button className="wf-co-fallback-pill" onClick={() => setFallbackOpen(true)}>
                        <span aria-hidden="true">🕐</span>
                        Taking too long? Submit your transaction ID
                      </button>
                    ) : (
                      <div className="wf-co-fallback-input">
                        <input
                          className={`wf-input${txnError ? ' error' : ''}`}
                          value={txnInput}
                          onChange={(e) => { setTxnInput(e.target.value); setTxnError('') }}
                          onKeyDown={(e) => e.key === 'Enter' && submitFallbackTxn()}
                          placeholder="Paste your Transaction ID…"
                          disabled={txnPending}
                        />
                        <button
                          className="wf-form-submit wf-mag"
                          style={{ padding: '12px 22px', fontSize: 14, whiteSpace: 'nowrap' }}
                          onClick={submitFallbackTxn}
                          disabled={txnPending}
                        >
                          {txnPending ? 'Verifying…' : 'Verify →'}
                        </button>
                        <button className="wf-back" onClick={() => { setFallbackOpen(false); setTxnError('') }}>✕</button>
                      </div>
                    )}
                    {txnError && <p className="wf-auth-error" style={{ marginTop: 8, textAlign: 'center' }}>{txnError}</p>}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>
    </div>
  )
}
