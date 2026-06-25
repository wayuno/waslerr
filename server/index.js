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
import { fileURLToPath } from 'node:url'

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

// Verify the caller's Supabase access token and return their email (or null).
const getAuthedEmail = async (req) => {
  const auth = req.headers['authorization'] || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token || !SUPABASE_URL || !ANON_KEY) return null
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
    })
    if (!r.ok) return null
    const u = await r.json()
    return (u.email || '').trim().toLowerCase()
  } catch {
    return null
  }
}

const requireAdmin = async (req, res) => {
  if (!ADMIN_EMAIL || !SERVICE_KEY) {
    sendJson(res, 503, { error: 'admin_not_configured' })
    return false
  }
  const email = await getAuthedEmail(req)
  if (!email || email !== ADMIN_EMAIL) {
    sendJson(res, 403, { error: 'forbidden' })
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

const uploadImage = async (filename, contentType, buffer) => {
  const safe = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/${encodeURIComponent(safe)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': contentType || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: buffer,
  })
  if (!r.ok) return { ok: false, status: r.status }
  return { ok: true, publicUrl: `${SUPABASE_URL}/storage/v1/object/public/product-images/${safe}` }
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

// --- support chat ---
const insertMessage = async (row) => {
  const r = await sbRest('support_messages', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) })
  return { ok: r.ok }
}
const getMessages = async (conversationId) => {
  const r = await sbRest(`support_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&order=created_at.asc`)
  return r.ok ? r.json() : []
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
    const { filename, contentType, dataBase64 } = await readBody(req, 12e6)
    if (!dataBase64) return sendJson(res, 400, { error: 'no_file' })
    try {
      const buffer = Buffer.from(dataBase64, 'base64')
      const out = await uploadImage(filename || 'image', contentType, buffer)
      if (!out.ok) return sendJson(res, 502, { error: 'upload_failed' })
      return sendJson(res, 200, { url: out.publicUrl })
    } catch {
      return sendJson(res, 500, { error: 'upload_error' })
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

  // ---- support chat ----
  if (url === '/api/chat/send' && method === 'POST') {
    const b = await readBody(req)
    const conversationId = (b.conversationId || '').trim()
    const text = (b.text || '').trim()
    if (!conversationId || !text) return sendJson(res, 400, { error: 'bad_request' })
    if (!sbReady()) return sendJson(res, 503, { error: 'not_configured' })
    const out = await insertMessage({ conversation_id: conversationId, sender: 'user', body: text.slice(0, 2000), email: b.email || null })
    if (!out.ok) return sendJson(res, 502, { error: 'send_failed' })
    return sendJson(res, 200, { ok: true })
  }
  if (url === '/api/chat/messages' && method === 'GET') {
    const cid = parsedUrl.searchParams.get('conversationId') || ''
    if (!cid || !sbReady()) return sendJson(res, 200, { messages: [] })
    const msgs = await getMessages(cid)
    return sendJson(res, 200, { messages: msgs.map((m) => ({ from: m.sender, text: m.body, at: m.created_at })) })
  }
  if (url === '/api/admin/conversations' && method === 'GET') {
    if (!(await requireAdmin(req, res))) return
    return sendJson(res, 200, { conversations: await getConversations() })
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
  ensureAdminUser()
})
