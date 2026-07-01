// Waslerr Fields — Node backend (zero npm deps; uses global fetch + Supabase REST).
// Serves the built frontend (dist/) and an admin API backed by Supabase.
//
// Auth model:
//  - Users sign in via Supabase Auth in the browser (session persists).
//  - Admin = the logged-in user whose email === ADMIN_EMAIL.
//  - Privileged writes (add/delete product, upload image) go through this
//    server: it verifies the caller's Supabase token AND that the email is the
//    admin, then performs the write with the SERVICE_ROLE key (kept server-side).
//
// Env (set in Railway → Variables):
//   ADMIN_EMAIL
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY
//   PORT (Railway provides this)

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import {
  paypalConfigured,
  paypalClientId,
  paypalMode,
  paypalCreateOrder,
  paypalCaptureOrder,
  binanceConfigured,
  paypalFindByReference,
  paypalVerifyTxid,
  binanceCreateOrder,
  binanceQueryOrder,
  binanceDiagnose,
  binanceApiConfigured,
  binanceMatchOrder,
  binanceFindTxid,
} from './payments.js'
import { canCheckout, canDeliver } from './offer-state.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, '..', 'dist')

// --- minimal .env loader for local dev (Railway uses dashboard vars) ---
try {
  const envPath = path.join(__dirname, '..', '.env')
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
} catch {
  /* ignore */
}

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase()
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''
// Resetting the admin password on every boot invalidates the logged-in session
// (logs you out + 403s on every deploy). So we only sync it when explicitly
// asked via ADMIN_FORCE_PASSWORD=1 (e.g. right after you change the password).
const ADMIN_FORCE_PASSWORD = /^(1|true|yes)$/i.test(process.env.ADMIN_FORCE_PASSWORD || '')
// Secret deep-link path to reach the admin panel (e.g. "/control-7xk2q").
// When set, /admin no longer opens the panel — only this private path does.
const ADMIN_PATH = (() => {
  let p = (process.env.ADMIN_PATH || '').trim().toLowerCase()
  if (!p) return ''
  if (!p.startsWith('/')) p = '/' + p
  return p.replace(/\/+$/, '') || ''
})()
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '')
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const PORT = process.env.PORT || 8787

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.warn('[waslerr] Supabase env not fully set — admin writes will be disabled until configured.')
}
if (!ADMIN_EMAIL) console.warn('[waslerr] ADMIN_EMAIL not set — no one can be admin.')

const sendJson = (res, status, obj) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(obj))
}

const readBody = (req, max = 1e6) =>
  new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > max) req.destroy()
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })

// Verify the caller's Supabase access token; return { id, email, role } or null.
// Uses the service-role key as the apikey (known-valid) so verification doesn't
// depend on the anon key being correct.
const getAuthedUser = async (req) => {
  const auth = req.headers['authorization'] || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token || !SUPABASE_URL) return null
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SERVICE_KEY || ANON_KEY },
    })
    if (!r.ok) return null
    const u = await r.json()
    return {
      id: u.id,
      email: (u.email || '').trim().toLowerCase(),
      role: (u.app_metadata && u.app_metadata.role) || 'customer',
    }
  } catch {
    return null
  }
}

// Admin = the env owner email OR any user granted role 'admin'.
const requireAdmin = async (req, res) => {
  if (!ADMIN_EMAIL || !SERVICE_KEY) {
    sendJson(res, 503, { error: 'admin_not_configured' })
    return false
  }
  const u = await getAuthedUser(req)
  if (!u) {
    sendJson(res, 403, { error: 'forbidden', detail: 'not signed in or token expired — sign out and sign in again' })
    return false
  }
  if (u.email !== ADMIN_EMAIL && u.role !== 'admin') {
    sendJson(res, 403, { error: 'forbidden', detail: `signed in as ${u.email} (role: ${u.role}) — not the admin` })
    return false
  }
  return true
}

// Supabase REST helpers (service role bypasses RLS) --------------
const sbHeaders = () => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
})

// Newer columns added by later migrations. If a write fails only because one of
// these isn't in the table yet, we transparently retry without them so
// publishing/editing keeps working (they persist once the column is added).
const OPTIONAL_COLS = ['benefits', 'method', 'versions', 'audios']
const missingOptionalCol = (data) => {
  try {
    const s = JSON.stringify(data || '').toLowerCase()
    return OPTIONAL_COLS.some((c) => s.includes(c))
  } catch {
    return false
  }
}

// POST/PATCH to a PostgREST table, with the optional-column fallback above.
const sbWrite = async (urlStr, method, body) => {
  const send = (payload) =>
    fetch(urlStr, {
      method,
      headers: { ...sbHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    })
  let r = await send(body)
  let data = await r.json().catch(() => null)
  if (!r.ok && body && missingOptionalCol(data)) {
    const rest = { ...body }
    let stripped = false
    for (const c of OPTIONAL_COLS) if (c in rest) { delete rest[c]; stripped = true }
    if (stripped) {
      r = await send(rest)
      data = await r.json().catch(() => null)
    }
  }
  return { ok: r.ok, status: r.status, data: Array.isArray(data) ? data[0] : data }
}

const insertProduct = (body) => sbWrite(`${SUPABASE_URL}/rest/v1/products`, 'POST', body)

const updateProductRow = (id, patch) =>
  sbWrite(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, 'PATCH', patch)

const updateFreeFieldRow = (id, patch) =>
  sbWrite(`${SUPABASE_URL}/rest/v1/free_fields?id=eq.${encodeURIComponent(id)}`, 'PATCH', patch)

const deleteProduct = async (id) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: sbHeaders(),
  })
  return { ok: r.ok, status: r.status }
}

// Create a public storage bucket if it doesn't exist (idempotent, per-bucket).
const bucketEnsured = new Set()
const ensureBucket = async (bucket = 'product-images') => {
  if (bucketEnsured.has(bucket)) return true
  try {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bucket, name: bucket, public: true, file_size_limit: 26214400 }),
    })
    // 200 created, 409 already exists → both mean the bucket is ready
    if (r.ok || r.status === 409) {
      bucketEnsured.add(bucket)
      return true
    }
    // Supabase returns HTTP 400 with a 409 "Duplicate"/"already exists" body
    // when the bucket already exists — that's success, not a failure.
    const detail = await r.text().catch(() => '')
    if (/already exists|duplicate|"statuscode":\s*"?409/i.test(detail)) {
      bucketEnsured.add(bucket)
      return true
    }
    console.warn(`[waslerr] ensureBucket(${bucket}) failed:`, r.status, detail.slice(0, 200))
    return false
  } catch (e) {
    console.warn(`[waslerr] ensureBucket(${bucket}) error:`, e?.message)
    return false
  }
}

const uploadImage = async (filename, contentType, buffer, bucket = 'product-images') => {
  const safe = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const put = () =>
    fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURIComponent(safe)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        'Content-Type': contentType || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: buffer,
    })
  let r = await put()
  // bucket missing → create it and retry once
  if (!r.ok && (r.status === 404 || r.status === 400)) {
    await ensureBucket(bucket)
    r = await put()
  }
  if (!r.ok) {
    const detail = await r.text().catch(() => '')
    return { ok: false, status: r.status, detail: detail.slice(0, 300) }
  }
  return { ok: true, publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${safe}` }
}

const sbReady = () => SUPABASE_URL && SERVICE_KEY
const sbRest = (q, opts = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${q}`, { ...opts, headers: { ...sbHeaders(), ...(opts.headers || {}) } })

// --- coupons ---
const getCoupon = async (code) => {
  const r = await sbRest(`coupons?code=eq.${encodeURIComponent(code)}&active=eq.true&limit=1`)
  const d = await r.json().catch(() => [])
  return Array.isArray(d) && d[0] ? d[0] : null
}
const listCoupons = async () => {
  const r = await sbRest('coupons?order=created_at.desc')
  return r.ok ? r.json() : []
}
const insertCoupon = async (row) => {
  const r = await sbRest('coupons', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) })
  const d = await r.json().catch(() => null)
  return { ok: r.ok, status: r.status, data: Array.isArray(d) ? d[0] : d }
}
const removeCoupon = async (id) => (await sbRest(`coupons?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })).ok
// validate a coupon for a given field. Returns { ok } or { ok:false, reason }.
const validateCoupon = (c, fieldId) => {
  if (!c || c.active === false) return { ok: false, reason: 'invalid' }
  if (c.expires_at && Date.parse(c.expires_at) <= Date.now()) return { ok: false, reason: 'expired' }
  if (c.max_uses != null && Number(c.uses || 0) >= Number(c.max_uses)) return { ok: false, reason: 'used_up' }
  if (c.field_id && fieldId && c.field_id !== fieldId) return { ok: false, reason: 'wrong_field' }
  return { ok: true }
}
// increment redemption count once a coupon-bearing order is confirmed paid
const incrementCouponUse = async (code) => {
  if (!code) return
  const c = await getCoupon(code)
  if (!c) return
  await sbRest(`coupons?id=eq.${encodeURIComponent(c.id)}`, { method: 'PATCH', body: JSON.stringify({ uses: Number(c.uses || 0) + 1 }) })
}

// --- payments / orders ---------------------------------------------
// Merchant payee config (shown to the buyer). Override via env if needed.
const PAYPAL_EMAIL = process.env.PAYPAL_EMAIL || 'ck806180@gmail.com'
const BINANCE_PAY_ID = process.env.BINANCE_PAY_ID || '767314103'

// Server-side catalog price lookup (never trust the client). Returns the
// product row or null.
const getProductById = async (id) => {
  if (!sbReady() || !id) return null
  const r = await sbRest(`products?id=eq.${encodeURIComponent(id)}&limit=1`)
  const d = await r.json().catch(() => [])
  return Array.isArray(d) && d[0] ? d[0] : null
}

const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const genReference = (fieldTitle) => {
  const fld = (fieldTitle || 'FLD').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'FLD'
  let s = ''
  for (let i = 0; i < 5; i++) s += REF_CHARS[crypto.randomInt(REF_CHARS.length)]
  return `WF-${fld}-${s}`
}

const insertOrder = async (row) => {
  const send = (payload) => sbRest('orders', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) })
  let r = await send(row)
  let d = await r.json().catch(() => null)
  // retry without version_id if that column hasn't been added yet
  if (!r.ok && row.version_id !== undefined) {
    const s = (() => { try { return JSON.stringify(d || '').toLowerCase() } catch { return '' } })()
    if (s.includes('version_id')) {
      const { version_id, ...rest } = row // eslint-disable-line no-unused-vars
      r = await send(rest)
      d = await r.json().catch(() => null)
    }
  }
  return { ok: r.ok, status: r.status, data: Array.isArray(d) ? d[0] : d }
}
const getOrderByRef = async (reference) => {
  const r = await sbRest(`orders?reference=eq.${encodeURIComponent(reference)}&limit=1`)
  const d = await r.json().catch(() => [])
  return Array.isArray(d) && d[0] ? d[0] : null
}
// find any order already tagged with a given txid (so one Binance transfer can't
// confirm two different orders during amount-based auto-matching)
const getOrderByTxid = async (txid) => {
  if (!txid) return null
  const r = await sbRest(`orders?txid=eq.${encodeURIComponent(txid)}&limit=1`)
  const d = await r.json().catch(() => [])
  return Array.isArray(d) && d[0] ? d[0] : null
}
const updateOrder = async (reference, patch) => {
  const r = await sbRest(`orders?reference=eq.${encodeURIComponent(reference)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  })
  const d = await r.json().catch(() => null)
  return { ok: r.ok, data: Array.isArray(d) ? d[0] : d }
}

// Mark an order paid+delivered once (idempotent). Returns the updated order.
const markDelivered = async (order, { txid, meta } = {}) => {
  if (order.status === 'delivered' || order.status === 'paid') return order
  const out = await updateOrder(order.reference, {
    status: 'delivered',
    txid: txid || order.txid || null,
    // merge so the receipt breakdown (subtotal/discount) set at checkout survives;
    // the raw provider payload is kept under `provider` for audit
    meta: { ...(order.meta && typeof order.meta === 'object' ? order.meta : {}), ...(meta ? { provider: meta } : {}) },
  })
  // count the coupon redemption now that payment is confirmed (once)
  if (order.coupon) incrementCouponUse(order.coupon).catch(() => {})
  return out.data || { ...order, status: 'delivered' }
}

// Confirm a Binance order with whatever works — no merchant account required:
//   1) merchant order/query (instant, only if they ARE a Binance Pay merchant)
//   2) pay-history by the buyer's transaction id (strong, manual)
//   3) pay-history auto-match by amount + time window (deduped vs used txids)
// Returns { ok, txid?, raw?, via? }.
const confirmBinancePayment = async (order, { txid } = {}) => {
  const q = await binanceQueryOrder(order.reference)
  if (q.ok && q.status === 'paid') return { ok: true, txid: q.txid, raw: q.raw, via: 'merchant' }
  if (txid) {
    const v = await binanceFindTxid({ txid, amount: Number(order.amount) })
    if (v.ok) {
      const used = await getOrderByTxid(v.txid)
      if (!used || used.reference === order.reference) return { ok: true, txid: v.txid, raw: v.raw, via: 'txid' }
    }
    return { ok: false }
  }
  if (binanceApiConfigured()) {
    const sinceMs = Date.parse(order.created_at) || 0
    const m = await binanceMatchOrder({ reference: order.reference, amount: Number(order.amount), sinceMs })
    if (m.ok) {
      // 1) note carries our unique reference + amount matches → collision-proof
      if (m.byNote) {
        const used = m.byNote.txid ? await getOrderByTxid(m.byNote.txid) : null
        if (!used || used.reference === order.reference) return { ok: true, txid: m.byNote.txid, raw: m.byNote.raw, via: 'note' }
      }
      // 2) fallback: exact-amount incoming transfer, deduped against used txids
      for (const c of m.byAmount || []) {
        const used = c.txid ? await getOrderByTxid(c.txid) : null
        if (!used || used.reference === order.reference) return { ok: true, txid: c.txid, raw: c.raw, via: 'amount' }
      }
    }
  }
  return { ok: false }
}

// --- free fields (separate table from paid products) ---------------
const listFreeFields = async () => {
  const r = await sbRest('free_fields?order=created_at.desc')
  return r.ok ? r.json() : []
}
const getFreeFieldById = async (id) => {
  const r = await sbRest(`free_fields?id=eq.${encodeURIComponent(id)}&limit=1`)
  const d = await r.json().catch(() => [])
  return Array.isArray(d) && d[0] ? d[0] : null
}
// retry without benefits if that column isn't in the table yet
const insertFreeField = (row) => sbWrite(`${SUPABASE_URL}/rest/v1/free_fields`, 'POST', row)
const removeFreeField = async (id) => (await sbRest(`free_fields?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })).ok

// normalize an incoming benefits list to a clean string[] (trimmed, no blanks,
// capped) for the products / free_fields `benefits` column
const cleanBenefits = (v) =>
  Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean).slice(0, 30) : []

// sanitize an incoming Listening Method object for the `method` jsonb column
const cleanMethod = (m) => {
  if (!m || typeof m !== 'object') return null
  const str = (v, n) => String(v ?? '').slice(0, n)
  return {
    headline: str(m.headline, 120),
    intro: str(m.intro, 800),
    steps: Array.isArray(m.steps)
      ? m.steps.slice(0, 12).map((s) => ({
          id: str(s && s.id ? s.id : Math.random().toString(36).slice(2), 24),
          icon: str(s && s.icon ? s.icon : 'sparkle', 16),
          title: str(s && s.title, 80),
          body: str(s && s.body, 500),
        }))
      : [],
    pills: Array.isArray(m.pills) ? m.pills.map((p) => str(p, 48).trim()).filter(Boolean).slice(0, 10) : [],
  }
}

// sanitize a bundle of audio files for the `audios` jsonb column
const cleanAudios = (a) =>
  Array.isArray(a)
    ? a
        .filter((x) => x && x.path)
        .slice(0, 30)
        .map((x) => ({
          path: String(x.path).slice(0, 400),
          name: String(x.name || 'Audio').slice(0, 200),
          size: Math.max(0, Number(x.size) || 0),
        }))
    : []

// sanitize an incoming versions list for the `versions` jsonb column
const cleanVersions = (v) =>
  Array.isArray(v)
    ? v.slice(0, 20).map((x, i) => {
        const audios = cleanAudios(x && x.audios)
        return {
          id: Number(x && x.id) || i + 1,
          name: String(x && x.name ? x.name : 'Version').slice(0, 60),
          price: Math.max(0, Number(x && x.price) || 0),
          tagline: String(x && x.tagline ? x.tagline : '').slice(0, 160),
          // legacy single path = first file (keeps old downloads working)
          audio: String(x && x.audio ? x.audio : (audios[0] ? audios[0].path : '')),
          audios, // full bundle — buyers of this version get them all
          method: x && x.method ? cleanMethod(x.method) : null, // each cut can have its own listening method
        }
      })
    : []

// --- conversation delete (clears all messages in a thread) ---------
const removeConversation = async (conversationId) =>
  (await sbRest(`support_messages?conversation_id=eq.${encodeURIComponent(conversationId)}`, { method: 'DELETE' })).ok

// --- stats (aggregated from real orders) ---------------------------
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Window boundaries (local server time).
const statWindows = () => {
  const day = 864e5
  const d = new Date()
  return {
    weekAgo: Date.now() - 7 * day,
    monthStart: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
    yearStart: new Date(d.getFullYear(), 0, 1).getTime(),
  }
}

// Read the dedicated stats_daily rollup table → time-windowed aggregates +
// 6-month bars. Returns null if the table isn't there yet (pre-migration).
const aggregateFromDaily = async () => {
  const r = await sbRest('stats_daily?select=day,revenue,sales,downloads&order=day.asc&limit=4000')
  if (!r.ok) return null
  const rows = await r.json().catch(() => [])
  const { weekAgo, monthStart, yearStart } = statWindows()
  const out = {
    revenueWeek: 0, revenueMonth: 0, revenueYear: 0, revenueTotal: 0,
    salesWeek: 0, salesMonth: 0, salesYear: 0, salesTotal: 0,
    downloadsTotal: 0,
  }
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, m: MONTH_NAMES[d.getMonth()], v: 0 })
  }
  const monthIndex = new Map(months.map((mm, i) => [mm.key, i]))
  for (const row of rows) {
    const rev = Number(row.revenue) || 0
    const sales = Number(row.sales) || 0
    const ts = Date.parse(row.day) || 0
    out.revenueTotal += rev; out.salesTotal += sales; out.downloadsTotal += Number(row.downloads) || 0
    if (ts >= weekAgo) { out.revenueWeek += rev; out.salesWeek += sales }
    if (ts >= monthStart) { out.revenueMonth += rev; out.salesMonth += sales }
    if (ts >= yearStart) { out.revenueYear += rev; out.salesYear += sales }
    const dd = new Date(ts)
    const mk = `${dd.getFullYear()}-${dd.getMonth()}`
    if (monthIndex.has(mk)) months[monthIndex.get(mk)].v += rev
  }
  out.monthly = months.map((m) => ({ m: m.m, v: m.v }))
  return out
}

// Fallback (pre-migration): derive the same aggregates by scanning orders.
const aggregateFromOrders = async (orders) => {
  const { weekAgo, monthStart, yearStart } = statWindows()
  const out = {
    revenueWeek: 0, revenueMonth: 0, revenueYear: 0, revenueTotal: 0,
    salesWeek: 0, salesMonth: 0, salesYear: 0, salesTotal: orders.length, downloadsTotal: orders.length,
  }
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, m: MONTH_NAMES[d.getMonth()], v: 0 })
  }
  const monthIndex = new Map(months.map((mm, i) => [mm.key, i]))
  for (const o of orders) {
    const amt = Number(o.amount) || 0
    const ts = Date.parse(o.created_at) || 0
    out.revenueTotal += amt
    if (ts >= weekAgo) { out.revenueWeek += amt; out.salesWeek++ }
    if (ts >= monthStart) { out.revenueMonth += amt; out.salesMonth++ }
    if (ts >= yearStart) { out.revenueYear += amt; out.salesYear++ }
    const d = new Date(ts)
    const mk = `${d.getFullYear()}-${d.getMonth()}`
    if (monthIndex.has(mk)) months[monthIndex.get(mk)].v += amt
  }
  out.monthly = months.map((m) => ({ m: m.m, v: m.v }))
  return out
}

const computeStats = async () => {
  // Revenue / sales / monthly come from the dedicated stats_daily rollup table.
  // Orders are still read for the per-field "top fields" breakdown (the rollup
  // is by day, not by field) and as a fallback before stats.sql is applied.
  const ordersRes = await sbRest('orders?status=in.(paid,delivered)&select=amount,field_id,field_title,created_at&order=created_at.desc&limit=5000')
  const orders = ordersRes.ok ? await ordersRes.json() : []

  const agg = (await aggregateFromDaily()) || (await aggregateFromOrders(orders))

  // top fields by units sold (from orders — per-field detail)
  const byField = new Map()
  for (const o of orders) {
    const amt = Number(o.amount) || 0
    const fid = o.field_id || o.field_title || 'unknown'
    const cur = byField.get(fid) || { id: fid, title: o.field_title || 'Field', units: 0, revenue: 0 }
    cur.units++; cur.revenue += amt
    byField.set(fid, cur)
  }
  const topFields = [...byField.values()].sort((a, b) => b.units - a.units).slice(0, 5)

  // catalog + support counts
  const pc = await sbRest('products?select=id')
  const products = pc.ok ? await pc.json() : []
  const ffc = await sbRest('free_fields?select=id')
  const free = ffc.ok ? await ffc.json() : []
  const convs = await getConversations()

  return {
    ...agg,
    fieldsPublished: products.length,
    freeFields: free.length,
    supportChats: convs.length,
    topFields,
  }
}

// --- support chat ---
const insertMessage = async (row) => {
  const r = await sbRest('support_messages', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) })
  const d = await r.json().catch(() => null)
  return { ok: r.ok, data: Array.isArray(d) ? d[0] : d }
}
const getMessages = async (conversationId) => {
  const r = await sbRest(`support_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&order=created_at.asc`)
  return r.ok ? r.json() : []
}
const getMessageById = async (id) => {
  const r = await sbRest(`support_messages?id=eq.${encodeURIComponent(id)}&limit=1`)
  const d = await r.json().catch(() => [])
  return Array.isArray(d) && d[0] ? d[0] : null
}
const updateMessage = async (id, patch) => {
  const r = await sbRest(`support_messages?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  })
  const d = await r.json().catch(() => null)
  return { ok: r.ok, data: Array.isArray(d) ? d[0] : d }
}

// --- offers (field offered in chat → pay → deliver) ----------------
const insertOffer = async (row) => {
  const r = await sbRest('offers', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) })
  const d = await r.json().catch(() => null)
  return { ok: r.ok, status: r.status, data: Array.isArray(d) ? d[0] : d }
}
const getOffer = async (id) => {
  const r = await sbRest(`offers?id=eq.${encodeURIComponent(id)}&limit=1`)
  const d = await r.json().catch(() => [])
  return Array.isArray(d) && d[0] ? d[0] : null
}
const updateOffer = async (id, patch) => {
  const r = await sbRest(`offers?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  })
  const d = await r.json().catch(() => null)
  return { ok: r.ok, data: Array.isArray(d) ? d[0] : d }
}
const listOffersForConversation = async (conversationId) => {
  const r = await sbRest(`offers?conversation_id=eq.${encodeURIComponent(conversationId)}&order=created_at.asc`)
  return r.ok ? r.json() : []
}
const listAllOffers = async () => {
  const r = await sbRest('offers?order=created_at.asc&limit=500')
  return r.ok ? r.json() : []
}
// client-safe shape (no storage path; download goes through the gated endpoint)
const publicOffer = (o) => ({
  id: o.id,
  conversationId: o.conversation_id,
  name: o.name,
  description: o.description || '',
  amount: Number(o.amount),
  currency: o.currency || 'USD',
  deliveryEstimate: o.delivery_estimate || '6–7 days',
  includes: Array.isArray(o.includes) ? o.includes : [],
  status: o.status,
  paymentMethod: o.payment_method || null,
  deliveryFileName: o.delivery_file_name || null,
  // names + sizes only — downloads go through the gated endpoint by index
  deliveryFiles: Array.isArray(o.delivery_files) ? o.delivery_files.map((f) => ({ name: f.name, size: f.size || 0 })) : [],
  deliveryNote: o.delivery_note || null,
  hasFile: !!o.delivery_file_url || (Array.isArray(o.delivery_files) && o.delivery_files.length > 0),
  createdAt: o.created_at,
  paidAt: o.paid_at || null,
  deliveredAt: o.delivered_at || null,
  requestMessageId: o.request_message_id != null ? String(o.request_message_id) : null,
})

// admin-only shape: everything in publicOffer + the request-workspace fields.
// internal_note lives ONLY here — never in publicOffer (would leak to the customer).
// productionStatus is the 4-stage production pipeline (requested→production→review→
// delivered), kept separate from the payment `status`. Once a file is actually
// delivered we surface 'delivered' regardless of the stored stage.
const PRODUCTION_STAGES = ['requested', 'production', 'review', 'delivered']
const adminOffer = (o) => ({
  ...publicOffer(o),
  customerEmail: o.customer_email || null,
  productionStatus: o.status === 'delivered' ? 'delivered' : (o.production_status || 'requested'),
  focus: o.focus || '',
  intention: o.intention || '',
  budget: o.budget || '',
  lengthEstimate: o.length_estimate || '',
  internalNote: o.internal_note || '',
  requestedAt: o.requested_at || o.created_at,
})

// Idempotent: when an offer's order is confirmed paid, flip the offer to `paid`
// once and append the systemPaid pill + the admin auto-reply. Safe to call on
// every status poll — does nothing if already paid/delivered.
const PAID_REPLY =
  'Payment confirmed — your field has entered production. Expect delivery within 6–7 days; we’ll notify you right here the moment it’s ready.'
const confirmOfferPaid = async (offer, { txid, method } = {}) => {
  if (!offer || offer.status !== 'sent') return offer
  const out = await updateOffer(offer.id, {
    status: 'paid',
    paid_at: new Date().toISOString(),
    payment_method: method || offer.payment_method || null,
  })
  const updated = out.data || { ...offer, status: 'paid' }
  // append the system pill + admin auto-reply (guarded so retries don't dupe)
  const existing = await getMessages(offer.conversation_id)
  const hasPaidPill = existing.some((m) => m.kind === 'systemPaid' && m.meta && m.meta.offerId === offer.id)
  if (!hasPaidPill) {
    await insertMessage({
      conversation_id: offer.conversation_id,
      sender: 'system',
      kind: 'systemPaid',
      body: `Payment received · $${Number(offer.amount)} ${offer.currency || 'USD'}`,
      meta: { offerId: offer.id, txid: txid || null },
    })
    await insertMessage({
      conversation_id: offer.conversation_id,
      sender: 'admin',
      kind: 'text',
      body: PAID_REPLY,
    })
  }
  return updated
}

// private storage upload (deliveries bucket) + signed URL for download
const uploadPrivate = async (filename, contentType, buffer, bucket = 'deliveries') => {
  const safe = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const put = () =>
    fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURIComponent(safe)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, 'Content-Type': contentType || 'application/octet-stream', 'x-upsert': 'true' },
      body: buffer,
    })
  let r = await put()
  if (!r.ok && (r.status === 404 || r.status === 400)) {
    // create the private bucket then retry
    await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bucket, name: bucket, public: false, file_size_limit: 104857600 }),
    }).catch(() => {})
    r = await put()
  }
  if (!r.ok) {
    const detail = await r.text().catch(() => '')
    return { ok: false, status: r.status, detail: detail.slice(0, 300) }
  }
  return { ok: true, path: safe }
}
const signedDownloadUrl = async (path, bucket = 'deliveries', expiresIn = 120) => {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${encodeURIComponent(path)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn }),
  })
  if (!r.ok) return null
  const d = await r.json().catch(() => null)
  return d && d.signedURL ? `${SUPABASE_URL}/storage/v1${d.signedURL}` : null
}
// --- announcements ---
const listAnnouncements = async () => {
  const r = await sbRest('announcements?order=created_at.desc')
  return r.ok ? r.json() : []
}
const insertAnnouncement = async (row) => {
  const r = await sbRest('announcements', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) })
  const d = await r.json().catch(() => null)
  return { ok: r.ok, status: r.status, data: Array.isArray(d) ? d[0] : d, detail: !r.ok && d ? d.message || d.code : null }
}
const removeAnnouncement = async (id) => (await sbRest(`announcements?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })).ok

// --- reviews wall ---
const listReviews = async () => {
  const r = await sbRest('reviews?order=created_at.desc&limit=500')
  return r.ok ? r.json() : []
}
const setReviewFeatured = async (id, featured) =>
  (await sbRest(`reviews?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ featured: !!featured }) })).ok
const removeReview = async (id) => (await sbRest(`reviews?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })).ok
// admin insert (service-role) — may set featured + images freely
const insertReviewAdmin = async (row) => {
  const r = await sbRest('reviews', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) })
  const d = await r.json().catch(() => null)
  return { ok: r.ok, status: r.status, data: Array.isArray(d) ? d[0] : d }
}

// --- site settings (key/value) ---
const getSetting = async (key) => {
  const r = await sbRest(`settings?key=eq.${encodeURIComponent(key)}&limit=1`)
  const d = await r.json().catch(() => [])
  return Array.isArray(d) && d[0] ? d[0].value : null
}
const upsertSetting = async (key, value) => {
  const r = await sbRest('settings?on_conflict=key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  })
  return r.ok
}

// --- delete an auth user ---
const deleteAuthUser = async (id) => {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  return r.ok
}

const getConversations = async () => {
  const r = await sbRest('support_messages?order=created_at.desc&limit=500')
  const rows = r.ok ? await r.json() : []
  const map = new Map()
  for (const m of rows) {
    const c = map.get(m.conversation_id)
    if (!c) {
      map.set(m.conversation_id, {
        conversationId: m.conversation_id,
        email: m.email || null,
        lastBody: m.body,
        lastAt: m.created_at,
        count: 1,
      })
    } else {
      c.count++
      if (!c.email && m.email) c.email = m.email
    }
  }
  return [...map.values()]
}

// ---- per-person inbox -------------------------------------------------------
// A "person" groups every conversation + every offer (custom-code request) that
// belongs to the same customer email. Email is the join key, resolved per
// conversation from message emails first, then offer.customer_email. Threads
// with no resolvable email fall into a per-conversation `anon:<cid>` bucket so
// nothing is ever dropped. All read-time — no extra tables.
const resolveConvEmails = (msgs, offers) => {
  // Order-independent: the EARLIEST signed-in email (by created_at) wins for a
  // conversation, regardless of whether the caller sorted msgs asc or desc — so
  // the people list and the person detail always bucket a conversation the same
  // way (a conversation that carried two different emails can't diverge).
  const first = new Map() // conversation_id -> { email, at }
  for (const m of msgs) {
    if (!m.email) continue
    const at = m.created_at || ''
    const prev = first.get(m.conversation_id)
    if (!prev || at < prev.at) first.set(m.conversation_id, { email: String(m.email).toLowerCase(), at })
  }
  const convEmail = new Map()
  for (const [cid, v] of first) convEmail.set(cid, v.email)
  // offers fill in conversations that have no email-bearing message
  for (const o of offers) {
    if (o.customer_email && o.conversation_id && !convEmail.has(o.conversation_id)) {
      convEmail.set(o.conversation_id, String(o.customer_email).toLowerCase())
    }
  }
  return convEmail
}
const offerEmail = (o, convEmail) =>
  o.customer_email ? String(o.customer_email).toLowerCase() : (o.conversation_id ? convEmail.get(o.conversation_id) || null : null)

const isRequestBody = (body) => /^✦\s*CUSTOM CODE REQUEST/i.test(String(body || '').trim())
const getPeople = async () => {
  const mr = await sbRest('support_messages?order=created_at.desc&limit=1000')
  const msgs = mr.ok ? await mr.json() : []
  const offers = await listAllOffers()
  const convEmail = resolveConvEmails(msgs, offers)
  // offer answering a given request message (prefer a live, non-cancelled one)
  const offerByReq = new Map()
  for (const o of offers) {
    if (o.request_message_id == null) continue
    const k = String(o.request_message_id)
    const cur = offerByReq.get(k)
    if (!cur || cur.status === 'cancelled' || o.status !== 'cancelled') offerByReq.set(k, o)
  }
  const keyFor = (cid) => convEmail.get(cid) || `anon:${cid}`
  const people = new Map()
  const ensure = (key, email) => {
    let p = people.get(key)
    if (!p) {
      // pendingCount = open custom requests (not delivered, not rejected); lastFrom
      // drives the unread/NEW dot in the admin list.
      p = { key, email: email || null, displayName: email || 'Guest', lastBody: '', lastAt: null, lastFrom: null, count: 0, requestCount: 0, pendingCount: 0, conversationIds: [] }
      people.set(key, p)
    }
    return p
  }
  for (const m of msgs) {
    const email = convEmail.get(m.conversation_id) || null
    const p = ensure(keyFor(m.conversation_id), email)
    p.count++
    if (!p.conversationIds.includes(m.conversation_id)) p.conversationIds.push(m.conversation_id)
    if (!p.lastAt || (m.created_at && m.created_at > p.lastAt)) { p.lastAt = m.created_at; p.lastBody = m.body; p.lastFrom = m.sender }
    // open custom-code request? (from the customer, no delivered offer, not rejected)
    if (m.sender === 'user' && isRequestBody(m.body)) {
      const rejected = !!(m.meta && m.meta.rejected)
      const off = offerByReq.get(String(m.id))
      const delivered = !!off && (off.status === 'delivered' || off.production_status === 'delivered')
      if (!rejected && !delivered) p.pendingCount++
    }
  }
  for (const o of offers) {
    const email = offerEmail(o, convEmail)
    const key = email || (o.conversation_id ? `anon:${o.conversation_id}` : null)
    if (!key) continue
    const p = ensure(key, email)
    p.requestCount++
    if (o.conversation_id && !p.conversationIds.includes(o.conversation_id)) p.conversationIds.push(o.conversation_id)
  }
  return [...people.values()].sort((a, b) => String(b.lastAt || '').localeCompare(String(a.lastAt || '')))
}

const getPersonDetail = async (key) => {
  const mr = await sbRest('support_messages?order=created_at.asc&limit=1000')
  const allMsgs = mr.ok ? await mr.json() : []
  const allOffers = await listAllOffers()
  const convEmail = resolveConvEmails(allMsgs, allOffers)
  let conversationIds = []
  let email = null
  let offers = []
  if (key.startsWith('anon:')) {
    const cid = key.slice(5)
    conversationIds = [cid]
    offers = allOffers.filter((o) => o.conversation_id === cid && !o.customer_email)
  } else {
    email = key.toLowerCase()
    const ids = new Set()
    for (const m of allMsgs) if (convEmail.get(m.conversation_id) === email) ids.add(m.conversation_id)
    offers = allOffers.filter((o) => offerEmail(o, convEmail) === email)
    for (const o of offers) if (o.conversation_id) ids.add(o.conversation_id)
    conversationIds = [...ids]
  }
  const messages = allMsgs
    .filter((m) => conversationIds.includes(m.conversation_id))
    .map((m) => ({ id: m.id, from: m.sender, text: m.body, at: m.created_at, kind: m.kind || 'text', meta: m.meta || null, conversationId: m.conversation_id }))
  return { key, email, displayName: email || 'Guest', conversationIds, messages, offers: offers.map(adminOffer) }
}

// --- static file serving ---
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
}
const serveStatic = (req, res) => {
  if (!fs.existsSync(DIST)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Frontend not built. Run `npm run build`. (In dev, use the Vite server.)')
    return
  }
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  let filePath = path.join(DIST, urlPath)
  if (!filePath.startsWith(DIST)) filePath = path.join(DIST, 'index.html')
  if (!path.extname(filePath) || !fs.existsSync(filePath)) filePath = path.join(DIST, 'index.html')
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    res.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(filePath)] || 'application/octet-stream' })
    res.end(buf)
  })
}

// On boot, make sure the admin user exists in Supabase Auth with the password
// from env — so the Railway ADMIN_EMAIL + ADMIN_PASSWORD ARE the admin login.
// (Env is the source of truth: this also resets the password to match on deploy.)
const ensureAdminUser = async () => {
  if (!sbReady() || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.warn('[waslerr] skip ensureAdminUser — need SUPABASE_URL, SERVICE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD')
    return
  }
  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }
  try {
    const create = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, email_confirm: true }),
    })
    if (create.ok) {
      console.log('[waslerr] admin user created:', ADMIN_EMAIL)
      return
    }
    // already exists → find it and set the password to match env
    const list = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    })
    if (list.ok) {
      const data = await list.json()
      const users = data.users || data || []
      const u = users.find((x) => (x.email || '').toLowerCase() === ADMIN_EMAIL)
      if (u) {
        // Only reset the password when explicitly forced — resetting it on every
        // boot would invalidate the admin's active session (logout + 403 after
        // each deploy, which also made deletes silently fail server-side).
        if (ADMIN_FORCE_PASSWORD) {
          const upd = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${u.id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ password: ADMIN_PASSWORD, email_confirm: true }),
          })
          console.log('[waslerr] admin password force-synced:', upd.ok)
        } else {
          console.log('[waslerr] admin user present — password preserved (set ADMIN_FORCE_PASSWORD=1 to reset)')
        }
      } else {
        console.warn('[waslerr] admin create failed and user not found:', create.status)
      }
    }
  } catch (e) {
    console.warn('[waslerr] ensureAdminUser failed:', e?.message)
  }
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || '').split('?')[0]
  const method = req.method || 'GET'
  const parsedUrl = new URL(req.url || '/', 'http://localhost')

  if (url === '/api/health') return sendJson(res, 200, { ok: true })

  // public config for the browser to init Supabase + know who the admin is
  if (url === '/api/config') {
    return sendJson(res, 200, {
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: ANON_KEY,
      adminEmail: ADMIN_EMAIL,
      adminPath: ADMIN_PATH,
      // public PayPal SDK config (client id is safe to expose to the browser)
      paypalClientId: paypalClientId(),
      paypalMode: paypalMode(),
    })
  }

  // upload a product image (admin only) → returns a public URL
  if (url === '/api/admin/upload' && method === 'POST') {
    if (!(await requireAdmin(req, res))) return
    const { filename, contentType, dataBase64 } = await readBody(req, 40e6) // ~30MB image
    if (!dataBase64) return sendJson(res, 400, { error: 'no_file', detail: 'No image data received (file may be too large).' })
    try {
      const buffer = Buffer.from(dataBase64, 'base64')
      const out = await uploadImage(filename || 'image', contentType, buffer)
      if (!out.ok) return sendJson(res, 502, { error: 'upload_failed', status: out.status, detail: out.detail || 'storage rejected the file' })
      return sendJson(res, 200, { url: out.publicUrl })
    } catch (e) {
      return sendJson(res, 500, { error: 'upload_error', detail: e?.message })
    }
  }

  // upload a field's audio (admin only) → paid audio goes to the private
  // `field-audio` bucket, free audio goes to its own `free-audio` bucket.
  if (url === '/api/admin/upload-audio' && method === 'POST') {
    if (!(await requireAdmin(req, res))) return
    const { filename, contentType, dataBase64, free } = await readBody(req, 160e6) // ~120MB audio
    if (!dataBase64) return sendJson(res, 400, { error: 'no_file', detail: 'No audio received (file may be too large).' })
    if (!String(contentType || '').startsWith('audio/')) return sendJson(res, 400, { error: 'not_audio', detail: 'Please choose an audio file.' })
    const bucket = free ? 'free-audio' : 'field-audio'
    try {
      const buffer = Buffer.from(dataBase64, 'base64')
      const out = await uploadPrivate(filename || 'audio', contentType, buffer, bucket)
      if (!out.ok) return sendJson(res, 502, { error: 'upload_failed', detail: out.detail || 'storage rejected the file' })
      return sendJson(res, 200, { path: out.path })
    } catch (e) {
      return sendJson(res, 500, { error: 'upload_error', detail: e?.message })
    }
  }

  // create a product (admin only)
  if (url === '/api/admin/products' && method === 'POST') {
    if (!(await requireAdmin(req, res))) return
    const b = await readBody(req)
    const title = (b.title || '').trim()
    if (!title) return sendJson(res, 400, { error: 'title_required' })
    const row = {
      title,
      line: (b.line || 'desire').toString().toLowerCase().trim() || 'desire',
      price: Number(b.price) || 0,
      description: (b.description || '').trim(),
      image_url: b.image_url || null,
      audio_url: b.audio_url || null,
      sold_count: Math.max(0, parseInt(b.sold_count, 10) || 0),
      benefits: cleanBenefits(b.benefits),
    }
    if (b.method !== undefined) row.method = cleanMethod(b.method)
    if (b.versions !== undefined) row.versions = cleanVersions(b.versions)
    if (b.audios !== undefined) {
      row.audios = cleanAudios(b.audios)
      if (!row.audio_url && row.audios[0]) row.audio_url = row.audios[0].path // legacy mirror
    }
    const out = await insertProduct(row)
    if (!out.ok) return sendJson(res, 502, { error: 'insert_failed' })
    return sendJson(res, 200, { product: out.data })
  }

  // update a product (admin only) — sold count + edit (title/price/image/audio/…)
  if (url.startsWith('/api/admin/products/') && method === 'POST') {
    if (!(await requireAdmin(req, res))) return
    const id = url.split('/').pop()
    const b = await readBody(req)
    const patch = {}
    if (b.sold_count != null) patch.sold_count = Math.max(0, parseInt(b.sold_count, 10) || 0)
    if (b.title != null && b.title.trim()) patch.title = b.title.trim()
    if (b.line != null) patch.line = (b.line || 'desire').toString().toLowerCase().trim() || 'desire'
    if (b.price != null) patch.price = Number(b.price) || 0
    if (b.description != null) patch.description = b.description.trim()
    if (b.image_url !== undefined) patch.image_url = b.image_url || null
    if (b.audio_url !== undefined) patch.audio_url = b.audio_url || null
    if (b.benefits !== undefined) patch.benefits = cleanBenefits(b.benefits)
    if (b.method !== undefined) patch.method = cleanMethod(b.method)
    if (b.versions !== undefined) patch.versions = cleanVersions(b.versions)
    if (b.audios !== undefined) {
      patch.audios = cleanAudios(b.audios)
      patch.audio_url = patch.audios[0] ? patch.audios[0].path : (b.audio_url || null) // legacy mirror
    }
    if (!Object.keys(patch).length) return sendJson(res, 400, { error: 'nothing_to_update' })
    const out = await updateProductRow(id, patch)
    if (!out.ok) return sendJson(res, 502, { error: 'update_failed' })
    return sendJson(res, 200, { product: out.data })
  }

  // delete a product (admin only)
  if (url.startsWith('/api/admin/products/') && method === 'DELETE') {
    if (!(await requireAdmin(req, res))) return
    const id = url.split('/').pop()
    const out = await deleteProduct(id)
    if (!out.ok) return sendJson(res, 502, { error: 'delete_failed' })
    return sendJson(res, 200, { ok: true })
  }

  // ---- coupons ----
  // validate/apply a coupon for a specific field (public; used at checkout)
  if (url.startsWith('/api/coupons/') && method === 'GET') {
    const code = decodeURIComponent(url.split('/').pop() || '').toUpperCase()
    if (!sbReady()) return sendJson(res, 503, { error: 'not_configured' })
    const fieldId = parsedUrl.searchParams.get('field') || ''
    const c = await getCoupon(code)
    if (!c) return sendJson(res, 404, { error: 'invalid_coupon' })
    const v = validateCoupon(c, fieldId)
    if (!v.ok) return sendJson(res, 400, { error: v.reason }) // expired | used_up | wrong_field | invalid
    return sendJson(res, 200, { code: c.code, type: c.type, value: Number(c.value), fieldId: c.field_id || null })
  }
  if (url === '/api/admin/coupons' && method === 'GET') {
    if (!(await requireAdmin(req, res))) return
    const list = await listCoupons()
    return sendJson(res, 200, {
      coupons: (list || []).map((c) => ({
        id: c.id,
        code: c.code,
        type: c.type,
        value: Number(c.value),
        active: c.active,
        fieldId: c.field_id || null,
        maxUses: c.max_uses != null ? Number(c.max_uses) : null,
        uses: Number(c.uses || 0),
        expiresAt: c.expires_at || null,
      })),
    })
  }
  if (url === '/api/admin/coupons' && method === 'POST') {
    if (!(await requireAdmin(req, res))) return
    const b = await readBody(req)
    const code = (b.code || '').trim().toUpperCase()
    if (!code) return sendJson(res, 400, { error: 'code_required' })
    const row = {
      code,
      type: b.type === 'fixed' ? 'fixed' : 'percent',
      value: Number(b.value) || 0,
      active: true,
      field_id: b.fieldId ? String(b.fieldId) : null, // null = all paid fields
      max_uses: b.maxUses != null && b.maxUses !== '' ? Math.max(1, parseInt(b.maxUses, 10) || 0) || null : null,
      expires_at: b.expiresAt ? new Date(b.expiresAt).toISOString() : null,
    }
    const out = await insertCoupon(row)
    if (!out.ok) return sendJson(res, out.status === 409 ? 409 : 502, { error: out.status === 409 ? 'duplicate' : 'insert_failed' })
    return sendJson(res, 200, { coupon: out.data })
  }
  if (url.startsWith('/api/admin/coupons/') && method === 'DELETE') {
    if (!(await requireAdmin(req, res))) return
    if (!(await removeCoupon(url.split('/').pop()))) return sendJson(res, 502, { error: 'delete_failed' })
    return sendJson(res, 200, { ok: true })
  }

  // ---- checkout / payments ----
  // Create an order. Server sets the price from the catalog (never the client),
  // applies the coupon, generates the note-to-payee reference, and (for Binance)
  // creates a real merchant order so the buyer can pay inside Binance.
  if (url === '/api/checkout/create' && method === 'POST') {
    if (!sbReady()) return sendJson(res, 503, { error: 'not_configured' })
    const b = await readBody(req)
    const fieldId = (b.fieldId || '').toString()
    const methodSel = b.method === 'binance' ? 'binance' : 'paypal'
    if (!fieldId) return sendJson(res, 400, { error: 'field_required' })

    const product = await getProductById(fieldId)
    if (!product) return sendJson(res, 404, { error: 'field_not_found' })

    let amount = Number(product.price) || 0
    // a specific version, if chosen, sets the price + which audio gets delivered
    let versionId = null
    let versionName = ''
    if (b.versionId != null && Array.isArray(product.versions)) {
      const v = product.versions.find((x) => String(x.id) === String(b.versionId))
      if (v) {
        versionId = Number(v.id)
        versionName = String(v.name || '')
        amount = Number(v.price) || amount
      }
    }
    if (amount <= 0) return sendJson(res, 400, { error: 'free_field', detail: 'free fields need no checkout' })

    // subtotal = the field/version price BEFORE any coupon (kept for the receipt)
    const subtotal = amount
    // server-side coupon application — validate scope (field) + limits + expiry
    let couponCode = null
    let couponInfo = null
    if (b.coupon) {
      const c = await getCoupon((b.coupon || '').toUpperCase())
      const v = c ? validateCoupon(c, fieldId) : { ok: false, reason: 'invalid' }
      if (c && v.ok) {
        couponCode = c.code
        couponInfo = { code: c.code, type: c.type, value: Number(c.value) || 0 }
        amount = c.type === 'percent' ? amount - Math.round((amount * Number(c.value)) / 100) : Math.max(0, amount - Number(c.value))
      } else {
        return sendJson(res, 400, { error: 'coupon_' + (v.reason || 'invalid') })
      }
    }
    amount = Math.max(0, amount)
    const discount = Math.max(0, subtotal - amount)

    const reference = genReference(product.title)
    const orderRow = {
      reference,
      field_id: fieldId,
      field_title: versionName ? `${product.title} · ${versionName}` : product.title,
      method: methodSel,
      amount,
      currency: 'USD',
      status: 'pending',
      coupon: couponCode,
      buyer_email: (b.email || '').toString().toLowerCase() || null,
      meta: { subtotal, discount, coupon: couponInfo }, // receipt breakdown
      ...(versionId != null ? { version_id: versionId } : {}),
    }

    // FULL UNLOCK: a valid coupon covered the entire price → comp the order as
    // delivered right now so the buyer gets the field with no payment step.
    // Server-authoritative: the discount was computed from the DB coupon above,
    // so the client can't fake a free field.
    if (couponCode && amount <= 0) {
      orderRow.status = 'delivered'
      orderRow.txid = 'COUPON'
      orderRow.method = 'coupon' // a 100%-off coupon is not a payment method
      const out = await insertOrder({ ...orderRow, amount: 0 })
      if (!out.ok) return sendJson(res, 502, { error: 'order_failed' })
      incrementCouponUse(couponCode).catch(() => {})
      return sendJson(res, 200, { reference, amount: 0, fullUnlock: true, method: 'coupon', fieldTitle: product.title })
    }

    let binance = null
    if (methodSel === 'binance' && binanceConfigured()) {
      const created = await binanceCreateOrder({ reference, amount, goodsName: product.title })
      if (created.ok) {
        orderRow.prepay_id = created.prepayId || null
        binance = {
          checkoutUrl: created.checkoutUrl,
          deeplink: created.deeplink,
          qrcodeLink: created.qrcodeLink,
          universalUrl: created.universalUrl,
        }
      }
      // if create fails we still return the manual UID flow; status polling will
      // fall back to query-by-reference (works once a merchant order exists).
    }

    const out = await insertOrder(orderRow)
    if (!out.ok) return sendJson(res, 502, { error: 'order_failed' })

    return sendJson(res, 200, {
      reference,
      amount,
      method: methodSel,
      coupon: couponCode,
      fieldTitle: product.title,
      payee: methodSel === 'binance' ? { binanceId: BINANCE_PAY_ID } : { paypalEmail: PAYPAL_EMAIL },
      binance,
      providerReady: methodSel === 'binance' ? (binanceConfigured() || binanceApiConfigured()) : paypalConfigured(),
    })
  }

  // Poll order status. Hits the provider API and matches by reference.
  // Returns { status: pending | detected | paid | delivered | failed, txid? }.
  if (url === '/api/checkout/status' && method === 'GET') {
    const reference = parsedUrl.searchParams.get('reference') || ''
    if (!reference || !sbReady()) return sendJson(res, 400, { error: 'bad_request' })
    const order = await getOrderByRef(reference)
    if (!order) return sendJson(res, 404, { error: 'order_not_found' })
    if (order.status === 'delivered' || order.status === 'paid') {
      return sendJson(res, 200, { status: 'delivered', txid: order.txid || null, amount: Number(order.amount) })
    }

    if (order.method === 'binance') {
      const c = await confirmBinancePayment(order)
      if (c.ok) {
        const updated = await markDelivered(order, { txid: c.txid, meta: c.raw })
        return sendJson(res, 200, { status: 'delivered', txid: updated.txid || c.txid || null, amount: Number(order.amount) })
      }
      return sendJson(res, 200, { status: 'pending' })
    }

    // PayPal: search for a completed transaction whose note carries the reference
    const found = await paypalFindByReference(reference, Number(order.amount))
    if (found.ok) {
      const updated = await markDelivered(order, { txid: found.txid, meta: found.raw })
      return sendJson(res, 200, { status: 'delivered', txid: updated.txid || found.txid || null, amount: Number(order.amount) })
    }
    return sendJson(res, 200, { status: 'pending', reason: found.reason || null })
  }

  // TXID fallback — buyer pastes a transaction id; verify it against the order.
  if (url === '/api/checkout/verify-txid' && method === 'POST') {
    if (!sbReady()) return sendJson(res, 503, { error: 'not_configured' })
    const b = await readBody(req)
    const reference = (b.reference || '').toString()
    const txid = (b.txid || '').toString().trim()
    if (!reference || txid.length < 6) return sendJson(res, 400, { error: 'bad_request' })
    const order = await getOrderByRef(reference)
    if (!order) return sendJson(res, 404, { error: 'order_not_found' })
    if (order.status === 'delivered' || order.status === 'paid') {
      return sendJson(res, 200, { status: 'delivered', txid: order.txid || txid })
    }

    if (order.method === 'binance') {
      // confirm the buyer-supplied transaction id against our Pay history
      const c = await confirmBinancePayment(order, { txid })
      if (c.ok) {
        const updated = await markDelivered(order, { txid: c.txid || txid, meta: c.raw })
        return sendJson(res, 200, { status: 'delivered', txid: updated.txid || txid })
      }
      await updateOrder(reference, { txid }) // record for manual reconciliation
      return sendJson(res, 200, { status: 'pending', reason: 'not_confirmed_yet' })
    }

    const v = await paypalVerifyTxid(txid, Number(order.amount), reference)
    if (v.ok) {
      const updated = await markDelivered(order, { txid: v.txid || txid, meta: v.raw })
      return sendJson(res, 200, { status: 'delivered', txid: updated.txid || txid })
    }
    return sendJson(res, 200, { status: 'failed', reason: v.reason || 'verify_failed' })
  }

  // PayPal SDK — create a server-side order for the buttons' createOrder().
  if (url === '/api/checkout/paypal/create-order' && method === 'POST') {
    if (!sbReady()) return sendJson(res, 503, { error: 'not_configured' })
    if (!paypalConfigured()) return sendJson(res, 503, { error: 'paypal_not_configured' })
    const b = await readBody(req)
    const reference = (b.reference || '').toString()
    if (!reference) return sendJson(res, 400, { error: 'bad_request' })
    const order = await getOrderByRef(reference)
    if (!order) return sendJson(res, 404, { error: 'order_not_found' })
    if (order.method !== 'paypal') return sendJson(res, 400, { error: 'wrong_method' })
    if (order.status === 'delivered' || order.status === 'paid') {
      return sendJson(res, 409, { error: 'already_paid' })
    }
    const created = await paypalCreateOrder({ amount: Number(order.amount), reference, fieldTitle: order.field_title })
    if (!created.ok) return sendJson(res, 502, { error: 'create_failed', reason: created.reason || null })
    return sendJson(res, 200, { id: created.id })
  }

  // PayPal SDK — capture + verify on the server after the buyer approves.
  // The capture must be COMPLETED, the amount must match, and the order's
  // reference must be carried. Only then is the field delivered.
  if (url === '/api/checkout/paypal/capture' && method === 'POST') {
    if (!sbReady()) return sendJson(res, 503, { error: 'not_configured' })
    if (!paypalConfigured()) return sendJson(res, 503, { error: 'paypal_not_configured' })
    const b = await readBody(req)
    const reference = (b.reference || '').toString()
    const orderId = (b.orderId || b.orderID || '').toString()
    if (!reference || !orderId) return sendJson(res, 400, { error: 'bad_request' })
    const order = await getOrderByRef(reference)
    if (!order) return sendJson(res, 404, { error: 'order_not_found' })
    if (order.method !== 'paypal') return sendJson(res, 400, { error: 'wrong_method' })
    if (order.status === 'delivered' || order.status === 'paid') {
      return sendJson(res, 200, { status: 'delivered', txid: order.txid || null })
    }
    const cap = await paypalCaptureOrder(orderId, { amount: Number(order.amount), reference })
    if (!cap.ok) return sendJson(res, 200, { status: 'failed', reason: cap.reason || 'capture_failed' })
    // dedupe: never let one capture id unlock two different orders
    const used = cap.txid ? await getOrderByTxid(cap.txid) : null
    if (used && used.reference !== order.reference) {
      return sendJson(res, 200, { status: 'failed', reason: 'txid_reused' })
    }
    const updated = await markDelivered(order, { txid: cap.txid, meta: cap.raw })
    return sendJson(res, 200, { status: 'delivered', txid: updated.txid || cap.txid })
  }

  // the signed-in customer's real, confirmed orders (paid/delivered), by email.
  // Auth-gated: the email is taken from the verified token, never the client.
  if (url === '/api/orders' && method === 'GET') {
    if (!sbReady()) return sendJson(res, 200, { orders: [] })
    const u = await getAuthedUser(req)
    if (!u || !u.email) return sendJson(res, 200, { orders: [] })
    const r = await sbRest(
      `orders?buyer_email=eq.${encodeURIComponent(u.email)}&status=in.(paid,delivered)&order=created_at.desc&limit=200`,
    )
    const rows = r.ok ? await r.json() : []
    return sendJson(res, 200, {
      orders: rows.map((o) => ({
        id: o.reference,
        name: o.field_title,
        method: o.method,
        amount: Number(o.amount) || 0,
        ref: o.reference,
        txn: o.txid || null,
        ts: Date.parse(o.created_at) || 0,
        fieldId: o.field_id,
        versionId: o.version_id ?? null,
        coupon: o.coupon || null,
        currency: o.currency || 'USD',
        status: o.status,
        subtotal: o.meta && o.meta.subtotal != null ? Number(o.meta.subtotal) : null,
        discount: o.meta && o.meta.discount != null ? Number(o.meta.discount) : 0,
      })),
    })
  }

  // The signed-in customer's delivered custom fields (chat offers), by email.
  // Lets them re-access & download their custom fields from the account page,
  // permanently — not only inside the chat thread.
  if (url === '/api/my/offers' && method === 'GET') {
    if (!sbReady()) return sendJson(res, 200, { offers: [] })
    const u = await getAuthedUser(req)
    if (!u || !u.email) return sendJson(res, 200, { offers: [] })
    const r = await sbRest(
      `offers?customer_email=eq.${encodeURIComponent(u.email.toLowerCase())}&status=eq.delivered&order=delivered_at.desc&limit=200`,
    )
    const rows = r.ok ? await r.json() : []
    return sendJson(res, 200, {
      offers: rows.map((o) => {
        const files = Array.isArray(o.delivery_files) && o.delivery_files.length
          ? o.delivery_files
          : (o.delivery_file_url ? [{ name: o.delivery_file_name, size: 0 }] : [])
        return {
          id: o.id,
          conversationId: o.conversation_id, // owner secret — used to fetch the gated download
          name: o.name,
          amount: Number(o.amount) || 0,
          method: o.payment_method || null,
          ts: Date.parse(o.delivered_at || o.created_at) || 0,
          files: files.map((f, i) => ({ name: f.name || `Field file ${i + 1}`, i })),
        }
      }),
    })
  }

  // ---- offers (field offered in chat → pay → deliver) ----
  // 1) admin creates an offer + appends an `offer` card to the thread
  if (/^\/api\/admin\/conversations\/[^/]+\/offers$/.test(url) && method === 'POST') {
    if (!(await requireAdmin(req, res))) return
    const conversationId = decodeURIComponent(url.split('/')[4] || '')
    const b = await readBody(req)
    const name = (b.name || '').toString().trim()
    const amount = Math.max(0, Number(b.amount) || 0)
    if (!conversationId || !name) return sendJson(res, 400, { error: 'bad_request', detail: 'name required' })
    // amount 0 = a free gift field: there's nothing to pay, so it skips straight
    // to `paid` and the admin can deliver it right away (same delivery flow).
    const isFree = amount === 0
    // links this offer to the customer's ✦ CUSTOM CODE REQUEST message so its
    // request block can show this offer's status (and stay independent of other
    // requests in the same thread)
    const reqMsgId = b.requestMessageId != null ? String(b.requestMessageId).slice(0, 80) : null
    // find the customer email from the thread (best effort)
    const convMsgs = await getMessages(conversationId)
    const customerEmail = (convMsgs.find((m) => m.email)?.email) || null
    const offerRow = {
      conversation_id: conversationId,
      customer_email: customerEmail,
      name: name.slice(0, 120),
      description: (b.description || '').toString().trim().slice(0, 2000),
      amount,
      currency: (b.currency || 'USD').toString().toUpperCase().slice(0, 8),
      delivery_estimate: (b.deliveryEstimate || '6–7 days').toString().slice(0, 40),
      includes: Array.isArray(b.includes) ? b.includes.slice(0, 12).map((s) => String(s).slice(0, 120)) : [],
      status: isFree ? 'paid' : 'sent',
      paid_at: isFree ? new Date().toISOString() : null,
      focus: (b.focus || '').toString().trim().slice(0, 200) || null,
      intention: (b.intention || '').toString().trim().slice(0, 4000) || null,
      request_message_id: reqMsgId,
    }
    // Supersede only a still-unpaid offer for the SAME request (re-pricing it) —
    // other requests in this thread keep their own independent, payable offers.
    const priorOffers = await listOffersForConversation(conversationId)
    for (const o of priorOffers) {
      if (o.status === 'sent' && String(o.request_message_id || '') === (reqMsgId || '')) {
        await updateOffer(o.id, { status: 'cancelled' })
      }
    }
    // Insert — degrade gracefully if the request_workspace columns aren't applied
    // yet (drop request_message_id first, then focus/intention).
    let out = await insertOffer(offerRow)
    if (!out.ok && offerRow.request_message_id) {
      const { request_message_id, ...rest } = offerRow
      out = await insertOffer(rest)
    }
    if (!out.ok) {
      const { request_message_id, focus, intention, ...rest } = offerRow
      out = await insertOffer(rest)
    }
    if (!out.ok) return sendJson(res, 502, { error: 'insert_failed', detail: out.status })
    await insertMessage({
      conversation_id: conversationId,
      sender: 'admin',
      kind: 'offer',
      body: `Field offered: ${offerRow.name} · ${isFree ? 'Free' : '$' + amount}`,
      meta: { offerId: out.data.id },
    })
    return sendJson(res, 200, { offer: publicOffer(out.data) })
  }

  // 2) customer starts payment for an offer — reuses the crypto checkout (orders)
  if (/^\/api\/offers\/[^/]+\/checkout$/.test(url) && method === 'POST') {
    if (!sbReady()) return sendJson(res, 503, { error: 'not_configured' })
    const offerId = url.split('/')[3]
    const b = await readBody(req)
    const methodSel = b.method === 'binance' ? 'binance' : 'paypal'
    const offer = await getOffer(offerId)
    if (!offer) return sendJson(res, 404, { error: 'offer_not_found' })
    if (!canCheckout(offer)) return sendJson(res, 409, { error: 'not_payable', detail: `offer is ${offer.status}` })
    const amount = Number(offer.amount) || 0
    if (amount <= 0) return sendJson(res, 400, { error: 'bad_amount' })

    // reuse an existing pending order for this offer+method if present (retry-safe)
    let reference = offer.reference
    let binance = null
    let existing = reference ? await getOrderByRef(reference) : null
    if (!existing || existing.method !== methodSel || existing.status === 'failed') {
      reference = genReference(offer.name)
      const orderRow = {
        reference,
        field_id: 'offer:' + offer.id,
        field_title: offer.name,
        method: methodSel,
        amount,
        currency: offer.currency || 'USD',
        status: 'pending',
        buyer_email: offer.customer_email || null,
      }
      if (methodSel === 'binance' && binanceConfigured()) {
        const created = await binanceCreateOrder({ reference, amount, goodsName: offer.name })
        if (created.ok) {
          orderRow.prepay_id = created.prepayId || null
          binance = { checkoutUrl: created.checkoutUrl, deeplink: created.deeplink, qrcodeLink: created.qrcodeLink, universalUrl: created.universalUrl }
        }
      }
      const ins = await insertOrder(orderRow)
      if (!ins.ok) return sendJson(res, 502, { error: 'order_failed' })
      await updateOffer(offer.id, { reference, payment_method: methodSel })
    }
    return sendJson(res, 200, {
      reference,
      amount,
      method: methodSel,
      offerName: offer.name,
      payee: methodSel === 'binance' ? { binanceId: BINANCE_PAY_ID } : { paypalEmail: PAYPAL_EMAIL },
      binance,
      providerReady: methodSel === 'binance' ? (binanceConfigured() || binanceApiConfigured()) : paypalConfigured(),
    })
  }

  // 3) poll offer status (replaces the webhook in this poll-based stack).
  // Confirms payment via the provider, then flips the offer to paid idempotently.
  if (/^\/api\/offers\/[^/]+\/status$/.test(url) && method === 'GET') {
    if (!sbReady()) return sendJson(res, 400, { error: 'bad_request' })
    const offerId = url.split('/')[3]
    const offer = await getOffer(offerId)
    if (!offer) return sendJson(res, 404, { error: 'offer_not_found' })
    if (offer.status === 'paid' || offer.status === 'delivered') {
      return sendJson(res, 200, { status: offer.status, offer: publicOffer(offer) })
    }
    if (!offer.reference) return sendJson(res, 200, { status: 'sent', offer: publicOffer(offer) })
    const order = await getOrderByRef(offer.reference)
    if (!order) return sendJson(res, 200, { status: 'sent', offer: publicOffer(offer) })

    let paid = order.status === 'paid' || order.status === 'delivered'
    let txid = order.txid || null
    if (!paid) {
      if (order.method === 'binance') {
        const c = await confirmBinancePayment(order)
        if (c.ok) { await markDelivered(order, { txid: c.txid, meta: c.raw }); paid = true; txid = c.txid }
      } else {
        const found = await paypalFindByReference(offer.reference, Number(order.amount))
        if (found.ok) { await markDelivered(order, { txid: found.txid, meta: found.raw }); paid = true; txid = found.txid }
      }
    }
    if (paid) {
      const updated = await confirmOfferPaid(offer, { txid, method: order.method })
      return sendJson(res, 200, { status: 'paid', offer: publicOffer(updated) })
    }
    return sendJson(res, 200, { status: 'sent', offer: publicOffer(offer) })
  }

  // 3b) TXID fallback for an offer (mirrors /api/checkout/verify-txid)
  if (/^\/api\/offers\/[^/]+\/verify-txid$/.test(url) && method === 'POST') {
    if (!sbReady()) return sendJson(res, 503, { error: 'not_configured' })
    const offerId = url.split('/')[3]
    const b = await readBody(req)
    const txid = (b.txid || '').toString().trim()
    const offer = await getOffer(offerId)
    if (!offer || !offer.reference) return sendJson(res, 404, { error: 'offer_not_found' })
    if (offer.status !== 'sent') return sendJson(res, 200, { status: offer.status, offer: publicOffer(offer) })
    if (txid.length < 6) return sendJson(res, 400, { error: 'bad_request' })
    const order = await getOrderByRef(offer.reference)
    if (!order) return sendJson(res, 404, { error: 'order_not_found' })
    let ok = false
    if (order.method === 'binance') {
      const c = await confirmBinancePayment(order, { txid })
      if (c.ok) { await markDelivered(order, { txid: c.txid || txid, meta: c.raw }); ok = true }
      else await updateOrder(offer.reference, { txid })
    } else {
      const v = await paypalVerifyTxid(txid, Number(order.amount), offer.reference)
      if (v.ok) { await markDelivered(order, { txid: v.txid || txid, meta: v.raw }); ok = true }
    }
    if (ok) {
      const updated = await confirmOfferPaid(offer, { txid, method: order.method })
      return sendJson(res, 200, { status: 'paid', offer: publicOffer(updated) })
    }
    return sendJson(res, 200, { status: 'sent', reason: 'not_confirmed_yet', offer: publicOffer(offer) })
  }

  // 4) admin delivers the field. JSON: { files: [{fileName, contentType, dataBase64}], note }
  //    (legacy single-file body { fileName, contentType, dataBase64, note } still works)
  if (/^\/api\/admin\/offers\/[^/]+\/deliver$/.test(url) && method === 'POST') {
    if (!(await requireAdmin(req, res))) return
    const offerId = url.split('/')[4]
    const b = await readBody(req, 220e6) // shared budget for ~1–several delivery files
    const offer = await getOffer(offerId)
    if (!offer) return sendJson(res, 404, { error: 'offer_not_found' })
    if (!canDeliver(offer)) return sendJson(res, 409, { error: 'not_paid', detail: 'cannot deliver before payment' })
    if (offer.status === 'delivered') return sendJson(res, 200, { offer: publicOffer(offer) }) // idempotent
    // normalise to a list of files (new array form, or the legacy single file)
    const incoming = Array.isArray(b.files) && b.files.length
      ? b.files
      : (b.dataBase64 ? [{ fileName: b.fileName, contentType: b.contentType, dataBase64: b.dataBase64 }] : [])
    if (!incoming.length) return sendJson(res, 400, { error: 'no_file' })
    const stored = []
    try {
      for (const f of incoming) {
        if (!f || !f.dataBase64) continue
        const buffer = Buffer.from(f.dataBase64, 'base64')
        const up = await uploadPrivate(f.fileName || 'field', f.contentType, buffer, 'deliveries')
        if (!up.ok) return sendJson(res, 502, { error: 'upload_failed', detail: up.detail })
        stored.push({ path: up.path, name: (f.fileName || 'field').toString().slice(0, 200), size: Math.max(0, Number(f.size) || buffer.length) })
      }
    } catch (e) {
      return sendJson(res, 500, { error: 'upload_error', detail: e?.message })
    }
    if (!stored.length) return sendJson(res, 400, { error: 'no_file' })
    const out = await updateOffer(offerId, {
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      delivery_files: stored,
      delivery_file_url: stored[0].path, // legacy compat = first file
      delivery_file_name: stored[0].name,
      delivery_note: (b.note || '').toString().slice(0, 1000),
    })
    const label = stored.length === 1 ? stored[0].name : `${stored.length} files`
    await insertMessage({
      conversation_id: offer.conversation_id,
      sender: 'admin',
      kind: 'delivery',
      body: `Delivery sent · ${label}`,
      meta: { offerId },
    })
    return sendJson(res, 200, { offer: publicOffer(out.data || { ...offer, status: 'delivered' }) })
  }

  // 4b) admin updates a request workspace (production status / spec / internal note)
  //     PATCH /api/admin/offers/:id  { productionStatus?, focus?, intention?, budget?, lengthEstimate?, internalNote? }
  //     Production status is the *production* pipeline — orthogonal to payment
  //     `status` (an unpaid offer can still move to review). Returns the admin
  //     shape (incl. internal_note, which never appears in publicOffer).
  if (/^\/api\/admin\/offers\/[^/]+$/.test(url) && method === 'PATCH') {
    if (!(await requireAdmin(req, res))) return
    const offerId = decodeURIComponent(url.split('/')[4] || '')
    const b = await readBody(req)
    const offer = await getOffer(offerId)
    if (!offer) return sendJson(res, 404, { error: 'offer_not_found' })
    const patch = {}
    if (b.productionStatus !== undefined) {
      if (!PRODUCTION_STAGES.includes(b.productionStatus)) return sendJson(res, 400, { error: 'bad_status' })
      patch.production_status = b.productionStatus
    }
    if (b.focus !== undefined) patch.focus = String(b.focus).slice(0, 200)
    if (b.intention !== undefined) patch.intention = String(b.intention).slice(0, 4000)
    if (b.budget !== undefined) patch.budget = String(b.budget).slice(0, 80)
    if (b.lengthEstimate !== undefined) patch.length_estimate = String(b.lengthEstimate).slice(0, 80)
    if (b.internalNote !== undefined) patch.internal_note = String(b.internalNote).slice(0, 4000)
    if (!Object.keys(patch).length) return sendJson(res, 400, { error: 'nothing_to_update' })
    const out = await updateOffer(offerId, patch)
    if (!out.ok) return sendJson(res, 502, { error: 'update_failed', detail: 'Run the request_workspace.sql migration to add these columns.' })
    return sendJson(res, 200, { offer: adminOffer(out.data || { ...offer, ...patch }) })
  }

  // 4c) admin rejects (or re-opens) a ✦ CUSTOM CODE REQUEST message. Flags the
  //     request closed so it drops out of the pending count; cancels a still-
  //     unpaid linked offer so the customer can't pay a declined request.
  if (/^\/api\/admin\/requests\/[^/]+\/reject$/.test(url) && method === 'POST') {
    if (!(await requireAdmin(req, res))) return
    const messageId = decodeURIComponent(url.split('/')[4] || '')
    const b = await readBody(req)
    const rejected = b.rejected !== false // default true
    const msg = await getMessageById(messageId)
    if (!msg) return sendJson(res, 404, { error: 'not_found' })
    const out = await updateMessage(messageId, { meta: { ...(msg.meta || {}), rejected } })
    if (!out.ok) return sendJson(res, 502, { error: 'update_failed' })
    if (rejected && msg.conversation_id) {
      const linked = await listOffersForConversation(msg.conversation_id)
      for (const o of linked) {
        if (String(o.request_message_id || '') === String(messageId) && o.status === 'sent') {
          await updateOffer(o.id, { status: 'cancelled' })
        }
      }
    }
    return sendJson(res, 200, { ok: true, rejected })
  }

  // 5) customer (or admin) downloads the delivered file — gated by conversationId
  if (/^\/api\/offers\/[^/]+\/download$/.test(url) && method === 'GET') {
    if (!sbReady()) return sendJson(res, 503, { error: 'not_configured' })
    const offerId = url.split('/')[3]
    const conv = parsedUrl.searchParams.get('conversationId') || ''
    const offer = await getOffer(offerId)
    if (!offer) return sendJson(res, 404, { error: 'offer_not_found' })
    // resolve which file to serve: ?i=index into delivery_files, else the legacy single file
    const files = Array.isArray(offer.delivery_files) && offer.delivery_files.length
      ? offer.delivery_files
      : (offer.delivery_file_url ? [{ path: offer.delivery_file_url, name: offer.delivery_file_name }] : [])
    const idx = Math.max(0, parseInt(parsedUrl.searchParams.get('i') || '0', 10) || 0)
    const pick = files[idx] || files[0]
    if (offer.status !== 'delivered' || !pick?.path) return sendJson(res, 409, { error: 'not_delivered' })
    // auth: the owning conversation (chat guests hold the secret id), an admin
    // token, OR the signed-in customer whose email owns this offer (account page)
    const isOwner = conv && conv === offer.conversation_id
    let allowed = isOwner
    if (!allowed) {
      const u = await getAuthedUser(req)
      const isAdminUser = u && (u.email === ADMIN_EMAIL || u.role === 'admin')
      const isEmailOwner =
        u && u.email && offer.customer_email && u.email.toLowerCase() === String(offer.customer_email).toLowerCase()
      allowed = isAdminUser || isEmailOwner
    }
    if (!allowed) return sendJson(res, 403, { error: 'forbidden' })
    const signed = await signedDownloadUrl(pick.path, 'deliveries', 120)
    if (!signed) return sendJson(res, 502, { error: 'sign_failed' })
    res.writeHead(302, { Location: signed, 'Cache-Control': 'no-store' })
    return res.end()
  }

  // ---- free fields (separate from paid products) ----
  if (url === '/api/free-fields' && method === 'GET') {
    if (!sbReady()) return sendJson(res, 200, { freeFields: [] })
    return sendJson(res, 200, { freeFields: await listFreeFields() })
  }

  // gated field audio: free fields are open; a paid field needs a valid paid
  // order reference for that field (the buyer's secret) or an admin token.
  // A field/version can hold a BUNDLE of files — `?list=1` returns the entitled
  // file list (names only), `?i=<index>` redirects to that file's signed URL.
  if (/^\/api\/fields\/[^/]+\/audio$/.test(url) && method === 'GET') {
    if (!sbReady()) return sendJson(res, 503, { error: 'not_configured' })
    const id = url.split('/')[3]
    const ref = parsedUrl.searchParams.get('ref') || ''
    const wantList = parsedUrl.searchParams.get('list') === '1'
    const idx = Math.max(0, parseInt(parsedUrl.searchParams.get('i') || '0', 10) || 0)
    const paid = await getProductById(id)
    const freeF = paid ? null : await getFreeFieldById(id)
    const field = paid || freeF
    if (!field) return sendJson(res, 404, { error: 'field_not_found' })

    // a field's bundle = `audios`, falling back to the legacy single `audio_url`
    const bundleOf = (obj, legacy) =>
      Array.isArray(obj && obj.audios) && obj.audios.length
        ? obj.audios
        : (legacy ? [{ path: legacy, name: 'Audio', size: 0 }] : [])
    let files = bundleOf(field, field.audio_url)

    const isFree = !!freeF || Number(field.price) === 0
    if (!isFree) {
      // must prove purchase (paid order ref for this field) — or be admin
      let allowed = false
      if (ref) {
        const order = await getOrderByRef(ref)
        if (order && order.field_id === id && (order.status === 'paid' || order.status === 'delivered')) {
          allowed = true
          // serve the exact version they bought, if it has its own audio bundle
          if (order.version_id != null && Array.isArray(paid && paid.versions)) {
            const v = paid.versions.find((x) => Number(x.id) === Number(order.version_id))
            const vfiles = v ? bundleOf(v, v.audio) : []
            if (vfiles.length) files = vfiles
          }
        }
      }
      if (!allowed) {
        const u = await getAuthedUser(req)
        if (u && (u.email === ADMIN_EMAIL || u.role === 'admin')) allowed = true
      }
      if (!allowed) return sendJson(res, 403, { error: 'not_purchased' })
    }
    if (!files.length) return sendJson(res, 404, { error: 'no_audio' })
    // names + sizes only — downloads go through this same endpoint by index
    if (wantList) return sendJson(res, 200, { files: files.map((f, i) => ({ name: f.name || `Audio ${i + 1}`, size: f.size || 0, i })) })
    const pick = files[idx] || files[0]
    if (!pick || !pick.path) return sendJson(res, 404, { error: 'no_audio' })
    // paid audio lives in field-audio, free audio in its own free-audio bucket
    const bucket = freeF ? 'free-audio' : 'field-audio'
    const signed = await signedDownloadUrl(pick.path, bucket, 120)
    if (!signed) return sendJson(res, 502, { error: 'sign_failed' })
    res.writeHead(302, { Location: signed, 'Cache-Control': 'no-store' })
    return res.end()
  }
  if (url === '/api/admin/free-fields' && method === 'POST') {
    if (!(await requireAdmin(req, res))) return
    const b = await readBody(req)
    const title = (b.title || '').trim()
    if (!title) return sendJson(res, 400, { error: 'title_required' })
    const row = {
      title,
      line: (b.line || 'desire').toLowerCase(),
      description: (b.description || '').trim(),
      image_url: b.image_url || null,
      audio_url: b.audio_url || null,
      benefits: cleanBenefits(b.benefits),
    }
    if (b.method !== undefined) row.method = cleanMethod(b.method)
    if (b.versions !== undefined) row.versions = cleanVersions(b.versions)
    if (b.audios !== undefined) {
      row.audios = cleanAudios(b.audios)
      if (!row.audio_url && row.audios[0]) row.audio_url = row.audios[0].path // legacy mirror
    }
    const out = await insertFreeField(row)
    if (!out.ok) return sendJson(res, 502, { error: 'insert_failed' })
    return sendJson(res, 200, { freeField: out.data })
  }
  if (url.startsWith('/api/admin/free-fields/') && method === 'POST') {
    if (!(await requireAdmin(req, res))) return
    const id = url.split('/').pop()
    const b = await readBody(req)
    const patch = {}
    if (b.sold_count != null) patch.sold_count = Math.max(0, parseInt(b.sold_count, 10) || 0)
    if (b.title != null && b.title.trim()) patch.title = b.title.trim()
    if (b.line != null) patch.line = (b.line || 'desire').toString().toLowerCase().trim() || 'desire'
    if (b.description != null) patch.description = b.description.trim()
    if (b.image_url !== undefined) patch.image_url = b.image_url || null
    if (b.audio_url !== undefined) patch.audio_url = b.audio_url || null
    if (b.benefits !== undefined) patch.benefits = cleanBenefits(b.benefits)
    if (b.method !== undefined) patch.method = cleanMethod(b.method)
    if (b.versions !== undefined) patch.versions = cleanVersions(b.versions)
    if (b.audios !== undefined) {
      patch.audios = cleanAudios(b.audios)
      patch.audio_url = patch.audios[0] ? patch.audios[0].path : (b.audio_url || null) // legacy mirror
    }
    if (!Object.keys(patch).length) return sendJson(res, 400, { error: 'nothing_to_update' })
    const out = await updateFreeFieldRow(id, patch)
    if (!out.ok) return sendJson(res, 502, { error: 'update_failed' })
    return sendJson(res, 200, { freeField: out.data })
  }
  if (url.startsWith('/api/admin/free-fields/') && method === 'DELETE') {
    if (!(await requireAdmin(req, res))) return
    if (!(await removeFreeField(url.split('/').pop()))) return sendJson(res, 502, { error: 'delete_failed' })
    return sendJson(res, 200, { ok: true })
  }

  // ---- admin stats (aggregated from real orders) ----
  if (url === '/api/admin/stats' && method === 'GET') {
    if (!(await requireAdmin(req, res))) return
    try {
      return sendJson(res, 200, await computeStats())
    } catch {
      return sendJson(res, 502, { error: 'stats_failed' })
    }
  }

  // ---- support chat ----
  if (url === '/api/chat/send' && method === 'POST') {
    const b = await readBody(req)
    const conversationId = (b.conversationId || '').trim()
    const text = (b.text || '').trim()
    if (!conversationId || !text) return sendJson(res, 400, { error: 'bad_request' })
    if (!sbReady()) return sendJson(res, 503, { error: 'not_configured' })
    const out = await insertMessage({ conversation_id: conversationId, sender: 'user', body: text.slice(0, 2000), email: b.email || null })
    if (!out.ok) return sendJson(res, 502, { error: 'send_failed' })
    // typed messages go to the team (the admin replies); FAQ is answered
    // instantly client-side via quick-reply chips.
    return sendJson(res, 200, { ok: true })
  }
  if (url === '/api/chat/messages' && method === 'GET') {
    const cid = parsedUrl.searchParams.get('conversationId') || ''
    if (!cid || !sbReady()) return sendJson(res, 200, { messages: [], offers: [] })
    const msgs = await getMessages(cid)
    const offers = await listOffersForConversation(cid)
    return sendJson(res, 200, {
      messages: msgs.map((m) => ({ id: m.id, from: m.sender, text: m.body, at: m.created_at, kind: m.kind || 'text', meta: m.meta || null })),
      offers: offers.map(publicOffer),
    })
  }
  if (url === '/api/admin/conversations' && method === 'GET') {
    if (!(await requireAdmin(req, res))) return
    return sendJson(res, 200, { conversations: await getConversations() })
  }
  // per-person inbox: the list of people (grouped by email) for the left column
  if (url === '/api/admin/people' && method === 'GET') {
    if (!(await requireAdmin(req, res))) return
    return sendJson(res, 200, { people: await getPeople() })
  }
  // one person's full detail: union of their messages + their offers (admin shape)
  if (url.startsWith('/api/admin/people/') && method === 'GET') {
    if (!(await requireAdmin(req, res))) return
    const key = decodeURIComponent(url.slice('/api/admin/people/'.length))
    if (!key) return sendJson(res, 400, { error: 'bad_request' })
    return sendJson(res, 200, { person: await getPersonDetail(key) })
  }
  // Binance Pay self-test (admin) — reveals whether the keys are valid Binance
  // Pay MERCHANT credentials. Bad keys / a non-merchant account fail here.
  if (url === '/api/admin/binance-check' && method === 'GET') {
    if (!(await requireAdmin(req, res))) return
    return sendJson(res, 200, { configured: binanceConfigured(), diagnose: await binanceDiagnose() })
  }
  // admin: delete a whole conversation (clears its messages)
  if (url.startsWith('/api/admin/conversations/') && method === 'DELETE') {
    if (!(await requireAdmin(req, res))) return
    const cid = decodeURIComponent(url.split('/').pop() || '')
    if (!cid) return sendJson(res, 400, { error: 'bad_request' })
    if (!(await removeConversation(cid))) return sendJson(res, 502, { error: 'delete_failed' })
    return sendJson(res, 200, { ok: true })
  }

  // ---- announcements ----
  if (url === '/api/announcements' && method === 'GET') {
    if (!sbReady()) return sendJson(res, 200, { announcements: [] })
    const list = await listAnnouncements()
    return sendJson(res, 200, { announcements: list || [] })
  }
  if (url === '/api/admin/announcements' && method === 'POST') {
    if (!(await requireAdmin(req, res))) return
    const b = await readBody(req)
    const title = (b.title || '').trim()
    if (!title) return sendJson(res, 400, { error: 'title_required' })
    const tag = (b.tag || 'NEW FIELD').toString().trim().toUpperCase().slice(0, 32) || 'NEW FIELD'
    const out = await insertAnnouncement({ tag, title, body: (b.body || '').trim(), image_url: b.image_url || null })
    if (!out.ok) return sendJson(res, 502, { error: 'insert_failed', detail: out.detail })
    return sendJson(res, 200, { announcement: out.data })
  }
  if (url.startsWith('/api/admin/announcements/') && method === 'DELETE') {
    if (!(await requireAdmin(req, res))) return
    if (!(await removeAnnouncement(url.split('/').pop()))) return sendJson(res, 502, { error: 'delete_failed' })
    return sendJson(res, 200, { ok: true })
  }

  // ---- reviews wall ----
  // public read (the frontend usually reads via supabase-js; this is a fallback)
  if (url === '/api/reviews' && method === 'GET') {
    if (!sbReady()) return sendJson(res, 200, { reviews: [] })
    return sendJson(res, 200, { reviews: await listReviews() })
  }
  // public review-photo upload (open to everyone; images only, capped size).
  // The client allows at most 2 photos per review; the DB also enforces ≤ 2.
  if (url === '/api/reviews/upload' && method === 'POST') {
    if (!sbReady()) return sendJson(res, 503, { error: 'not_configured' })
    const { filename, contentType, dataBase64 } = await readBody(req, 14e6) // ~10MB image
    if (!dataBase64) return sendJson(res, 400, { error: 'no_file', detail: 'No image received (file may be too large).' })
    if (!String(contentType || '').startsWith('image/')) return sendJson(res, 400, { error: 'not_image', detail: 'Only image files are allowed.' })
    try {
      const buffer = Buffer.from(dataBase64, 'base64')
      if (buffer.length > 8 * 1024 * 1024) return sendJson(res, 413, { error: 'too_large', detail: 'Image is too large (max 8MB).' })
      const out = await uploadImage(filename || 'review', contentType, buffer, 'review-images')
      if (!out.ok) return sendJson(res, 502, { error: 'upload_failed', detail: out.detail || 'storage rejected the file' })
      return sendJson(res, 200, { url: out.publicUrl })
    } catch (e) {
      return sendJson(res, 500, { error: 'upload_error', detail: e?.message })
    }
  }
  // admin: create a story for any field (custom name/rating/text/photos)
  if (url === '/api/admin/reviews' && method === 'POST') {
    if (!(await requireAdmin(req, res))) return
    const b = await readBody(req)
    const field = (b.field || '').toString() // optional — '' = general review
    const name = (b.name || '').toString().trim()
    const text = (b.text || '').toString().trim()
    if (!name || text.length < 4) return sendJson(res, 400, { error: 'bad_request', detail: 'name and a story (4+ chars) are required' })
    const row = {
      field,
      name: name.slice(0, 80),
      rating: Math.min(5, Math.max(1, parseInt(b.rating, 10) || 5)),
      text: text.slice(0, 2000),
      featured: !!b.featured,
      images: Array.isArray(b.images) ? b.images.slice(0, 4) : [],
    }
    const out = await insertReviewAdmin(row)
    if (!out.ok) return sendJson(res, 502, { error: 'insert_failed', detail: out.status })
    return sendJson(res, 200, { review: out.data })
  }
  // admin: feature / unfeature a story
  if (/^\/api\/admin\/reviews\/[^/]+\/feature$/.test(url) && method === 'POST') {
    if (!(await requireAdmin(req, res))) return
    const id = url.split('/')[4]
    const b = await readBody(req)
    if (!(await setReviewFeatured(id, b.featured))) return sendJson(res, 502, { error: 'feature_failed' })
    return sendJson(res, 200, { ok: true })
  }
  // admin: delete a story
  if (url.startsWith('/api/admin/reviews/') && method === 'DELETE') {
    if (!(await requireAdmin(req, res))) return
    if (!(await removeReview(url.split('/').pop()))) return sendJson(res, 502, { error: 'delete_failed' })
    return sendJson(res, 200, { ok: true })
  }

  // ---- site settings (community links) ----
  if (url === '/api/settings/community' && method === 'GET') {
    if (!sbReady()) return sendJson(res, 200, { value: null })
    return sendJson(res, 200, { value: await getSetting('community_links') })
  }
  if (url === '/api/admin/settings/community' && method === 'POST') {
    if (!(await requireAdmin(req, res))) return
    const b = await readBody(req)
    const value = {
      youtube: (b.youtube || '').toString().trim().slice(0, 300),
      discord: (b.discord || '').toString().trim().slice(0, 300),
      creator: (b.creator || '').toString().trim().slice(0, 300),
    }
    if (!(await upsertSetting('community_links', value))) return sendJson(res, 502, { error: 'save_failed' })
    return sendJson(res, 200, { ok: true, value })
  }

  // set a user's role: customer | admin (admin only; cannot change the owner)
  if (/^\/api\/admin\/users\/[^/]+\/role$/.test(url) && method === 'POST') {
    if (!(await requireAdmin(req, res))) return
    const id = url.split('/')[4]
    const b = await readBody(req)
    const role = b.role === 'admin' ? 'admin' : 'customer'
    try {
      const ur = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      })
      const tu = ur.ok ? await ur.json() : null
      if (tu && (tu.email || '').toLowerCase() === ADMIN_EMAIL) return sendJson(res, 400, { error: 'cannot_change_owner' })
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_metadata: { role } }),
      })
      if (!r.ok) return sendJson(res, 502, { error: 'role_failed' })
      return sendJson(res, 200, { ok: true, role })
    } catch {
      return sendJson(res, 500, { error: 'role_error' })
    }
  }

  // delete an auth user (admin only; cannot delete the admin account)
  if (url.startsWith('/api/admin/users/') && method === 'DELETE') {
    if (!(await requireAdmin(req, res))) return
    const id = url.split('/').pop()
    if (!(await deleteAuthUser(id))) return sendJson(res, 502, { error: 'delete_failed' })
    return sendJson(res, 200, { ok: true })
  }

  // list all signed-up users (admin only)
  if (url === '/api/admin/users' && method === 'GET') {
    if (!(await requireAdmin(req, res))) return
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      })
      const data = r.ok ? await r.json() : {}
      const users = (data.users || []).map((u) => ({
        id: u.id,
        email: u.email,
        name: (u.user_metadata && u.user_metadata.name) || '',
        role: (u.app_metadata && u.app_metadata.role) || 'customer',
        created_at: u.created_at,
      }))
      return sendJson(res, 200, { users })
    } catch {
      return sendJson(res, 502, { error: 'list_failed' })
    }
  }
  if (url === '/api/admin/chat/reply' && method === 'POST') {
    if (!(await requireAdmin(req, res))) return
    const b = await readBody(req)
    const conversationId = (b.conversationId || '').trim()
    const text = (b.text || '').trim()
    if (!conversationId || !text) return sendJson(res, 400, { error: 'bad_request' })
    const out = await insertMessage({ conversation_id: conversationId, sender: 'admin', body: text.slice(0, 2000) })
    if (!out.ok) return sendJson(res, 502, { error: 'reply_failed' })
    return sendJson(res, 200, { ok: true })
  }

  if (url.startsWith('/api/')) return sendJson(res, 404, { error: 'not_found' })

  return serveStatic(req, res)
})

server.listen(PORT, () => {
  console.log(`[waslerr] server listening on :${PORT}`)
  console.log(`[waslerr] payments — PayPal: ${paypalConfigured() ? 'configured' : 'MISSING keys'} · Binance merchant: ${binanceConfigured() ? 'configured' : 'off'} · Binance API (pay history): ${binanceApiConfigured() ? 'configured' : 'MISSING keys'}`)
  ensureAdminUser()
  if (sbReady()) ensureBucket() // make sure the product-images storage bucket exists
})
