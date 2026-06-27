import { useEffect, useRef, useState } from 'react'
import { BinanceMark, CheckIcon, ArrowRight } from './icons'

// Stages checked off one at a time during verification.
const STEPS = ['Locating transaction', 'Matching payment reference', 'Confirming on-chain', 'Transaction verified']

/**
 * Manual transaction-ID verification screen.
 *
 * State 1 — submit a TxID.
 * State 2 — animated "verifying" scanner + 4-step stepper.
 * On completion it hands the verified TxID back via onVerified — the caller
 * grants instant access (the "Your field is unlocked" screen).
 *
 * Props:
 *  - reference      order reference pill (e.g. WF-VAL-SY748)
 *  - stageDuration  ms per verification stage (default 1400)
 *  - glow           ambient gold glow on/off (default true)
 *  - onSubmit(txid) fired the moment a TxID is submitted (record server-side)
 *  - onVerified(txid) fired when the animation completes — grant access
 *  - onClose        return to the previous screen
 */
export default function ManualVerify({ reference, stageDuration = 1400, glow = true, onSubmit, onVerified, onClose }) {
  const [state, setState] = useState('submit') // 'submit' | 'verifying'
  const [txid, setTxid] = useState('')
  const [step, setStep] = useState(0)
  const submitted = useRef('')

  const value = txid.trim()
  const canSubmit = value.length > 0

  const start = () => {
    if (!canSubmit) return
    submitted.current = value
    onSubmit?.(value)
    setStep(0)
    setState('verifying')
  }

  // advance the stepper on a timer, then grant access after the last stage
  useEffect(() => {
    if (state !== 'verifying') return
    if (step >= STEPS.length - 1) {
      const t = setTimeout(() => onVerified?.(submitted.current), stageDuration)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setStep((s) => s + 1), stageDuration)
    return () => clearTimeout(t)
  }, [state, step, stageDuration, onVerified])

  const last = STEPS.length - 1
  const stepStatus = (i) => {
    if (i < step || (i === step && i === last)) return 'done'
    if (i === step) return 'active'
    return 'idle'
  }

  return (
    <div className={`wf-mv${glow ? ' glow' : ''}`}>
      {state === 'submit' ? (
        <div className="wf-mv-card" data-reveal>
          <div className="wf-mv-head">
            <span className="wf-mv-eyebrow">Manual verification</span>
            {reference && <span className="wf-mv-ref">{reference}</span>}
          </div>

          <h2 className="wf-mv-title">Submit your transaction ID.</h2>
          <p className="wf-mv-body">
            Paste the Transaction ID (TxID) or order number from your Binance Pay receipt. We match it against
            your reference and confirm the amount automatically.
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
      ) : (
        <div className="wf-mv-card verifying" data-reveal>
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
            Auto-checking · verified on the server
          </div>
        </div>
      )}
    </div>
  )
}
