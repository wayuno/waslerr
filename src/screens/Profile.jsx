import { useEffect, useRef, useState } from 'react'
import Background from '../components/Background'
import { useStore } from '../store/StoreProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'
import { PlayIcon, DownloadIcon } from '../components/icons'

const LINE_LABEL = { desire: 'Desire Code', akashic: 'Akashic Field', wealth: 'Wealth' }
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')
const lineLabel = (l) => LINE_LABEL[l] || cap(l) || 'Field'

const fmtDate = (ts) => {
  try {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Orders' },
  { id: 'settings', label: 'Settings' },
]

export default function Profile() {
  const { user, userName, loggedIn, authReady, products, navigate, openDetail, updateProfile, logout, showToast, authedFetch } = useStore()
  const ref = useRef(null)
  useReveal(ref)
  useMagnetic(ref)

  const [tab, setTab] = useState('overview')
  const [nameInput, setNameInput] = useState(userName || '')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [msg, setMsg] = useState(null) // { type:'ok'|'err', text }
  const [busy, setBusy] = useState(false)
  const [orders, setOrders] = useState([]) // real, confirmed orders from Supabase

  // not signed in → send to login
  useEffect(() => {
    if (authReady && !loggedIn) navigate('login')
  }, [authReady, loggedIn, navigate])
  useEffect(() => setNameInput(userName || ''), [userName])

  // fetch the customer's real orders (auth-gated by email server-side)
  useEffect(() => {
    if (!loggedIn) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await authedFetch('/api/orders')
        if (!r.ok) return
        const d = await r.json()
        if (!cancelled) setOrders(Array.isArray(d.orders) ? d.orders : [])
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loggedIn, authedFetch])

  if (!loggedIn) return null

  const displayName = (userName && userName.trim()) || (user ? user.split('@')[0] : 'Friend')
  const initial = (displayName || '?').charAt(0).toUpperCase()
  // owned fields = catalog products that appear in the customer's real orders
  const ownedIds = new Set(orders.map((o) => o.fieldId).filter(Boolean))
  const owned = products.filter((p) => ownedIds.has(p.id))
  const invested = orders.reduce((s, o) => s + (Number(o.amount) || 0), 0)

  const stats = [
    { label: 'Fields owned', value: String(owned.length) },
    { label: 'Orders', value: String(orders.length) },
    { label: 'Invested', value: `$${invested.toLocaleString('en-US')}` },
  ]

  const saveName = async () => {
    setMsg(null)
    const n = nameInput.trim()
    if (!n) return setMsg({ type: 'err', text: 'Enter a display name.' })
    setBusy(true)
    const res = await updateProfile({ name: n })
    setBusy(false)
    if (res?.error) {
      setMsg({ type: 'err', text: res.error })
      return
    }
    setMsg({ type: 'ok', text: 'Name updated.' })
    showToast('Display name updated')
  }

  const changePassword = async () => {
    setMsg(null)
    if (pass.length < 6) return setMsg({ type: 'err', text: 'Password must be at least 6 characters.' })
    if (pass !== pass2) return setMsg({ type: 'err', text: 'Passwords don’t match.' })
    setBusy(true)
    const res = await updateProfile({ password: pass })
    setBusy(false)
    if (res?.error) {
      setMsg({ type: 'err', text: res.error })
      return
    }
    setPass('')
    setPass2('')
    setMsg({ type: 'ok', text: 'Password changed.' })
    showToast('Password changed')
  }

  return (
    <div className="wf-app wf-profile" ref={ref}>
      <Background resonanceTop="42%" />

      <section className="wf-pf-wrap">
        {/* identity header */}
        <header className="wf-pf-head" data-reveal>
          <span className="wf-pf-avatar" aria-hidden="true">
            {initial}
          </span>
          <div className="wf-pf-id">
            <span className="wf-eyebrow">Your account</span>
            <h1 className="wf-pf-name">{displayName}.</h1>
            <span className="wf-pf-email">{user}</span>
          </div>
        </header>

        {/* stat strip */}
        <div className="wf-pf-stats" data-reveal>
          {stats.map((s, i) => (
            <div className="wf-pf-stat" key={s.label} style={{ '--d': `${i * 0.05}s` }}>
              <div className="wf-pf-stat-value">{s.value}</div>
              <div className="wf-pf-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* tabs */}
        <div className="wf-pf-tabs" data-reveal>
          {TABS.map((t) => (
            <button key={t.id} className={`wf-pf-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
              <span className="wf-pf-tab-underline" />
            </button>
          ))}
        </div>

        {/* ---- OVERVIEW ---- */}
        {tab === 'overview' && (
          <div className="wf-pf-panel" key="overview">
            <div className="wf-field-label wf-pf-section-label">Your library</div>
            {owned.length === 0 ? (
              <div className="wf-pf-empty">
                <p>Your owned fields will live here. Buy a field and it’s yours for life.</p>
                <button className="wf-btn wf-btn-gold wf-mag" onClick={() => navigate('fields')}>
                  Browse the fields
                </button>
              </div>
            ) : (
              <div className="wf-pf-library">
                {owned.map((f, i) => (
                  <button className="wf-pf-libcard" key={f.id} style={{ '--d': `${i * 0.05}s` }} onClick={() => openDetail(f.id)}>
                    <span className={`wf-pf-thumb${f.image_url ? '' : ' ph'}`}>
                      {f.image_url ? <img src={f.image_url} alt={f.title} loading="lazy" /> : <span className="wf-pf-thumb-mono">W</span>}
                      <span className="wf-pf-play" aria-hidden="true">
                        <PlayIcon />
                      </span>
                    </span>
                    <div className="wf-pf-libtext">
                      <span className="wf-pf-libtitle">{f.title}</span>
                      <span className="wf-pf-libline">{lineLabel(f.line)}</span>
                    </div>
                    <span className="wf-pf-owned">Owned</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---- ORDERS ---- */}
        {tab === 'orders' && (
          <div className="wf-pf-panel" key="orders">
            <div className="wf-field-label wf-pf-section-label">Order history</div>
            {orders.length === 0 ? (
              <div className="wf-pf-empty">
                <p>No orders yet. When you buy a field, your receipt shows up here.</p>
                <button className="wf-btn wf-btn-gold wf-mag" onClick={() => navigate('fields')}>
                  Browse the fields
                </button>
              </div>
            ) : (
              <div className="wf-pf-orders">
                {orders.map((o, i) => (
                  <div className="wf-pf-order" key={o.ref || o.id || i} style={{ '--d': `${i * 0.05}s` }}>
                    <span className="wf-pf-order-disc" aria-hidden="true">
                      <DownloadIcon size={16} />
                    </span>
                    <div className="wf-pf-order-text">
                      <span className="wf-pf-order-name">{o.name || 'Waslerr field'}</span>
                      <span className="wf-pf-order-meta">
                        {fmtDate(o.ts)} · {o.method === 'binance' ? 'Binance Pay' : o.method === 'paypal' ? 'PayPal' : o.method || '—'} · {o.ref || '—'}
                      </span>
                    </div>
                    <span className="wf-pf-order-amt">${Number(o.amount) || 0}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---- SETTINGS ---- */}
        {tab === 'settings' && (
          <div className="wf-pf-panel" key="settings">
            {msg && <p className={`wf-pf-msg ${msg.type}`}>{msg.text}</p>}

            <div className="wf-pf-card" style={{ '--d': '0s' }}>
              <div className="wf-pf-card-title">Display name</div>
              <p className="wf-pf-card-sub">The name shown on your reviews and receipts.</p>
              <input className="wf-input" value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Your name" />
              <button className="wf-form-submit wf-mag" disabled={busy} onClick={saveName}>
                {busy ? 'Saving…' : 'Save name'}
              </button>
            </div>

            <div className="wf-pf-card" style={{ '--d': '0.05s' }}>
              <div className="wf-pf-card-title">Password</div>
              <p className="wf-pf-card-sub">Use at least 6 characters.</p>
              <input className="wf-input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="New password" autoComplete="new-password" />
              <input className="wf-input" type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="Confirm new password" autoComplete="new-password" />
              <button className="wf-form-submit wf-mag" disabled={busy} onClick={changePassword}>
                {busy ? 'Saving…' : 'Change password'}
              </button>
            </div>

            <div className="wf-pf-card wf-pf-danger" style={{ '--d': '0.1s' }}>
              <div className="wf-pf-card-title">Sign out</div>
              <p className="wf-pf-card-sub">You’ll need to sign in again to access your account.</p>
              <button className="wf-pf-signout wf-mag" onClick={logout}>
                Sign out
              </button>
            </div>
          </div>
        )}

        <button className="wf-back" style={{ marginTop: 36 }} onClick={() => navigate('home')}>
          ← Back to home
        </button>
      </section>
    </div>
  )
}
