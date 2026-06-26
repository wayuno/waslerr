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
  binanceConfigured,
  paypalFindByReference,
  paypalVerifyTxid,
  binanceCreateOrder,
  binanceQueryOrder,
} from './payments.js'

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

const insertProduct = async (body) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
    method: 'POST',
    headers: { ...sbHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => null)
  return { ok: r.ok, status: r.status, data: Array.isArray(data) ? data[0] : data }
}

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
    const detail = await r.text().catch(() => '')
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
  const r = await sbRest('orders', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) })
  const d = await r.json().catch(() => null)
  return { ok: r.ok, status: r.status, data: Array.isArray(d) ? d[0] : d }
}
const getOrderByRef = async (reference) => {
  const r = await sbRest(`orders?reference=eq.${encodeURIComponent(reference)}&limit=1`)
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
    meta: meta || order.meta || null,
  })
  return out.data || { ...order, status: 'delivered' }
}

// --- free fields (separate table from paid products) ---------------
const listFreeFields = async () => {
  const r = await sbRest('free_fields?order=created_at.desc')
  return r.ok ? r.json() : []
}
const insertFreeField = async (row) => {
  const r = await sbRest('free_fields', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) })
  const d = await r.json().catch(() => null)
  return { ok: r.ok, status: r.status, data: Array.isArray(d) ? d[0] : d }
}
const removeFreeField = async (id) => (await sbRest(`free_fields?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })).ok

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
  return { ok: r.ok }
}
const getMessages = async (conversationId) => {
  const r = await sbRest(`support_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&order=created_at.asc`)
  return r.ok ? r.json() : []
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
        const upd = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${u.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ password: ADMIN_PASSWORD, email_confirm: true }),
        })
        console.log('[waslerr] admin user password synced:', upd.ok)
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

  // create a product (admin only)
  if (url === '/api/admin/products' && method === 'POST') {
    if (!(await requireAdmin(req, res))) return
    const b = await readBody(req)
    const title = (b.title || '').trim()
    if (!title) return sendJson(res, 400, { error: 'title_required' })
    const row = {
      title,
      line: ['desire', 'akashic', 'wealth'].includes((b.line || '').toLowerCase()) ? b.line.toLowerCase() : 'desire',
      price: Number(b.price) || 0,
      description: (b.description || '').trim(),
      image_url: b.image_url || null,
    }
    const out = await insertProduct(row)
    if (!out.ok) return sendJson(res, 502, { error: 'insert_failed' })
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
  // validate/apply a coupon (public; used at checkout)
  if (url.startsWith('/api/coupons/') && method === 'GET') {
    const code = decodeURIComponent(url.split('/').pop() || '').toUpperCase()
    if (!sbReady()) return sendJson(res, 503, { error: 'not_configured' })
    const c = await getCoupon(code)
    if (!c) return sendJson(res, 404, { error: 'invalid_coupon' })
    return sendJson(res, 200, { code: c.code, type: c.type, value: Number(c.value) })
  }
  if (url === '/api/admin/coupons' && method === 'GET') {
    if (!(await requireAdmin(req, res))) return
    const list = await listCoupons()
    return sendJson(res, 200, {
      coupons: (list || []).map((c) => ({ id: c.id, code: c.code, type: c.type, value: Number(c.value), active: c.active })),
    })
  }
  if (url === '/api/admin/coupons' && method === 'POST') {
    if (!(await requireAdmin(req, res))) return
    const b = await readBody(req)
    const code = (b.code || '').trim().toUpperCase()
    if (!code) return sendJson(res, 400, { error: 'code_required' })
    const out = await insertCoupon({ code, type: b.type === 'fixed' ? 'fixed' : 'percent', value: Number(b.value) || 0, active: true })
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
    if (amount <= 0) return sendJson(res, 400, { error: 'free_field', detail: 'free fields need no checkout' })

    // server-side coupon application
    let couponCode = null
    if (b.coupon) {
      const c = await getCoupon((b.coupon || '').toUpperCase())
      if (c) {
        couponCode = c.code
        amount = c.type === 'percent' ? amount - Math.round((amount * Number(c.value)) / 100) : Math.max(0, amount - Number(c.value))
      }
    }
    amount = Math.max(0, amount)

    const reference = genReference(product.title)
    const orderRow = {
      reference,
      field_id: fieldId,
      field_title: product.title,
      method: methodSel,
      amount,
      currency: 'USD',
      status: 'pending',
      coupon: couponCode,
      buyer_email: (b.email || '').toString().toLowerCase() || null,
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
      providerReady: methodSel === 'binance' ? binanceConfigured() : paypalConfigured(),
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
      const q = await binanceQueryOrder(reference)
      if (q.ok && q.status === 'paid') {
        const updated = await markDelivered(order, { txid: q.txid, meta: q.raw })
        return sendJson(res, 200, { status: 'delivered', txid: updated.txid || q.txid || null, amount: Number(order.amount) })
      }
      const status = q.ok ? (q.status === 'detected' ? 'detected' : 'pending') : 'pending'
      return sendJson(res, 200, { status, providerStatus: q.providerStatus || null })
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
      // re-query by reference; record the txid for manual reconciliation if not yet paid
      const q = await binanceQueryOrder(reference)
      if (q.ok && q.status === 'paid') {
        const updated = await markDelivered(order, { txid: q.txid || txid, meta: q.raw })
        return sendJson(res, 200, { status: 'delivered', txid: updated.txid || txid })
      }
      await updateOrder(reference, { txid })
      return sendJson(res, 200, { status: 'pending', reason: 'not_confirmed_yet' })
    }

    const v = await paypalVerifyTxid(txid, Number(order.amount), reference)
    if (v.ok) {
      const updated = await markDelivered(order, { txid: v.txid || txid, meta: v.raw })
      return sendJson(res, 200, { status: 'delivered', txid: updated.txid || txid })
    }
    return sendJson(res, 200, { status: 'failed', reason: v.reason || 'verify_failed' })
  }

  // ---- free fields (separate from paid products) ----
  if (url === '/api/free-fields' && method === 'GET') {
    if (!sbReady()) return sendJson(res, 200, { freeFields: [] })
    return sendJson(res, 200, { freeFields: await listFreeFields() })
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
    }
    const out = await insertFreeField(row)
    if (!out.ok) return sendJson(res, 502, { error: 'insert_failed' })
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
    if (!cid || !sbReady()) return sendJson(res, 200, { messages: [] })
    const msgs = await getMessages(cid)
    return sendJson(res, 200, { messages: msgs.map((m) => ({ id: m.id, from: m.sender, text: m.body, at: m.created_at })) })
  }
  if (url === '/api/admin/conversations' && method === 'GET') {
    if (!(await requireAdmin(req, res))) return
    return sendJson(res, 200, { conversations: await getConversations() })
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
  console.log(`[waslerr] payments — PayPal: ${paypalConfigured() ? 'configured' : 'MISSING keys'} · Binance Pay: ${binanceConfigured() ? 'configured' : 'MISSING keys'}`)
  ensureAdminUser()
  if (sbReady()) ensureBucket() // make sure the product-images storage bucket exists
})
