import { useEffect } from 'react'
import { CloseIcon } from './icons'

const fmtDate = (ts) => {
  try {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}
const money = (n) => `$${(Number(n) || 0).toLocaleString('en-US')}`
// a 100%-off coupon order isn't paid via a provider → show "Coupon", not the method
const payLabel = (o) => {
  if (o.method === 'coupon' || (o.coupon && Number(o.amount) === 0)) return 'Coupon'
  if (o.method === 'binance') return 'Binance Pay'
  if (o.method === 'paypal') return 'PayPal'
  return o.method || '—'
}

export default function Receipt({ order: o, onClose }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const amount = Number(o.amount) || 0
  const discount = Number(o.discount) || 0
  const subtotal = o.subtotal != null ? Number(o.subtotal) : amount + discount
  const couponCode = o.coupon || (o.method === 'coupon' ? 'Coupon' : null)
  const status = o.status === 'delivered' ? 'Delivered' : o.status === 'paid' ? 'Paid' : o.status || 'Paid'

  return (
    <div className="wf-lm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wf-rcpt" role="dialog" aria-label="Order receipt">
        <div className="wf-rcpt-bar">
          <span className="wf-rcpt-eyebrow">Receipt</span>
          <button className="wf-lm-close" onClick={onClose} aria-label="Close">
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="wf-rcpt-head">
          <span className="wf-rcpt-mono" aria-hidden="true">W</span>
          <div className="wf-rcpt-headtext">
            <h2 className="wf-rcpt-name">{o.name || 'Waslerr field'}</h2>
            <span className={`wf-rcpt-status wf-rcpt-status--${o.status || 'paid'}`}>{status}</span>
          </div>
          <span className="wf-rcpt-total">{money(amount)}</span>
        </div>

        <div className="wf-rcpt-rows">
          <div className="wf-rcpt-row">
            <span>Date</span>
            <span>{fmtDate(o.ts)}</span>
          </div>
          <div className="wf-rcpt-row">
            <span>Payment</span>
            <span>{payLabel(o)}</span>
          </div>
          <div className="wf-rcpt-row">
            <span>Reference</span>
            <span className="wf-rcpt-mono-val">{o.ref || '—'}</span>
          </div>
          {o.txn && o.txn !== 'COUPON' && (
            <div className="wf-rcpt-row">
              <span>Transaction</span>
              <span className="wf-rcpt-mono-val">{o.txn}</span>
            </div>
          )}
        </div>

        <div className="wf-rcpt-divider" />

        <div className="wf-rcpt-rows">
          <div className="wf-rcpt-row">
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="wf-rcpt-row wf-rcpt-row--disc">
              <span>Discount{couponCode ? ` · ${couponCode}` : ''}</span>
              <span>−{money(discount)}</span>
            </div>
          )}
          <div className="wf-rcpt-row wf-rcpt-row--total">
            <span>Total paid</span>
            <span>{money(amount)}</span>
          </div>
        </div>

        <p className="wf-rcpt-foot">Lifetime access · Thank you for your purchase.</p>
      </div>
    </div>
  )
}
