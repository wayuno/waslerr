// Waslerr Fields — real payment verification (PayPal + Binance Pay).
// Zero npm deps: uses global fetch + node:crypto only.
//
// PayPal model
//   The merchant receives money to a PayPal account (ck806180@gmail.com). We
//   verify with the REST API:
//     - OAuth2 client_credentials → access token
//     - Transaction Search API (/v1/reporting/transactions): find a COMPLETED
//       transaction whose note/custom field contains our reference and whose
//       amount matches. This is how "verify by note-to-payee" works.
//     - Capture/Order lookup (/v2/checkout/orders, /v2/payments/captures): used
//       by the TXID fallback when the buyer pastes a capture/transaction id.
//   NOTE: Transaction Search must be enabled on the REST app, and reporting can
//   lag a few minutes-to-hours behind real time. The TXID fallback covers the
//   window where the note hasn't surfaced in reporting yet.
//
// Binance Pay model
//   Merchant API v2, HMAC-SHA512 signed. We create an order whose
//   merchantTradeNo === our reference, then poll order/query by that same
//   reference. tradeStatus PAY_SUCCESS / order status PAID = confirmed.

import crypto from 'node:crypto'

// ---------- env ----------
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || ''
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || ''
const PAYPAL_MODE = (process.env.PAYPAL_MODE || 'live').toLowerCase()
const PAYPAL_BASE = PAYPAL_MODE === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'

const BINANCE_PAY_API_KEY = process.env.BINANCE_PAY_API_KEY || ''
const BINANCE_PAY_SECRET_KEY = process.env.BINANCE_PAY_SECRET_KEY || ''
const BINANCE_PAY_BASE = process.env.BINANCE_PAY_BASE || 'https://bpay.binanceapi.com'

export const paypalConfigured = () => !!(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET)
export const binanceConfigured = () => !!(BINANCE_PAY_API_KEY && BINANCE_PAY_SECRET_KEY)

const money = (n) => Number(n).toFixed(2)
const amountsMatch = (a, b, tol = 0.01) => Math.abs(Number(a) - Number(b)) <= tol

// =====================================================================
// PayPal
// =====================================================================
let ppToken = null
let ppTokenExp = 0

async function paypalToken() {
  const now = Date.now()
  if (ppToken && now < ppTokenExp - 60_000) return ppToken
  const basic = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')
  const r = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  if (!r.ok) throw new Error(`paypal_oauth_${r.status}`)
  const d = await r.json()
  ppToken = d.access_token
  ppTokenExp = now + (Number(d.expires_in) || 3000) * 1000
  return ppToken
}

// Find a COMPLETED transaction whose note/custom field contains `reference`
// and whose gross amount matches `amount`. Returns { ok, txid, raw } | { ok:false }.
export async function paypalFindByReference(reference, amount) {
  if (!paypalConfigured()) return { ok: false, reason: 'not_configured' }
  let token
  try {
    token = await paypalToken()
  } catch (e) {
    return { ok: false, reason: e.message }
  }
  // search the last 31 days (API max window per call)
  const end = new Date()
  const start = new Date(end.getTime() - 31 * 24 * 3600 * 1000)
  const fmt = (d) => d.toISOString().replace(/\.\d+Z$/, '-0000')
  const qs = new URLSearchParams({
    start_date: fmt(start),
    end_date: fmt(end),
    fields: 'all',
    page_size: '100',
    page: '1',
  })
  try {
    const r = await fetch(`${PAYPAL_BASE}/v1/reporting/transactions?${qs}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    if (!r.ok) {
      const body = await r.text().catch(() => '')
      return { ok: false, reason: `search_${r.status}`, detail: body.slice(0, 300) }
    }
    const d = await r.json()
    const refUp = String(reference).toUpperCase()
    const txns = d.transaction_details || []
    for (const t of txns) {
      const info = t.transaction_info || {}
      const note = `${info.transaction_note || ''} ${info.transaction_subject || ''} ${info.invoice_id || ''} ${info.custom_field || ''}`.toUpperCase()
      const status = info.transaction_status // 'S' = success/completed
      const gross = info.transaction_amount && info.transaction_amount.value
      if (note.includes(refUp) && status === 'S' && (amount == null || amountsMatch(gross, amount))) {
        return { ok: true, txid: info.transaction_id, raw: info }
      }
    }
    return { ok: false, reason: 'not_found' }
  } catch (e) {
    return { ok: false, reason: e.message }
  }
}

// Verify a specific PayPal transaction/capture id (TXID fallback). Checks the
// transaction exists, is COMPLETED, and matches the amount (+ optional ref note).
export async function paypalVerifyTxid(txid, amount, reference) {
  if (!paypalConfigured()) return { ok: false, reason: 'not_configured' }
  let token
  try {
    token = await paypalToken()
  } catch (e) {
    return { ok: false, reason: e.message }
  }
  // 1) Try the Payments API capture lookup (works for Checkout captures).
  try {
    const r = await fetch(`${PAYPAL_BASE}/v2/payments/captures/${encodeURIComponent(txid)}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    if (r.ok) {
      const d = await r.json()
      const completed = d.status === 'COMPLETED'
      const val = d.amount && d.amount.value
      if (completed && (amount == null || amountsMatch(val, amount))) {
        return { ok: true, txid: d.id, raw: d }
      }
      if (completed) return { ok: false, reason: 'amount_mismatch', detail: `expected ${money(amount)} got ${val}` }
      return { ok: false, reason: `status_${d.status}` }
    }
  } catch {
    /* fall through to reporting search */
  }
  // 2) Fall back to Transaction Search and match by id (covers P2P "send money").
  const end = new Date()
  const start = new Date(end.getTime() - 31 * 24 * 3600 * 1000)
  const fmt = (d) => d.toISOString().replace(/\.\d+Z$/, '-0000')
  const qs = new URLSearchParams({
    start_date: fmt(start),
    end_date: fmt(end),
    transaction_id: txid,
    fields: 'all',
    page_size: '100',
    page: '1',
  })
  try {
    const r = await fetch(`${PAYPAL_BASE}/v1/reporting/transactions?${qs}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    if (!r.ok) return { ok: false, reason: `search_${r.status}` }
    const d = await r.json()
    const txns = d.transaction_details || []
    const t = txns.find((x) => (x.transaction_info || {}).transaction_id === txid)
    if (!t) return { ok: false, reason: 'not_found' }
    const info = t.transaction_info
    const gross = info.transaction_amount && info.transaction_amount.value
    if (info.transaction_status !== 'S') return { ok: false, reason: `status_${info.transaction_status}` }
    if (amount != null && !amountsMatch(gross, amount)) return { ok: false, reason: 'amount_mismatch' }
    // optional soft cross-check: if a reference is given, prefer a note match but
    // don't hard-fail (the buyer-supplied txid + amount match is already strong).
    if (reference) {
      const note = `${info.transaction_note || ''} ${info.transaction_subject || ''} ${info.invoice_id || ''} ${info.custom_field || ''}`.toUpperCase()
      if (note && !note.includes(String(reference).toUpperCase())) {
        return { ok: true, txid: info.transaction_id, raw: info, noteMatched: false }
      }
    }
    return { ok: true, txid: info.transaction_id, raw: info, noteMatched: true }
  } catch (e) {
    return { ok: false, reason: e.message }
  }
}

// =====================================================================
// Binance Pay (merchant API v2, HMAC-SHA512)
// =====================================================================
function binanceSign(body) {
  const timestamp = Date.now().toString()
  const nonce = crypto.randomBytes(16).toString('hex').toUpperCase().slice(0, 32)
  const payload = `${timestamp}\n${nonce}\n${body}\n`
  const signature = crypto.createHmac('sha512', BINANCE_PAY_SECRET_KEY).update(payload).digest('hex').toUpperCase()
  return { timestamp, nonce, signature }
}

async function binanceCall(pathname, bodyObj) {
  const body = JSON.stringify(bodyObj)
  const { timestamp, nonce, signature } = binanceSign(body)
  const r = await fetch(`${BINANCE_PAY_BASE}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'BinancePay-Timestamp': timestamp,
      'BinancePay-Nonce': nonce,
      'BinancePay-Certificate-SN': BINANCE_PAY_API_KEY,
      'BinancePay-Signature': signature,
    },
    body,
  })
  const data = await r.json().catch(() => ({}))
  return { httpOk: r.ok, data }
}

// Create a Binance Pay order with merchantTradeNo === reference. Returns the
// checkout links the buyer can use to pay inside Binance (instant verification).
export async function binanceCreateOrder({ reference, amount, goodsName }) {
  if (!binanceConfigured()) return { ok: false, reason: 'not_configured' }
  const bodyObj = {
    env: { terminalType: 'WEB' },
    merchantTradeNo: reference,
    orderAmount: Number(money(amount)),
    currency: 'USDT',
    goods: {
      goodsType: '02', // virtual goods
      goodsCategory: 'Z000',
      referenceGoodsId: reference,
      goodsName: (goodsName || 'Waslerr Field').slice(0, 256),
    },
  }
  try {
    const { httpOk, data } = await binanceCall('/binancepay/openapi/v3/order', bodyObj)
    if (httpOk && data.status === 'SUCCESS' && data.data) {
      return {
        ok: true,
        prepayId: data.data.prepayId,
        checkoutUrl: data.data.checkoutUrl,
        deeplink: data.data.deeplink,
        qrcodeLink: data.data.qrcodeLink,
        universalUrl: data.data.universalUrl,
      }
    }
    return { ok: false, reason: data.errorMessage || data.code || 'create_failed', raw: data }
  } catch (e) {
    return { ok: false, reason: e.message }
  }
}

// Query a Binance Pay order by reference (merchantTradeNo).
// Maps to a normalized status: 'paid' | 'pending' | 'detected' | 'failed'.
export async function binanceQueryOrder(reference) {
  if (!binanceConfigured()) return { ok: false, reason: 'not_configured' }
  try {
    const { httpOk, data } = await binanceCall('/binancepay/openapi/v3/order/query', { merchantTradeNo: reference })
    if (!httpOk || data.status !== 'SUCCESS' || !data.data) {
      return { ok: false, reason: data.errorMessage || data.code || 'query_failed', raw: data }
    }
    const d = data.data
    // d.status: INITIAL | PENDING | PAID | CANCELED | ERROR | REFUNDING | REFUNDED | EXPIRED
    let normalized = 'pending'
    if (d.status === 'PAID') normalized = 'paid'
    else if (d.status === 'PENDING') normalized = 'detected'
    else if (['CANCELED', 'ERROR', 'EXPIRED'].includes(d.status)) normalized = 'failed'
    return { ok: true, status: normalized, providerStatus: d.status, txid: d.transactionId || null, raw: d }
  } catch (e) {
    return { ok: false, reason: e.message }
  }
}
