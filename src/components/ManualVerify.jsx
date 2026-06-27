import { useEffect, useRef, useState } from 'react'
import { BinanceMark, CheckIcon, ArrowRight } from './icons'

// Stages shown while the REAL verification runs in the background.
// Steps 0–2 advance on a timer for feel; step 3 ("verified") only fills when
// the server actually confirms the payment — never on a timer.
const STEPS = ['Locating transaction', 'Matching payment reference', 'Confirming on-chain', 'Transaction verified']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Manual transaction-ID verification.
 *
 * State 1 — submit a TxID.
 * State 2 — verifying: animation plays WHILE the server checks the TxID against
 *           Binance (amount + id must match an unused transfer). Access is only
 *           granted when the server confirms.
 * State 3 — cancelled: if nothing is confirmed within `timeoutMs`, the attempt
 *           is cancelled and the buyer is routed to support. No field is
 *           delivered unless payment is verified.
 *
 * Props:
 *  - reference            order reference (shown in pills)
 *  - onVerify(txid)       async → server result { status, txid? } (POST verify-txid)
 *  - onPoll()             async → latest order status { status, txid? }
 *  - onVerified(txid)     called ONLY on a real server confirmation — grant access
 *  - onContactSupport()   open support chat
 *  - onClose()            back to automatic check
 *  - timeoutMs            give up + cancel after this long (default 60000)
 *  - pollMs               status poll interval while verifying (default 5000)
 *  - stageDuration        ms between the first visual steps (default 1400)
 *  - glow                 ambient gold glow on/off (default true)
 */
export default function ManualVerify({
  reference,
  onVerify,
  onPoll,
  onVerified,
  onContactSupport,
  onClose,
  timeoutMs = 60000,
  pollMs = 5000,
  stageDuration = 1400,
  glow = true,
}) {
  const [state, setState] = useState('submit') // 'submit' | 'verifying' | 'cancelled'
  const [txid, setTxid] = useState('')
  const [step, setStep] = useState(0) // 0..3 visual progress; 3 = confirmed
  const submitted = useRef('')
  const runId = useRef(0)

  // latest callbacks in a ref — the verifying effect runs once and must not
  // capture stale closures or be restarted by the parent's re-renders.
  const cbs = useRef({ onVerify, onPoll, onVerified })
  useEffect(() => { cbs.current = { onVerify, onPoll, onVerified } })

  const value = txid.trim()
  const canSubmit = value.length >= 6

  const start = () => {
    if (!canSubmit) return
    submitted.current = value
    setStep(0)
    setState('verifying')
  }

  const retry = () => {
    setTxid('')
    setStep(0)
    setState('submit')
  }

  // Drive the real verification while the animation plays. Runs once per entry
  // into the 'verifying' state (deps: [state]).
  useEffect(() => {
    if (state !== 'verifying') return
    const myRun = ++runId.current
    const alive = () => myRun === runId.current

    setStep(0)
    const t1 = setTimeout(() => alive() && setStep((s) => (s < 1 ? 1 : s)), stageDuration)
    const t2 = setTimeout(() => alive() && setStep((s) => (s < 2 ? 2 : s)), stageDuration * 2)

    const succeed = async (confTxid) => {
      if (!alive()) return
      setStep(3)
      await sleep(900) // let the "verified" check land before handing off
      if (alive()) cbs.current.onVerified?.(confTxid || submitted.current)
    }

    ;(async () => {
      const deadline = Date.now() + timeoutMs
      const done = (r) => r && (r.status === 'delivered' || r.status === 'paid')
      // immediate server check (records the TxID + tries to confirm now)
      const first = await cbs.current.onVerify?.(submitted.current)
      if (!alive()) return
      if (done(first)) return succeed(first.txid)
      // keep checking until the server confirms or the deadline passes
      while (alive() && Date.now() < deadline) {
        await sleep(pollMs)
        if (!alive()) return
        const s = await cbs.current.onPoll?.()
        if (!alive()) return
        if (done(s)) return succeed(s.txid)
      }
      if (alive()) setState('cancelled') // not confirmed in time — no access
    })()

    return () => {
      runId.current++ // invalidate this run on unmount / state change
      clearTimeout(t1)
      clearTimeout(t2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const last = STEPS.length - 1
  const stepStatus = (i) => {
    if (i < step || (i === step && i === last)) return 'done'
    if (i === step) return 'active'
    return 'idle'
  }

  return (
    <div className={`wf-mv${glow ? ' glow' : ''}`}>
      {/* ---- State 1: submit ---- */}
      {state === 'submit' && (
        <div className="wf-mv-card">
          <div className="wf-mv-head">
            <span className="wf-mv-eyebrow">Manual verification</span>
            {reference && <span className="wf-mv-ref">{reference}</span>}
          </div>

          <h2 className="wf-mv-title">Submit your transaction ID.</h2>
          <p className="wf-mv-body">
            Paste the Transaction ID (TxID) or order number from your Binance Pay receipt. We check it against
            Binance — the amount and ID must match your payment — and unlock your field the moment it's confirmed.
          </p>

          <input
            className="wf-mv-input"
            value={txid}
            onChange={(e) => setTxid(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && start()}
            placeholder="e.g. P_A22S9362PK971115"
            spellCheck={false}
            autoComplete="off"
            autoFocus
          />

          <button className="wf-mv-submit wf-mag" onClick={start} disabled={!canSubmit}>
            <span>Verify transaction</span>
            <ArrowRight size={15} />
          </button>

          <div className="wf-mv-lock">
            <span aria-hidden="true">🔒</span> Encrypted in transit · verified server-side
          </div>

          {onClose && (
            <button className="wf-back wf-mv-cancel" onClick={onClose}>← Back to automatic check</button>
          )}
        </div>
      )}

      {/* ---- State 2: verifying ---- */}
      {state === 'verifying' && (
        <div className="wf-mv-card verifying">
          <div className="wf-mv-scanner" aria-hidden="true">
            <span className="wf-mv-pulse wf-mv-pulse-1" />
            <span className="wf-mv-pulse wf-mv-pulse-2" />
            <span className="wf-mv-pulse wf-mv-pulse-3" />
            <span className="wf-mv-orbit"><span className="wf-mv-orbit-dot" /></span>
            <span className="wf-mv-tile"><BinanceMark size={30} /></span>
          </div>

          <span className="wf-mv-verifying-label">Verifying with transaction ID</span>

          <div className="wf-mv-txpill">
            <span className="wf-mv-txid">{submitted.current}</span>
            <span className="wf-mv-sweep" aria-hidden="true" />
          </div>

          <div className="wf-mv-steps">
            {STEPS.map((label, i) => {
              const status = stepStatus(i)
              return (
                <div key={i} className={`wf-mv-step ${status}`}>
                  <span className={`wf-mv-step-dot ${status}`}>
                    {status === 'done' ? (
                      <CheckIcon size={11} stroke={3} />
                    ) : status === 'active' ? (
                      <span className="wf-mv-blink" />
                    ) : (
                      <span className="wf-mv-num">{i + 1}</span>
                    )}
                  </span>
                  <span className="wf-mv-step-label">{label}</span>
                </div>
              )
            })}
          </div>

          <div className="wf-mv-foot">
            <span className="wf-co-spin-glyph" aria-hidden="true">◌</span>
            Checking Binance · this can take up to a minute
          </div>
        </div>
      )}

      {/* ---- State 3: cancelled (not confirmed in time) ---- */}
      {state === 'cancelled' && (
        <div className="wf-mv-card">
          <div className="wf-mv-warn" aria-hidden="true">!</div>

          <h2 className="wf-mv-title" style={{ textAlign: 'center' }}>Couldn't verify this payment.</h2>
          <p className="wf-mv-body" style={{ textAlign: 'center' }}>
            We couldn't match this transaction to your order automatically within a minute, so the attempt was
            cancelled. Nothing is delivered until a payment is confirmed. If you've paid, contact support with your
            details below and an admin will verify it manually.
          </p>

          <div className="wf-mv-cancel-meta">
            <div className="wf-mv-meta-row"><span>Reference</span><span className="mono">{reference || '—'}</span></div>
            <div className="wf-mv-meta-row"><span>Transaction ID</span><span className="mono">{submitted.current || '—'}</span></div>
          </div>

          <button className="wf-mv-submit wf-mag" onClick={() => onContactSupport?.()}>
            <span>Contact support</span>
            <ArrowRight size={15} />
          </button>
          <button className="wf-back wf-mv-cancel" onClick={retry}>← Try a different transaction ID</button>
        </div>
      )}
    </div>
  )
}
