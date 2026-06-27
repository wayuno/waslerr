import { useEffect, useRef, useState } from 'react'

// Load the PayPal JS SDK once and memoize the promise per client-id.
let sdkPromise = null
let sdkClientId = null
function loadPayPalSdk(clientId) {
  if (sdkPromise && sdkClientId === clientId) return sdkPromise
  sdkClientId = clientId
  sdkPromise = new Promise((resolve, reject) => {
    if (window.paypal) return resolve(window.paypal)
    const s = document.createElement('script')
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons&disable-funding=credit,paylater`
    s.async = true
    s.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error('sdk_no_paypal')))
    s.onerror = () => reject(new Error('sdk_load_failed'))
    document.head.appendChild(s)
  })
  return sdkPromise
}

/**
 * PayPal Smart Buttons — the buyer pays in-page; verification is server-side.
 *
 * createOrder  → backend /api/checkout/paypal/create-order (returns order id)
 * onApprove    → backend /api/checkout/paypal/capture (captures + verifies)
 *                → onVerified(txid) only on a confirmed COMPLETED capture.
 *
 * Props:
 *  - clientId, reference   required
 *  - onVerified(txid)      payment confirmed server-side → grant access
 *  - onProcessing(bool)    toggled while the capture call is in flight
 *  - onError(message)      surfaced to the buyer
 */
export default function PayPalButtons({ clientId, reference, onVerified, onProcessing, onError }) {
  const hostRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  // keep latest callbacks so the buttons (rendered once) never go stale
  const cbs = useRef({ onVerified, onProcessing, onError })
  useEffect(() => { cbs.current = { onVerified, onProcessing, onError } })

  useEffect(() => {
    if (!clientId || !reference) return
    let cancelled = false
    let buttons

    loadPayPalSdk(clientId)
      .then((paypal) => {
        if (cancelled || !hostRef.current) return
        buttons = paypal.Buttons({
          style: { layout: 'vertical', color: 'gold', shape: 'pill', label: 'pay', height: 46 },

          createOrder: async () => {
            const r = await fetch('/api/checkout/paypal/create-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reference }),
            })
            const d = await r.json().catch(() => ({}))
            if (!r.ok || !d.id) throw new Error(d.error || 'create_failed')
            return d.id
          },

          onApprove: async (data) => {
            cbs.current.onProcessing?.(true)
            try {
              const r = await fetch('/api/checkout/paypal/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reference, orderId: data.orderID }),
              })
              const d = await r.json().catch(() => ({}))
              if (d.status === 'delivered' || d.status === 'paid') {
                cbs.current.onVerified?.(d.txid || data.orderID)
              } else {
                cbs.current.onProcessing?.(false)
                cbs.current.onError?.('We couldn’t verify that payment. If you were charged, contact support and an admin will confirm it.')
              }
            } catch {
              cbs.current.onProcessing?.(false)
              cbs.current.onError?.('Network error while verifying. If you were charged, contact support.')
            }
          },

          onError: () => {
            cbs.current.onError?.('PayPal hit an error. Please try again, or contact support.')
          },
        })
        if (buttons.isEligible && !buttons.isEligible()) {
          setStatus('error')
          cbs.current.onError?.('PayPal isn’t available right now. Please contact support.')
          return
        }
        buttons.render(hostRef.current).then(() => !cancelled && setStatus('ready')).catch(() => !cancelled && setStatus('error'))
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error')
          cbs.current.onError?.('Couldn’t load PayPal. Check your connection or contact support.')
        }
      })

    return () => {
      cancelled = true
      try { if (buttons && buttons.close) buttons.close() } catch { /* noop */ }
    }
  }, [clientId, reference])

  return (
    <div className="wf-pp-buttons">
      {status === 'loading' && (
        <div className="wf-pp-loading">
          <span className="wf-co-spin-glyph" aria-hidden="true">◌</span> Loading secure PayPal checkout…
        </div>
      )}
      <div ref={hostRef} className={status === 'ready' ? 'ready' : ''} />
    </div>
  )
}
