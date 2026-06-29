import { useEffect, useRef, useState } from 'react'
import Background from '../components/Background'
import { useStore } from '../store/StoreProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'
import { PayPalMark, BinanceMark, CheckIcon } from '../components/icons'
import ManualVerify from '../components/ManualVerify'
import PayPalButtons from '../components/PayPalButtons'
import { loadConfig } from '../lib/supabase'

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

// Ambient gold particles for the PayPal panel background — fixed (not random)
// so they don't reshuffle on every render. x/y position, size, duration, delay.
const PP_PARTICLES = [
  { x: '6%', y: '72%', s: 3, d: '11s', delay: '0s' },
  { x: '14%', y: '30%', s: 2, d: '9s', delay: '1.4s' },
  { x: '22%', y: '88%', s: 4, d: '13s', delay: '0.6s' },
  { x: '31%', y: '52%', s: 2, d: '8s', delay: '2.2s' },
  { x: '40%', y: '18%', s: 3, d: '12s', delay: '3.1s' },
  { x: '48%', y: '80%', s: 2, d: '10s', delay: '0.9s' },
  { x: '57%', y: '40%', s: 3, d: '14s', delay: '2.6s' },
  { x: '64%', y: '66%', s: 2, d: '9s', delay: '1.1s' },
  { x: '72%', y: '24%', s: 4, d: '12s', delay: '4s' },
  { x: '79%', y: '58%', s: 2, d: '8s', delay: '0.3s' },
  { x: '86%', y: '84%', s: 3, d: '13s', delay: '2.9s' },
  { x: '91%', y: '36%', s: 2, d: '10s', delay: '1.7s' },
  { x: '36%', y: '94%', s: 3, d: '11s', delay: '3.6s' },
  { x: '67%', y: '12%', s: 2, d: '9s', delay: '0.5s' },
]

function LockGlyph({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
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
  const { selectedProduct, checkoutVersionId, payMethod, setPayMethod, navigate, openDetail, goDelivered, applyCoupon, user, loggedIn, authReady, openChat } = useStore()

  const [stage, setStage] = useState('method')

  // Method stage
  const [couponInput, setCouponInput] = useState('')
  const [couponMsg, setCouponMsg] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponBusy, setCouponBusy] = useState(false)
  const [unlockState, setUnlockState] = useState('idle') // idle | unlocking | unlocked
  const [unlockT, setUnlockT] = useState(0) // elapsed ms of the unlock animation (rAF clock)

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
  const [copying, setCopying] = useState(null)
  const [paypalClientId, setPaypalClientId] = useState(null)
  const [ppProcessing, setPpProcessing] = useState(false)
  const [ppError, setPpError] = useState('')

  const ref = useRef(null)
  const pollRef = useRef(null)
  const finishRef = useRef(false)
  useReveal(ref)
  useMagnetic(ref)

  useEffect(() => {
    if (authReady && !loggedIn) navigate('login') // purchasing requires sign-in
    else if (!selectedProduct) navigate('fields')
  }, [selectedProduct, navigate, authReady, loggedIn])

  // public PayPal SDK client id (for the in-page Smart Buttons)
  useEffect(() => {
    let alive = true
    loadConfig().then((c) => alive && setPaypalClientId((c && c.paypalClientId) || ''))
    return () => { alive = false }
  }, [])

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

  // Drive the unlock animation from a JS clock (rAF). CSS @keyframes can stall
  // in some embeds, so the padlock transforms + the live total countdown all
  // read from this elapsed-time value instead.
  useEffect(() => {
    if (unlockState !== 'unlocking') return
    let raf
    const t0 = performance.now()
    const loop = (now) => {
      const t = now - t0
      setUnlockT(t)
      if (t >= 1560) { setUnlockState('unlocked'); return }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [unlockState])

  if (!selectedProduct) return null

  const f = selectedProduct
  // a chosen version sets the price + which audio is delivered
  const chosenVersion =
    checkoutVersionId != null && Array.isArray(f.versions) ? f.versions.find((v) => v.id === checkoutVersionId) : null
  const total = chosenVersion ? Number(chosenVersion.price) || 0 : priceOf(f)
  const free = total === 0
  const discount = appliedCoupon
    ? appliedCoupon.type === 'percent'
      ? Math.round((total * appliedCoupon.value) / 100)
      : Math.min(appliedCoupon.value, total)
    : 0
  const clientPayable = Math.max(0, total - discount)
  const payable = serverAmount != null ? serverAmount : clientPayable
  // a coupon that covers the whole price → no payment, direct access to the field
  const fullUnlock = !!appliedCoupon && clientPayable === 0 && total > 0
  // unlock-animation timeline (ms), all eased off the rAF clock `unlockT`
  const easeOut = (p) => { p = Math.min(1, Math.max(0, p)); return 1 - Math.pow(1 - p, 3) }
  const uT = unlockT
  const popP = easeOut(uT / 400)
  const shakeP = uT >= 420 && uT < 900 ? (uT - 420) / 480 : -1
  const u = {
    lockOpacity: uT < 400 ? popP : 1,
    lockScale: uT < 400 ? 0.5 + 0.5 * popP + 0.1 * Math.sin(popP * Math.PI) : 1,
    lockRot: shakeP >= 0 ? Math.sin(shakeP * Math.PI * 6) * 8 * (1 - shakeP) : 0,
    shackle: uT >= 820 ? easeOut(Math.min(1, (uT - 820) / 540)) : 0,
    burst: uT >= 840 ? Math.min(1, (uT - 840) / 720) : 0,
  }
  const animTotal = uT < 560 ? total : uT < 1440 ? Math.round(total + (clientPayable - total) * easeOut((uT - 560) / 880)) : clientPayable
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
      orders.unshift({ id: reference, fieldId: f.id, name: f.title, method: payMethod, amount: payable, ref: reference, txn: confirmedTxid, ts: Date.now() })
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
        body: JSON.stringify({ fieldId: f.id, versionId: checkoutVersionId ?? null, method: payMethod, coupon: appliedCoupon?.code || null, email: user || null }),
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
    if (!code) { setCouponMsg('Enter a code to continue.'); return }
    setCouponBusy(true)
    setCouponMsg('')
    const res = await applyCoupon(code, f.id) // validated against this field server-side
    setCouponBusy(false)
    if (res?.error) { setCouponMsg("That code isn't valid. Check and try again."); return }
    setAppliedCoupon({ code, type: res.coupon.type, value: res.coupon.value })
    setUnlockT(0)
    setUnlockState('unlocking') // play the unlock reveal + count the total down
  }

  const resetCoupon = () => {
    setAppliedCoupon(null)
    setCouponInput('')
    setCouponMsg('')
    setUnlockT(0)
    setUnlockState('idle')
  }

  // full unlock: a coupon covered the whole price — the server comps the order
  // as delivered (no payment), then we go straight to the field.
  const claimFullUnlock = async () => {
    setCreating(true)
    setCreateError('')
    try {
      const r = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldId: f.id, versionId: checkoutVersionId ?? null, method: payMethod, coupon: appliedCoupon?.code || null, email: user || null }),
      })
      const d = await r.json().catch(() => ({}))
      setCreating(false)
      if (!r.ok || !d.reference) { setCreateError('Could not unlock the field. Please try again.'); return }
      // server is authoritative: only grant free access if IT comped the order.
      // otherwise payment is still due — fall through to the normal pay flow.
      if (!d.fullUnlock) {
        setReference(d.reference)
        setServerAmount(d.amount)
        setBinanceLinks(d.binance || null)
        setCountdown(15 * 60)
        setPhase(0)
        setStage('verify')
        return
      }
      try {
        localStorage.setItem(`wf_purchased_${f.id}`, '1')
        const orders = JSON.parse(localStorage.getItem('wf_orders') || '[]')
        orders.unshift({ id: d.reference, fieldId: f.id, name: f.title, method: 'coupon', amount: 0, ref: d.reference, txn: 'COUPON', ts: Date.now() })
        localStorage.setItem('wf_orders', JSON.stringify(orders.slice(0, 50)))
      } catch { /* ignore */ }
      goDelivered({ fieldId: f.id, method: 'coupon', amount: 0, ref: d.reference, txn: 'COUPON' })
    } catch {
      setCreating(false)
      setCreateError('Network error. Please try again.')
    }
  }

  const copyField = async (text, key) => {
    try { await navigator.clipboard.writeText(String(text)) } catch { /* noop */ }
    setCopying(key)
    setTimeout(() => setCopying((k) => (k === key ? null : k)), 1800)
  }

  // Real server check of a buyer-supplied TxID (matches amount + id on Binance).
  const verifyTxnOnce = async (txid) => {
    if (!reference) return { status: 'error' }
    try {
      const r = await fetch('/api/checkout/verify-txid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, txid }),
      })
      return await r.json().catch(() => ({ status: 'error' }))
    } catch {
      return { status: 'error' }
    }
  }

  // Poll the live order status (server confirms against the provider).
  const pollStatusOnce = async () => {
    if (!reference) return { status: 'pending' }
    try {
      const r = await fetch(`/api/checkout/status?reference=${encodeURIComponent(reference)}`)
      if (!r.ok) return { status: 'pending' }
      return await r.json().catch(() => ({ status: 'pending' }))
    } catch {
      return { status: 'pending' }
    }
  }

  // Called ONLY when the server confirms the payment → instant access.
  const grantManualAccess = (txid) => {
    if (finishRef.current) return
    finishRef.current = true
    clearInterval(pollRef.current)
    persistLocal(txid)
    goDelivered({ fieldId: f.id, method: payMethod, amount: payable, ref: reference, txn: txid })
  }

  // Couldn't auto-verify in time → hand off to support (admin verifies manually).
  const contactSupport = () => {
    clearInterval(pollRef.current)
    setFallbackOpen(false)
    openChat()
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
                <div className={`wf-pay-list${fullUnlock && unlockState === 'unlocked' ? ' wf-pay-covered' : ''}`} data-reveal>
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      className={`wf-pay-option${payMethod === m.id ? ' selected' : ''}`}
                      onClick={() => setPayMethod(m.id)}
                      disabled={fullUnlock && unlockState === 'unlocked'}
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
                  {fullUnlock && unlockState === 'unlocked' && (
                    <div className="wf-pay-cover">Covered in full — payment not required.</div>
                  )}
                </div>

                <div className="wf-field-label" data-reveal style={{ margin: '22px 0 10px' }}>Discount code</div>

                {unlockState === 'idle' && (
                  <>
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
                    {couponMsg && <p className="wf-auth-error" style={{ marginTop: 10 }}>{couponMsg}</p>}
                  </>
                )}

                {unlockState === 'unlocking' && (
                  <div className="wf-unlock" data-reveal>
                    <div className="wf-unlock-stage">
                      <span className="wf-unlock-burst" style={{ transform: `translate(-50%,-50%) scale(${0.4 + u.burst * 2.4})`, opacity: u.burst > 0 ? (1 - u.burst) * 0.85 : 0 }} />
                      <svg className="wf-unlock-lock" width="60" height="60" viewBox="0 0 48 48" aria-hidden="true" style={{ opacity: u.lockOpacity, transform: `scale(${u.lockScale}) rotate(${u.lockRot}deg)` }}>
                        <path d="M16 23 V16 a8 8 0 0 1 16 0 V23" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" style={{ transformOrigin: '16px 23px', transform: `translateY(${-u.shackle * 7}px) rotate(${-u.shackle * 26}deg)` }} />
                        <rect x="11" y="23" width="26" height="19" rx="4" fill="currentColor" />
                        <circle cx="24" cy="31" r="2.6" fill="#1a1407" />
                        <rect x="22.7" y="32" width="2.6" height="6" rx="1.3" fill="#1a1407" />
                      </svg>
                    </div>
                    <div className="wf-unlock-amt">${animTotal}</div>
                    <div className="wf-unlock-cap">Unlocking…</div>
                  </div>
                )}

                {unlockState === 'unlocked' && appliedCoupon && (
                  <div className={`wf-unlocked${fullUnlock ? ' full' : ''}`} data-reveal>
                    <div className="wf-unlocked-top">
                      <span className="wf-unlocked-tag">
                        {fullUnlock
                          ? 'Access granted · no payment needed'
                          : `Unlocked · ${appliedCoupon.code} · ${appliedCoupon.type === 'percent' ? `${appliedCoupon.value}% off` : `$${appliedCoupon.value} off`}`}
                      </span>
                      <button type="button" className="wf-unlocked-remove" onClick={resetCoupon}>Remove</button>
                    </div>
                    {discount > 0 && <div className="wf-unlocked-saved">You saved ${discount}</div>}
                    <div className="wf-unlocked-total">
                      {discount > 0 && <span className="wf-unlocked-strike">${total}</span>}
                      <span className="wf-unlocked-now">{fullUnlock ? 'Free' : `$${clientPayable}`}</span>
                    </div>
                  </div>
                )}

                {unlockState !== 'unlocked' && (
                  <div className="wf-co-total-row" data-reveal>
                    <span>Total</span>
                    <span className="wf-co-total-amt">${unlockState === 'unlocking' ? animTotal : clientPayable}</span>
                  </div>
                )}
              </>
            )}

            {free ? (
              <button className="wf-form-submit wf-mag wf-co-continue" data-reveal onClick={enterVerify}>
                <span>Get your field</span>
                <span className="wf-co-arrow" aria-hidden="true">→</span>
              </button>
            ) : fullUnlock && unlockState === 'unlocked' ? (
              <button className="wf-form-submit wf-mag wf-co-continue wf-access-btn" data-reveal onClick={claimFullUnlock} disabled={creating}>
                <span className="wf-confetti" aria-hidden="true">
                  {['6%', '17%', '29%', '41%', '53%', '64%', '76%', '88%', '12%', '35%', '59%', '83%'].map((left, i) => (
                    <span key={i} className="wf-confetti-bit" style={{ left, animationDelay: `${(i % 4) * 0.14}s`, animationDuration: `${1.5 + (i % 3) * 0.4}s`, background: i % 2 ? 'var(--wf-gold)' : 'var(--wf-gold-2)' }} />
                  ))}
                </span>
                <span>{creating ? 'Unlocking…' : 'Enter your field'}</span>
                <span className="wf-co-arrow" aria-hidden="true">→</span>
              </button>
            ) : (
              <button className="wf-form-submit wf-mag wf-co-continue" data-reveal onClick={enterVerify} disabled={unlockState === 'unlocking'}>
                <span>{`Continue with ${methodLabel}`}</span>
                <span className="wf-co-arrow" aria-hidden="true">→</span>
              </button>
            )}
          </>
        )}

        {/* ===== STAGE: AUTO VERIFY ===== */}
        {stage === 'verify' && (
          <>
            <div className="wf-co-verify-top" data-reveal>
              <button className="wf-back" onClick={goBackToMethod}>← Change method</button>
              <span className="wf-co-auto-pill">✓ Automatic verification</span>
            </div>

            {payMethod !== 'paypal' && <div data-reveal><ProductCard f={f} cat={cat} compact /></div>}

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
            ) : payMethod === 'paypal' ? (
              <div className="wf-pp-verify">
                <div className="wf-pp-ambient" aria-hidden="true">
                  <span className="wf-pp-glow wf-pp-glow-c" />
                  <span className="wf-pp-glow wf-pp-glow-tr" />
                  <span className="wf-pp-glow wf-pp-glow-bl" />
                  <span className="wf-pp-bgring wf-pp-bgring-1" />
                  <span className="wf-pp-bgring wf-pp-bgring-2" />
                  {PP_PARTICLES.map((p, i) => (
                    <span
                      key={i}
                      className="wf-pp-particle"
                      style={{ left: p.x, top: p.y, width: p.s, height: p.s, animationDuration: p.d, animationDelay: p.delay }}
                    />
                  ))}
                </div>

                <div className="wf-pp-grid">
                  {/* LEFT — order, live listening, how it works */}
                  <div className="wf-pp-left">
                    <div className="wf-pp-anim"><ProductCard f={f} cat={cat} /></div>

                    <div className="wf-pp-listen wf-pp-anim">
                      <div className="wf-pp-radar" aria-hidden="true">
                        <span className="wf-pp-radar-ring r1" />
                        <span className="wf-pp-radar-ring r2" />
                        <span className="wf-pp-radar-ring r3" />
                        <span className="wf-pp-radar-cv" />
                        <span className="wf-pp-radar-ch" />
                        <span className="wf-pp-radar-ping" />
                        <span className="wf-pp-radar-ping b" />
                        <span className="wf-pp-radar-sweep" />
                        <span className="wf-pp-radar-core" />
                      </div>
                      <span className="wf-pp-eyebrow gold">
                        <span className="wf-pp-live-dot" aria-hidden="true" />
                        Live
                      </span>
                      <h3 className="wf-pp-listen-title">Listening for your payment</h3>
                      <p className="wf-pp-listen-sub">
                        The moment PayPal confirms, your field unlocks automatically. Keep this tab open.
                      </p>
                      <div className="wf-pp-listen-dots"><span /><span /><span /></div>
                    </div>

                    <div className="wf-pp-how wf-pp-anim">
                      <span className="wf-pp-eyebrow">How it works</span>
                      <ol className="wf-pp-steps">
                        <li>
                          <span className="wf-pp-step-n">1</span>
                          <div>
                            <div className="wf-pp-step-t">Complete the PayPal payment</div>
                            <div className="wf-pp-step-d">Pay with your balance, bank, or any card.</div>
                          </div>
                        </li>
                        <li>
                          <span className="wf-pp-step-n">2</span>
                          <div>
                            <div className="wf-pp-step-t">We verify automatically</div>
                            <div className="wf-pp-step-d">PayPal confirms and we check it server-side.</div>
                          </div>
                        </li>
                        <li>
                          <span className="wf-pp-step-n">3</span>
                          <div>
                            <div className="wf-pp-step-t">Your field unlocks</div>
                            <div className="wf-pp-step-d">Access is granted instantly — no manual step.</div>
                          </div>
                        </li>
                      </ol>
                    </div>
                  </div>

                  {/* RIGHT — the PayPal payment card */}
                  <div className="wf-pp-card wf-pp-anim wf-pp-anim-delay">
                    <div className="wf-co-send-title">
                      <span className="wf-co-send-logo paypal"><PayPalMark size={20} /></span>
                      <span>Pay securely with PayPal</span>
                    </div>

                    <div className="wf-co-amount-box">
                      <span className="wf-co-amount-label">Amount to pay</span>
                      <span className="wf-co-amount-value">${payable}</span>
                      <div className="wf-co-amount-shimmer" aria-hidden="true" />
                    </div>

                    <p className="wf-co-pp-sub">
                      Pay with your PayPal balance or any card. The moment PayPal confirms, we verify it on our
                      server and unlock your field automatically — nothing to copy or paste.
                    </p>

                    {ppProcessing ? (
                      <div className="wf-co-pp-verifying">
                        <span className="wf-co-spin-glyph" aria-hidden="true">◌</span> Verifying your payment…
                      </div>
                    ) : paypalClientId === null ? (
                      <div className="wf-pp-loading">
                        <span className="wf-co-spin-glyph" aria-hidden="true">◌</span> Loading secure PayPal checkout…
                      </div>
                    ) : !paypalClientId ? (
                      <div className="wf-co-create-error" style={{ marginTop: 4 }}>
                        <p>PayPal isn’t available right now. Please contact support to complete your order.</p>
                      </div>
                    ) : (
                      <PayPalButtons
                        clientId={paypalClientId}
                        reference={reference}
                        onProcessing={setPpProcessing}
                        onError={(m) => { setPpProcessing(false); setPpError(m) }}
                        onVerified={(txid) => grantManualAccess(txid)}
                      />
                    )}

                    {ppError && <p className="wf-auth-error" style={{ marginTop: 12, textAlign: 'center' }}>{ppError}</p>}

                    <div className="wf-pp-powered">Powered by PayPal</div>
                    <div className="wf-pp-secure"><LockGlyph /> Paid securely via PayPal · verified server-side</div>
                    <button className="wf-co-pp-support" onClick={contactSupport}>
                      Still not verified? Contact support
                    </button>
                  </div>
                </div>
              </div>
            ) : fallbackOpen ? (
              <ManualVerify
                reference={reference}
                onVerify={verifyTxnOnce}
                onPoll={pollStatusOnce}
                onVerified={grantManualAccess}
                onContactSupport={contactSupport}
                onClose={() => setFallbackOpen(false)}
              />
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

                {/* TXID fallback — opens the manual verification screen */}
                {phase < 2 && (
                  <div className="wf-co-fallback-wrap">
                    <button className="wf-co-fallback-pill" onClick={() => setFallbackOpen(true)}>
                      <span aria-hidden="true">🕐</span>
                      Taking too long? Submit your transaction ID
                    </button>
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
