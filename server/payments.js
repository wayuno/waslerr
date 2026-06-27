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

// Regular Binance API keys (Binance → API Management, "Enable Reading" only).
// These let a PERSONAL account read its own Binance Pay transfer history via
// /sapi/v1/pay/transactions — no merchant account required. Falls back to the
// Pay keys if dedicated ones aren't set.
const BINANCE_API_KEY = process.env.BINANCE_API_KEY || BINANCE_PAY_API_KEY
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET || BINANCE_PAY_SECRET_KEY
const BINANCE_API_BASE = process.env.BINANCE_API_BASE || 'https://api.binance.com'
// stablecoins we treat as 1:1 with the USD order amount
const USD_STABLES = new Set(['USDT', 'USDC', 'BUSD', 'FDUSD', 'USD', 'TUSD', 'DAI'])

export const paypalConfigured = () => !!(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET)
export const binanceConfigured = () => !!(BINANCE_PAY_API_KEY && BINANCE_PAY_SECRET_KEY)
export const binanceApiConfigured = () => !!(BINANCE_API_KEY && BINANCE_API_SECRET)

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
      console.log('[binance] order created · merchantTradeNo=%s prepayId=%s', reference, data.data.prepayId)
      return {
        ok: true,
        prepayId: data.data.prepayId,
        checkoutUrl: data.data.checkoutUrl,
        deeplink: data.data.deeplink,
        qrcodeLink: data.data.qrcodeLink,
        universalUrl: data.data.universalUrl,
      }
    }
    // surface the real reason — almost always "account is not a Binance Pay
    // merchant" or "invalid signature / API key" or an IP-whitelist error.
    console.error('[binance] createOrder FAILED · code=%s msg=%s', data.code || '?', data.errorMessage || JSON.stringify(data).slice(0, 300))
    return { ok: false, reason: data.errorMessage || data.code || 'create_failed', raw: data }
  } catch (e) {
    console.error('[binance] createOrder ERROR ·', e.message)
    return { ok: false, reason: e.message }
  }
}

// Lightweight auth/merchant self-test: query a dummy order. With valid merchant
// credentials this returns a SUCCESS/known error; with bad keys/signature or a
// non-merchant account it returns the specific Binance error code.
export async function binanceDiagnose() {
  const out = { merchant: { configured: binanceConfigured() }, api: { configured: binanceApiConfigured() } }
  if (binanceConfigured()) {
    try {
      const { httpOk, data } = await binanceCall('/binancepay/openapi/v3/order/query', { merchantTradeNo: 'WF-DIAG-TEST' })
      out.merchant = { configured: true, httpOk, status: data.status || null, code: data.code || null, errorMessage: data.errorMessage || null }
    } catch (e) {
      out.merchant = { configured: true, error: e.message }
    }
  }
  // the path that matters for "verify without a merchant account"
  const h = await binancePayHistory({})
  if (h.ok) {
    // redacted sample so we can confirm the sender's note actually comes through
    const sample = h.list.slice(0, 5).map((t) => ({
      orderType: t.orderType,
      amount: t.amount,
      currency: t.currency,
      transactionId: rowTxid(t),
      hasNote: !!(t.note || t.remark),
      notePreview: String(t.note || t.remark || '').slice(0, 48),
    }))
    out.api = { configured: true, ok: true, recentCount: h.list.length, sample }
  } else {
    out.api = { configured: binanceApiConfigured(), ok: false, reason: h.reason, code: h.raw?.code || null }
  }
  return out
}

// =====================================================================
// Binance Pay verification WITHOUT a merchant account.
// Uses the regular signed API GET /sapi/v1/pay/transactions (HMAC-SHA256) to
// read this account's own Binance Pay transfer history, then matches an
// incoming transfer to an order by transactionId (manual) or amount+time (auto).
// =====================================================================
async function binanceSpotSigned(pathname, params = {}) {
  const qs = new URLSearchParams({ ...params, recvWindow: '60000', timestamp: Date.now().toString() })
  const signature = crypto.createHmac('sha256', BINANCE_API_SECRET).update(qs.toString()).digest('hex')
  qs.append('signature', signature)
  const r = await fetch(`${BINANCE_API_BASE}${pathname}?${qs.toString()}`, {
    headers: { 'X-MBX-APIKEY': BINANCE_API_KEY },
  })
  const data = await r.json().catch(() => ({}))
  return { httpOk: r.ok, data }
}

// Raw Binance Pay transaction history for this account (most recent first).
export async function binancePayHistory({ startTime, endTime } = {}) {
  if (!binanceApiConfigured()) return { ok: false, reason: 'not_configured' }
  try {
    const params = { limit: '100' }
    if (startTime) params.startTime = String(Math.floor(startTime))
    if (endTime) params.endTime = String(Math.floor(endTime))
    const { httpOk, data } = await binanceSpotSigned('/sapi/v1/pay/transactions', params)
    // success body: { code: "000000", data: [...], success: true }
    if (!httpOk || (data.code && data.code !== '000000')) {
      console.error('[binance] pay/transactions FAILED · code=%s msg=%s', data.code || '?', data.msg || data.message || JSON.stringify(data).slice(0, 200))
      return { ok: false, reason: data.msg || data.message || data.code || 'history_failed', raw: data }
    }
    return { ok: true, list: Array.isArray(data.data) ? data.data : [] }
  } catch (e) {
    console.error('[binance] pay/transactions ERROR ·', e.message)
    return { ok: false, reason: e.message }
  }
}

// Does a history row's amount/currency match the USD order amount?
const isAmountMatch = (t, amount) => {
  const cur = String(t.currency || '').toUpperCase()
  return USD_STABLES.has(cur) && amountsMatch(Math.abs(Number(t.amount)), amount)
}
// received funds are positive from our account's point of view
const isIncoming = (t) => Number(t.amount) > 0
const rowTxid = (t) => String(t.transactionId || t.orderId || t.id || '')

// the free-text note the sender typed, across the field names Binance uses
const noteOf = (t) => `${t.note || ''} ${t.remark || ''} ${t.orderId || ''}`.toUpperCase()

// Match an order against this account's incoming Binance Pay history.
// Returns { ok, byNote, byAmount[] }:
//   byNote   — an incoming transfer whose note carries our unique reference AND
//              whose amount matches (collision-proof — the preferred match).
//   byAmount — incoming transfers with the exact amount (fallback; the caller
//              dedupes these against txids already used by other orders).
export async function binanceMatchOrder({ reference, amount, sinceMs }) {
  const h = await binancePayHistory({ startTime: sinceMs ? sinceMs - 6 * 3600 * 1000 : undefined })
  if (!h.ok) return { ok: false, reason: h.reason }
  const floor = sinceMs ? sinceMs - 6 * 3600 * 1000 : 0
  const refUp = String(reference || '').toUpperCase()
  const recent = h.list.filter((t) => (Number(t.transactionTime) || 0) >= floor && isIncoming(t))
  const byNoteRow = refUp ? recent.find((t) => noteOf(t).includes(refUp) && isAmountMatch(t, amount)) || null : null
  const byAmount = recent
    .filter((t) => isAmountMatch(t, amount))
    .map((t) => ({ txid: rowTxid(t), amount: Math.abs(Number(t.amount)), currency: t.currency, time: Number(t.transactionTime) || 0, raw: t }))
  return { ok: true, byNote: byNoteRow ? { txid: rowTxid(byNoteRow), raw: byNoteRow } : null, byAmount }
}

// MANUAL: the buyer pasted a transaction id — confirm it exists in our history,
// is incoming, and the amount matches.
export async function binanceFindTxid({ txid, amount }) {
  const h = await binancePayHistory({})
  if (!h.ok) return { ok: false, reason: h.reason }
  const want = String(txid).trim()
  const t = h.list.find((x) => rowTxid(x) === want)
  if (!t) return { ok: false, reason: 'not_found' }
  if (!isAmountMatch(t, amount)) return { ok: false, reason: 'amount_or_currency_mismatch' }
  return { ok: true, txid: rowTxid(t), raw: t }
}

// Query a Binance Pay order by reference (merchantTradeNo).
// Maps to a normalized status: 'paid' | 'pending' | 'detected' | 'failed'.
export async function binanceQueryOrder(reference) {
  if (!binanceConfigured()) return { ok: false, reason: 'not_configured' }
  try {
    const { httpOk, data } = await binanceCall('/binancepay/openapi/v3/order/query', { merchantTradeNo: reference })
    if (!httpOk || data.status !== 'SUCCESS' || !data.data) {
      console.error('[binance] query FAILED · ref=%s code=%s msg=%s', reference, data.code || '?', data.errorMessage || JSON.stringify(data).slice(0, 200))
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
