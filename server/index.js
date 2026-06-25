// Waslerr Fields — tiny Node backend (zero dependencies).
// Serves the built frontend (dist/) and a real, server-side admin auth API.
//
// Admin access requires the secret ADMIN_PASSWORD (an env var that never ships
// in the client bundle). On success the server returns an HMAC-signed token;
// the dashboard is only unlocked when that token verifies here.
//
// Env vars (set these in Railway → Variables):
//   ADMIN_EMAIL     — the one email allowed to be admin
//   ADMIN_PASSWORD  — the secret admin password (required for admin login)
//   JWT_SECRET      — long random string used to sign tokens
//   PORT            — provided automatically by Railway

import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, '..', 'dist')

// --- minimal .env loader (for local dev; Railway uses dashboard vars) ---
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

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''
const JWT_SECRET = process.env.JWT_SECRET || 'wf-dev-secret-change-me'
const PORT = process.env.PORT || 8787
const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.warn('[waslerr] ADMIN_EMAIL / ADMIN_PASSWORD not set — admin login is disabled until you set them.')
}
if (JWT_SECRET === 'wf-dev-secret-change-me') {
  console.warn('[waslerr] JWT_SECRET is using the insecure default — set a strong one in production.')
}

// --- token: HMAC-SHA256 signed payload (JWT-style, HS256) ---
const b64url = (s) => Buffer.from(s).toString('base64url')
const signToken = (payload) => {
  const body = b64url(JSON.stringify(payload))
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('base64url')
  return `${body}.${sig}`
}
const verifyToken = (token) => {
  if (!token || typeof token !== 'string') return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (payload.exp && Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}
const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

const sendJson = (res, status, obj) => {
  const data = JSON.stringify(obj)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(data)
}

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 1e6) req.destroy()
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
  // prevent path traversal
  if (!filePath.startsWith(DIST)) filePath = path.join(DIST, 'index.html')
  // SPA: no file / no extension → index.html
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

const server = http.createServer(async (req, res) => {
  const url = (req.url || '').split('?')[0]

  if (url === '/api/health') return sendJson(res, 200, { ok: true })

  // admin login — verify email + secret password, issue signed token
  if (url === '/api/admin/login') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' })
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return sendJson(res, 401, { error: 'admin_not_configured' })
    const { email, password } = await readBody(req)
    const emailOk = (email || '').trim().toLowerCase() === ADMIN_EMAIL
    const passOk = safeEqual(password || '', ADMIN_PASSWORD)
    if (!emailOk || !passOk) return sendJson(res, 401, { error: 'invalid_credentials' })
    const token = signToken({ email: ADMIN_EMAIL, role: 'admin', exp: Date.now() + TOKEN_TTL })
    return sendJson(res, 200, { token, email: ADMIN_EMAIL })
  }

  // verify a token (used by the dashboard on load / on gate)
  if (url === '/api/admin/me') {
    const auth = req.headers['authorization'] || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    const payload = verifyToken(token)
    if (!payload || payload.role !== 'admin') return sendJson(res, 401, { error: 'unauthorized' })
    return sendJson(res, 200, { admin: true, email: payload.email })
  }

  if (url.startsWith('/api/')) return sendJson(res, 404, { error: 'not_found' })

  // everything else → static frontend
  return serveStatic(req, res)
})

server.listen(PORT, () => {
  console.log(`[waslerr] server listening on :${PORT}`)
})
