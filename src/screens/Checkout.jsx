import { useEffect, useRef, useState, useCallback } from 'react'
import Background from '../components/Background'
import { useStore } from '../store/StoreProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'
import { PayPalMark, BinanceMark, CloseIcon, CheckIcon } from '../components/icons'

const PAYPAL_EMAIL = 'ck806180@gmail.com'
const BINANCE_ID = '767314103'

const LOCAL_COUPONS = {
  WASLERR10: { type: 'percent', value: 10 },
  FIELD15: { type: 'percent', value: 15 },
  AURA20: { type: 'percent', value: 20 },
}

const METHODS = [
  { id: 'paypal', label: 'PayPal', desc: 'Pay with your PayPal balance or any card.' },
  { id: 'binance', label: 'Binance Pay', desc: 'Pay with crypto — BTC, USDT or BNB.' },
]

const BINANCE_PHASES = ['Waiting for payment…', 'Payment detected', 'Confirming on-chain', 'Payment confirmed.']
const PAYPAL_PHASES = ['Connecting…', 'Matching transaction', 'Confirming amount', 'Payment confirmed.']

const priceOf = (f) =>
  f && f.priceNum != null ? Number(f.priceNum) : f && f.price ? parseFloat(String(f.price).replace(/[^0-9.]/g, '')) || 0 : 0

const catLabel = (line) => {
  const known = { desire: 'Desire', akashic: 'Akashic', wealth: 'Wealth' }
  return known[line] || (line ? line.charAt(0).toUpperCase() + line.slice(1) : 'Desire')
}

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function genRef(fieldId) {
  const fld = String(fieldId || 'FLD').slice(0, 3).toUpperCase()
  let s = ''
  for (let i = 0; i < 5; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)]
  return `WF-${fld}-${s}`
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function PayToRow({ label, value, copyKey, copying, onCopy, mono = false }) {
  const copied = copying === copyKey
  return (
    <div className="wf-payto-row">
      <span className="wf-payto-label">{label}</span>
      <span className={`wf-payto-value${mono ? ' mono' : ''}`}>{value}</span>
      <button
        className={`wf-payto-copy${copied ? ' copied' : ''}`}
        onClick={() => onCopy(value, copyKey)}
        aria-label={`Copy ${label}`}
      >
        {copied ? <CheckIcon size={13} stroke={2.5} /> : 'Copy'}
      </button>
    </div>
  )
}

function BinanceRadar({ phase }) {
  const phases = BINANCE_PHASES
  return (
    <div className="wf-radar-wrap">
      <div className="wf-radar-rings">
        <div className="wf-radar-ring" style={{ animationDelay: '0s' }} />
        <div className="wf-radar-ring" style={{ animationDelay: '0.6s' }} />
        <div className="wf-radar-ring" style={{ animationDelay: '1.2s' }} />
        <div className="wf-radar-sweep" />
        <div className="wf-radar-coin">
          <BinanceMark size={52} />
        </div>
      </div>
      <div className="wf-verify-phase">
        <div className="wf-verify-dots">
          <span style={{ animationDelay: '0s' }} />
          <span style={{ animationDelay: '0.2s' }} />
          <span style={{ animationDelay: '0.4s' }} />
        </div>
        <div className="wf-verify-text">{phases[Math.min(phase, 3)]}</div>
      </div>
      <div className="wf-chevflow" aria-hidden="true">
        {'›'.repeat(9).split('').map((c, i) => (
          <span key={i} style={{ animationDelay: `${i * 0.12}s` }}>{c}</span>
        ))}
      </div>
      <div className="wf-verify-steps">
        {phases.map((p, i) => (
          <div key={i} className={`wf-vstep${i <= phase ? ' done' : ''}${i === phase ? ' active' : ''}`}>
            <span className="wf-vstep-dot" />
            <span>{p}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PayPalSpinner({ phase }) {
  const phases = PAYPAL_PHASES
  return (
    <div className="wf-radar-wrap">
      <div className="wf-pp-spinner-wrap">
        <div className="wf-pp-ring" />
        <div className="wf-pp-mark">
          <PayPalMark size={36} />
        </div>
      </div>
      <div className="wf-verify-phase">
        <div className="wf-verify-dots">
          <span style={{ animationDelay: '0s' }} />
          <span style={{ animationDelay: '0.2s' }} />
          <span style={{ animationDelay: '0.4s' }} />
        </div>
        <div className="wf-verify-text">{phases[Math.min(phase, 3)]}</div>
      </div>
      <div className="wf-chevflow" aria-hidden="true">
        {'›'.repeat(9).split('').map((c, i) => (
          <span key={i} style={{ animationDelay: `${i * 0.12}s` }}>{c}</span>
        ))}
      </div>
      <div className="wf-verify-steps">
        {phases.map((p, i) => (
          <div key={i} className={`wf-vstep${i <= phase ? ' done' : ''}${i === phase ? ' active' : ''}`}>
            <span className="wf-vstep-dot" />
            <span>{p}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Checkout() {
  const { selectedProduct, payMethod, setPayMethod, navigate, openDetail, goDelivered } = useStore()

  // stage: 'method' | 'pay' | 'verifying'
  const [stage, setStage] = useState('method')
  const [couponInput, setCouponInput] = useState('')
  const [couponMsg, setCouponMsg] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [payRef, setPayRef] = useState('')
  const [countdown, setCountdown] = useState(15 * 60)
  const [txnInput, setTxnInput] = useState('')
  const [txnError, setTxnError] = useState('')
  const [verifyPhase, setVerifyPhase] = useState(-1)
  const [copying, setCopying] = useState(null)
  const [isFlipping, setIsFlipping] = useState(false)

  const ref = useRef(null)
  const timerRef = useRef(null)
  const verifyTimersRef = useRef([])
  useReveal(ref)
  useMagnetic(ref)

  useEffect(() => {
    if (!selectedProduct) navigate('fields')
  }, [selectedProduct, navigate])

  // countdown when in pay stage
  useEffect(() => {
    if (stage !== 'pay') return
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setIsFlipping(true)
          setTimeout(() => {
            setPayRef(genRef(selectedProduct?.id))
            setIsFlipping(false)
          }, 350)
          return 15 * 60
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [stage, selectedProduct])

  // cleanup verify timers on unmount
  useEffect(() => () => verifyTimersRef.current.forEach(clearTimeout), [])

  if (!selectedProduct) return null

  const f = selectedProduct
  const total = priceOf(f)
  const free = total === 0
  const discount = appliedCoupon
    ? appliedCoupon.type === 'percent'
      ? Math.round((total * appliedCoupon.value) / 100)
      : Math.min(appliedCoupon.value, total)
    : 0
  const payable = Math.max(0, total - discount)
  const methodLabel = payMethod === 'binance' ? 'Binance Pay' : 'PayPal'
  const payBtnLabel = free || payable === 0 ? 'Get your field' : `Pay $${payable} with ${methodLabel} →`

  const handleApplyCoupon = () => {
    const code = couponInput.trim().toUpperCase()
    const found = LOCAL_COUPONS[code]
    if (!found) {
      setCouponMsg('Invalid code.')
      return
    }
    setAppliedCoupon({ code, ...found })
    setCouponMsg('')
  }

  const copyField = async (text, key) => {
    try {
      await navigator.clipboard.writeText(String(text))
    } catch {
      /* noop */
    }
    setCopying(key)
    setTimeout(() => setCopying((k) => (k === key ? null : k)), 1800)
  }

  const enterPay = () => {
    if (free || payable === 0) {
      persistAndDeliver()
      return
    }
    const ref = genRef(f.id)
    setPayRef(ref)
    setCountdown(15 * 60)
    setTxnInput('')
    setTxnError('')
    setStage('pay')
  }

  const persistAndDeliver = (txn = '') => {
    try {
      localStorage.setItem(`wf_purchased_${f.id}`, '1')
      const orders = JSON.parse(localStorage.getItem('wf_orders') || '[]')
      orders.unshift({ id: payRef, name: f.title, method: payMethod, amount: payable, ref: payRef, txn, ts: Date.now() })
      localStorage.setItem('wf_orders', JSON.stringify(orders.slice(0, 50)))
    } catch {
      /* ignore */
    }
    goDelivered({ fieldId: f.id, method: payMethod, amount: payable, ref: payRef, txn })
  }

  const startVerify = () => {
    const txn = txnInput.trim()
    if (txn.length < 6) {
      setTxnError('Please enter your Transaction ID (min. 6 characters).')
      return
    }
    setTxnError('')
    setStage('verifying')
    setVerifyPhase(0)

    const delays = [1400, 2800, 4200, 5500]
    const timers = delays.map((d, i) =>
      setTimeout(() => setVerifyPhase(i + 1), d),
    )
    const nav = setTimeout(() => persistAndDeliver(txn), 6600)
    verifyTimersRef.current = [...timers, nav]
  }

  // ---- ORDER SUMMARY (shared across stages) ----
  const OrderSummary = (
    <div className="wf-order-card">
      <h3 className="wf-order-title">{f.title}</h3>
      <span className="wf-card-cat" style={{ display: 'block', marginBottom: 22 }}>
        {catLabel(f.line)} · lifetime access
      </span>
      <div className="wf-order-row">
        <span>Subtotal</span>
        <span>{free ? '$0' : `$${total}`}</span>
      </div>
      {discount > 0 && (
        <div className="wf-order-row">
          <span>Discount ({appliedCoupon.code})</span>
          <span>−${discount}</span>
        </div>
      )}
      <div className="wf-order-row">
        <span>Fees</span>
        <span>$0</span>
      </div>
      <div className="wf-order-row total">
        <span>Total</span>
        <span>{free ? '$0' : `$${payable}`}</span>
      </div>
      {stage === 'method' && (
        <button
          className="wf-form-submit wf-mag"
          style={{ marginTop: 22, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onClick={enterPay}
        >
          <span>{payBtnLabel}</span>
        </button>
      )}
      <p className="wf-form-note" style={{ marginTop: 12 }}>
        <span className="wf-auto-verified-badge">&#x2714; Auto-verified · instant access</span>
      </p>
    </div>
  )

  // ---- STAGE: METHOD SELECT ----
  const StageMethod = (
    <div>
      {free ? (
        <p className="wf-detail-desc">This field is on the house — no payment required. Claim it and start listening tonight.</p>
      ) : (
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

          <div className="wf-field-label" style={{ margin: '24px 0 12px' }}>
            Discount code
          </div>
          {appliedCoupon ? (
            <div className="wf-coupon-applied">
              <span>
                <strong>{appliedCoupon.code}</strong> applied ·{' '}
                {appliedCoupon.type === 'percent' ? `${appliedCoupon.value}% off` : `$${appliedCoupon.value} off`}
              </span>
              <button
                type="button"
                aria-label="Remove coupon"
                onClick={() => {
                  setAppliedCoupon(null)
                  setCouponInput('')
                }}
              >
                <CloseIcon size={14} />
              </button>
            </div>
          ) : (
            <div className="wf-coupon-row">
              <input
                className="wf-input"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                placeholder="Enter code"
              />
              <button type="button" className="wf-coupon-apply wf-mag" onClick={handleApplyCoupon}>
                Apply
              </button>
            </div>
          )}
          {couponMsg && <p className="wf-auth-error" style={{ marginTop: 10 }}>{couponMsg}</p>}
        </>
      )}
    </div>
  )

  // ---- STAGE: PAY INSTRUCTIONS ----
  const payTarget = payMethod === 'binance' ? BINANCE_ID : PAYPAL_EMAIL
  const payTargetLabel = payMethod === 'binance' ? 'Binance Pay ID' : 'PayPal email'
  const countdownPct = (countdown / (15 * 60)) * 100

  const StagePay = (
    <div>
      <div className="wf-pay-header">
        <div className={`wf-pay-header-mark ${payMethod}`}>
          {payMethod === 'paypal' ? <PayPalMark size={28} /> : <BinanceMark size={32} />}
        </div>
        <span className="wf-pay-header-name">{methodLabel}</span>
      </div>

      <p className="wf-pay-instructions">
        Send the exact amount using the details below, then paste your Transaction ID to verify.
      </p>

      <div className="wf-payto-list">
        <PayToRow label={payTargetLabel} value={payTarget} copyKey="target" copying={copying} onCopy={copyField} />
        <PayToRow label="Amount" value={`$${payable}`} copyKey="amount" copying={copying} onCopy={copyField} mono />
        <PayToRow label="Note to payee" value={payRef} copyKey="ref" copying={copying} onCopy={copyField} mono />
      </div>

      <div className="wf-ref-block">
        <div className="wf-ref-eyebrow">Reference — include in your payment note</div>
        <div className={`wf-ref-code${isFlipping ? ' flipping' : ''}`}>{payRef}</div>
        <div className="wf-ref-timer">
          <span className="wf-ref-time">{fmtTime(countdown)}</span>
          <div className="wf-ref-bar">
            <div className="wf-ref-bar-fill" style={{ width: `${countdownPct}%` }} />
          </div>
          <span className="wf-ref-time-label">Reference refreshes automatically</span>
        </div>
      </div>

      <div className="wf-txn-section">
        <label className="wf-field-label" htmlFor="wf-txn-input">
          Paste your Transaction ID
        </label>
        <div className="wf-txn-row">
          <input
            id="wf-txn-input"
            className={`wf-input${txnError ? ' error' : ''}`}
            value={txnInput}
            onChange={(e) => { setTxnInput(e.target.value); setTxnError('') }}
            onKeyDown={(e) => e.key === 'Enter' && startVerify()}
            placeholder="e.g. 8DK29FHQL..."
            style={{ flex: 1 }}
          />
          <button className="wf-form-submit wf-mag wf-verify-btn" onClick={startVerify}>
            Verify payment →
          </button>
        </div>
        {txnError && <p className="wf-auth-error" style={{ marginTop: 8 }}>{txnError}</p>}
      </div>

      <button className="wf-back" style={{ marginTop: 20 }} onClick={() => setStage('method')}>
        ← Change method
      </button>
    </div>
  )

  // ---- STAGE: VERIFYING ----
  const StageVerifying = (
    <div>
      <div className="wf-pay-header">
        <div className={`wf-pay-header-mark ${payMethod}`}>
          {payMethod === 'paypal' ? <PayPalMark size={28} /> : <BinanceMark size={32} />}
        </div>
        <span className="wf-pay-header-name">Verifying with {methodLabel}</span>
      </div>
      {payMethod === 'binance' ? <BinanceRadar phase={verifyPhase} /> : <PayPalSpinner phase={verifyPhase} />}
    </div>
  )

  return (
    <div className="wf-app" ref={ref}>
      <Background resonanceTop="50%" />

      <section className="wf-section" style={{ maxWidth: 980, margin: '0 auto', padding: '110px 28px 100px' }}>
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
          <div data-reveal className="wf-checkout-left">
            {stage === 'method' && StageMethod}
            {stage === 'pay' && StagePay}
            {stage === 'verifying' && StageVerifying}
          </div>

          <div className="wf-checkout-right" data-reveal>
            {OrderSummary}
          </div>
        </div>
      </section>
    </div>
  )
}
