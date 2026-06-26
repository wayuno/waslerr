import { useEffect, useRef, useState } from 'react'
import Background from '../components/Background'
import { useStore } from '../store/StoreProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'
import { adminMeta, revenueBars } from '../data/content'
import { TrashIcon, SendIcon, PlusIcon } from '../components/icons'

const TABS = [
  { id: 'stats', label: 'Stats' },
  { id: 'fields', label: 'Fields' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'coupons', label: 'Coupons' },
  { id: 'users', label: 'Users' },
  { id: 'support', label: 'Support' },
]
const CAT_LABEL = { desire: 'Desire', akashic: 'Akashic', wealth: 'Wealth' }
const phClass = (line) => (line === 'akashic' ? 'wf-card-ph-akashic' : line === 'wealth' ? 'wf-card-ph-wealth' : 'wf-card-ph-desire')

// stable pseudo metrics for demo analytics (no real download tracking yet)
const hashStr = (s) => {
  let h = 0
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) >>> 0
  return h
}
const downloadsFor = (p) => 120 + (hashStr((p.id || '') + (p.title || '')) % 1880)
const sparkFor = (p) => Array.from({ length: 7 }, (_, i) => 26 + (hashStr((p.id || '') + 'x' + i) % 72))

export default function Admin() {
  const {
    loggedIn,
    isAdmin,
    user,
    adminEmail,
    logout,
    requireAdmin,
    navigate,
    adminTab,
    setAdminTab,
    products,
    addProduct,
    deleteProduct,
    announcements,
    addAnnouncement,
    deleteAnnouncement,
    deleteUser,
    setUserRole,
    authedFetch,
  } = useStore()
  const ref = useRef(null)
  useReveal(ref)
  useMagnetic(ref)

  // product add form
  const [form, setForm] = useState({ title: '', category: 'DESIRE', price: '', desc: '' })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileInputRef = useRef(null)

  // coupons
  const [coupons, setCoupons] = useState([])
  const [cForm, setCForm] = useState({ code: '', type: 'percent', value: '' })
  const [cErr, setCErr] = useState('')
  const [cBusy, setCBusy] = useState(false)

  // announcements
  const [aForm, setAForm] = useState({ tag: 'NEW FIELD', title: '', body: '' })
  const [aFile, setAFile] = useState(null)
  const [aErr, setAErr] = useState('')
  const [aBusy, setABusy] = useState(false)
  const aFileRef = useRef(null)

  // users
  const [users, setUsers] = useState([])

  // support
  const [conversations, setConversations] = useState([])
  const [activeConv, setActiveConv] = useState(null)
  const [thread, setThread] = useState([])
  const [reply, setReply] = useState('')
  const threadRef = useRef(null)

  // load conversations (for stats + support); poll while on support tab
  useEffect(() => {
    if (!isAdmin) return
    let t
    const load = async () => {
      const r = await authedFetch('/api/admin/conversations')
      if (r.ok) setConversations((await r.json()).conversations || [])
    }
    load()
    if (adminTab === 'support') t = setInterval(load, 6000)
    return () => t && clearInterval(t)
  }, [isAdmin, adminTab, authedFetch])

  // load coupons when on the coupons tab
  useEffect(() => {
    if (!isAdmin || adminTab !== 'coupons') return
    ;(async () => {
      const r = await authedFetch('/api/admin/coupons')
      if (r.ok) setCoupons((await r.json()).coupons || [])
    })()
  }, [isAdmin, adminTab, authedFetch])

  // load users when on the users tab
  useEffect(() => {
    if (!isAdmin || adminTab !== 'users') return
    ;(async () => {
      const r = await authedFetch('/api/admin/users')
      if (r.ok) setUsers((await r.json()).users || [])
    })()
  }, [isAdmin, adminTab, authedFetch])

  // load + poll the open conversation thread
  useEffect(() => {
    if (!activeConv) return
    let t
    const load = async () => {
      const r = await fetch('/api/chat/messages?conversationId=' + encodeURIComponent(activeConv))
      if (r.ok) setThread((await r.json()).messages || [])
    }
    load()
    t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [activeConv])

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [thread])

  if (!loggedIn || !isAdmin) {
    return (
      <div className="wf-app" ref={ref}>
        <Background resonanceTop="50%" />
        <section className="wf-auth" style={{ minHeight: '100vh' }}>
          <div className="wf-auth-card" data-reveal>
            <h1 className="wf-auth-title">Admin panel</h1>
            {!loggedIn ? (
              <>
                <p className="wf-auth-sub">Sign in with the Waslerr admin account to manage fields, stats and support.</p>
                <button className="wf-form-submit wf-mag" style={{ width: '100%' }} onClick={requireAdmin}>
                  Sign in to continue
                </button>
              </>
            ) : (
              <>
                <p className="wf-auth-sub">This dashboard is restricted to the Waslerr admin. You&apos;re signed in as {user}.</p>
                <button className="wf-form-submit wf-mag" style={{ width: '100%' }} onClick={() => navigate('home')}>
                  Back to home
                </button>
                <button className="wf-back" style={{ marginTop: 6 }} onClick={logout}>
                  Sign out
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    )
  }

  const topAudios = [...products]
    .map((p) => ({ ...p, dl: downloadsFor(p) }))
    .sort((a, b) => b.dl - a.dl)
    .slice(0, 5)
  const totalDownloads = products.reduce((sum, p) => sum + downloadsFor(p), 0)
  const stats = [
    { label: 'Revenue · June', value: adminMeta.revenue },
    { label: 'Total downloads', value: totalDownloads.toLocaleString('en-US'), badge: '+12%' },
    { label: 'Fields published', value: String(products.length) },
    { label: 'Support chats', value: String(conversations.length) },
  ]
  const maxBar = Math.max(...revenueBars.map((b) => b.v))
  const maxDl = topAudios.length ? topAudios[0].dl : 1
  const categoryOptions = [...new Set([...products.map((p) => (p.line || '').toUpperCase()), 'DESIRE', 'AKASHIC', 'WEALTH'])].filter(Boolean)

  const publishAnnouncement = async (e) => {
    e.preventDefault()
    setAErr('')
    if (!aForm.title.trim()) {
      setAErr('Title is required.')
      return
    }
    setABusy(true)
    const res = await addAnnouncement({ tag: aForm.tag.trim() || 'NEW FIELD', title: aForm.title.trim(), body: aForm.body.trim() }, aFile)
    setABusy(false)
    if (res?.error) {
      setAErr(res.error)
      return
    }
    setAForm({ tag: 'NEW FIELD', title: '', body: '' })
    setAFile(null)
    if (aFileRef.current) aFileRef.current.value = ''
  }

  const publish = async (e) => {
    e.preventDefault()
    setErr('')
    if (!form.title.trim()) {
      setErr('Title is required.')
      return
    }
    setBusy(true)
    const res = await addProduct(
      {
        title: form.title.trim(),
        line: form.category.toLowerCase(),
        price: parseFloat(String(form.price).replace(/[^0-9.]/g, '')) || 0,
        description: form.desc.trim() || 'A new Waslerr field.',
      },
      file,
    )
    setBusy(false)
    if (res?.error) {
      setErr(res.error)
      return
    }
    setForm({ title: '', category: 'DESIRE', price: '', desc: '' })
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const createCoupon = async (e) => {
    e.preventDefault()
    setCErr('')
    const code = cForm.code.trim()
    if (!code) {
      setCErr('Code is required.')
      return
    }
    setCBusy(true)
    const r = await authedFetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, type: cForm.type, value: Number(cForm.value) || 0 }),
    })
    setCBusy(false)
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setCErr(j.error === 'duplicate' ? 'That code already exists.' : 'Could not create coupon.')
      return
    }
    setCForm({ code: '', type: 'percent', value: '' })
    const lr = await authedFetch('/api/admin/coupons')
    if (lr.ok) setCoupons((await lr.json()).coupons || [])
  }

  const removeCoupon = async (id) => {
    const r = await authedFetch('/api/admin/coupons/' + id, { method: 'DELETE' })
    if (r.ok) setCoupons((prev) => prev.filter((c) => c.id !== id))
  }

  const sendReply = async (e) => {
    e.preventDefault()
    const text = reply.trim()
    if (!text || !activeConv) return
    setReply('')
    setThread((prev) => [...prev, { from: 'admin', text }])
    await authedFetch('/api/admin/chat/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: activeConv, text }),
    })
  }

  return (
    <div className="wf-app" ref={ref}>
      <Background resonanceTop="50%" />

      <section className="wf-section wf-admin-main" style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div className="wf-admin-head" data-reveal>
          <div>
            <div className="wf-eyebrow">Admin panel</div>
            <h1 className="wf-detail-title">Field control</h1>
            <span className="wf-card-sub">Signed in · {user}</span>
          </div>
          <button className="wf-back" onClick={logout}>
            Sign out
          </button>
        </div>

        <div className="wf-tabs" data-reveal>
          {TABS.map((t) => (
            <button key={t.id} className={`wf-tab${adminTab === t.id ? ' active' : ''}`} onClick={() => setAdminTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {adminTab === 'stats' && (
          <div>
            <div className="wf-stat-grid" data-reveal>
              {stats.map((s) => (
                <div className="wf-stat-card" key={s.label}>
                  {s.badge && <span className="wf-stat-badge">{s.badge}</span>}
                  <div className="wf-stat-value">{s.value}</div>
                  <div className="wf-stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="wf-analytics-split" data-reveal>
              <div className="wf-chart-card">
                <div className="wf-field-label" style={{ marginBottom: 20 }}>
                  Revenue · last 6 months (thousands)
                </div>
                <div className="wf-chart">
                  {revenueBars.map((b, i) => (
                    <div className="wf-chart-col" key={b.m}>
                      <div className="wf-chart-bar-track">
                        <div className="wf-chart-bar" style={{ height: `${(b.v / maxBar) * 100}%`, animationDelay: `${i * 0.08}s` }}>
                          <span>{b.v}</span>
                        </div>
                      </div>
                      <div className="wf-chart-x">{b.m}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="wf-chart-card">
                <div className="wf-field-label" style={{ marginBottom: 16 }}>
                  Top downloaded audios
                </div>
                <div className="wf-top-list">
                  {topAudios.map((p) => (
                    <div className="wf-top-row" key={p.id}>
                      <span className={`wf-top-ico ${phClass(p.line)}`}>W</span>
                      <div className="wf-top-text">
                        <span className="wf-top-title">{p.title}</span>
                        <span className="wf-top-count">{p.dl.toLocaleString('en-US')} downloads</span>
                      </div>
                      <div className="wf-spark" aria-hidden="true">
                        {sparkFor(p).map((h, i) => (
                          <span key={i} style={{ height: `${(h / 100) * 100}%`, opacity: 0.4 + (p.dl / maxDl) * 0.6 }} />
                        ))}
                      </div>
                    </div>
                  ))}
                  {topAudios.length === 0 && <p className="wf-detail-desc">No fields yet.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {adminTab === 'fields' && (
          <div className="wf-admin-fields">
            <div data-reveal>
              <div className="wf-field-label" style={{ marginBottom: 14 }}>
                Published fields · {products.length}
              </div>
              <div className="wf-admin-list">
                {products.map((p) => (
                  <div className="wf-admin-row" key={p.id}>
                    <span className={`wf-admin-ico ${phClass(p.line)}`}>{p.image_url ? '' : 'W'}</span>
                    <div className="wf-admin-row-text">
                      <span className="wf-admin-row-title">{p.title}</span>
                      <span className="wf-admin-row-meta">
                        {CAT_LABEL[p.line] || 'Desire'} · {p.price || 'Free'}
                      </span>
                    </div>
                    <button className="wf-del" aria-label={`Delete ${p.title}`} onClick={() => deleteProduct(p.id)}>
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <form className="wf-form-card wf-admin-add" data-reveal onSubmit={publish}>
              <div className="wf-eyebrow" style={{ marginBottom: 4 }}>
                Add a field
              </div>
              <label className="wf-field">
                <span className="wf-field-label">Title</span>
                <input className="wf-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Field title" />
              </label>
              <div className="wf-form-row">
                <label className="wf-field">
                  <span className="wf-field-label">Category (type any)</span>
                  <input
                    className="wf-input"
                    list="wf-cats"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value.toUpperCase() })}
                    placeholder="DESIRE"
                  />
                  <datalist id="wf-cats">
                    {categoryOptions.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>
                <label className="wf-field">
                  <span className="wf-field-label">Price (0 = free)</span>
                  <input className="wf-input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="$150" />
                </label>
              </div>
              <label className="wf-field">
                <span className="wf-field-label">Description</span>
                <textarea className="wf-textarea" rows="3" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder="What does this field encode?" />
              </label>
              <label className="wf-field">
                <span className="wf-field-label">Artwork {file ? `· ${file.name}` : '(optional)'}</span>
                <input ref={fileInputRef} className="wf-input wf-file" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
              {err && <p className="wf-auth-error" style={{ margin: 0 }}>{err}</p>}
              <button type="submit" className="wf-form-submit wf-mag" disabled={busy}>
                {busy ? 'Publishing…' : (<><PlusIcon /> Publish field</>)}
              </button>
            </form>
          </div>
        )}

        {adminTab === 'announcements' && (
          <div className="wf-admin-fields">
            <div data-reveal>
              <div className="wf-field-label" style={{ marginBottom: 14 }}>
                Published announcements · {announcements.length}
              </div>
              <div className="wf-admin-list">
                {announcements.length === 0 && <p className="wf-detail-desc">No announcements yet. Write one →</p>}
                {announcements.map((a) => (
                  <div className="wf-admin-row" key={a.id}>
                    <span className={`wf-admin-ico wf-tag--${(a.tag || '').split(' ')[0].toLowerCase()} wf-ann-ico`}>★</span>
                    <div className="wf-admin-row-text">
                      <span className="wf-admin-row-title">{a.title}</span>
                      <span className="wf-admin-row-meta">
                        {a.tag} · {a.date}
                      </span>
                    </div>
                    {String(a.id).startsWith('seed-') ? (
                      <span className="wf-user-tag" style={{ background: 'var(--wf-glass-2)', color: 'var(--wf-mute)' }}>
                        SEED
                      </span>
                    ) : (
                      <button className="wf-del" aria-label={`Delete ${a.title}`} onClick={() => deleteAnnouncement(a.id)}>
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <form className="wf-form-card wf-admin-add" data-reveal onSubmit={publishAnnouncement}>
              <div className="wf-eyebrow" style={{ marginBottom: 4 }}>
                Write an announcement
              </div>
              <label className="wf-field">
                <span className="wf-field-label">Tag (type any)</span>
                <input
                  className="wf-input"
                  list="wf-tags"
                  value={aForm.tag}
                  onChange={(e) => setAForm({ ...aForm, tag: e.target.value.toUpperCase() })}
                  placeholder="NEW FIELD"
                />
                <datalist id="wf-tags">
                  <option value="BLOG" />
                  <option value="NEW FIELD" />
                  <option value="ENGINE" />
                  <option value="COMMUNITY" />
                  <option value="UPDATE" />
                  <option value="OFFER" />
                </datalist>
              </label>
              <label className="wf-field">
                <span className="wf-field-label">Title</span>
                <input className="wf-input" value={aForm.title} onChange={(e) => setAForm({ ...aForm, title: e.target.value })} placeholder="What's new?" />
              </label>
              <label className="wf-field">
                <span className="wf-field-label">Body</span>
                <textarea className="wf-textarea" rows="3" value={aForm.body} onChange={(e) => setAForm({ ...aForm, body: e.target.value })} placeholder="Tell listeners what changed." />
              </label>
              <label className="wf-field">
                <span className="wf-field-label">Photo {aFile ? `· ${aFile.name}` : '(optional)'}</span>
                <input ref={aFileRef} className="wf-input wf-file" type="file" accept="image/*" onChange={(e) => setAFile(e.target.files?.[0] || null)} />
              </label>
              {aErr && <p className="wf-auth-error" style={{ margin: 0 }}>{aErr}</p>}
              <button type="submit" className="wf-form-submit wf-mag" disabled={aBusy}>
                {aBusy ? 'Publishing…' : (<><PlusIcon /> Publish announcement</>)}
              </button>
            </form>
          </div>
        )}

        {adminTab === 'coupons' && (
          <div className="wf-admin-fields">
            <div data-reveal>
              <div className="wf-field-label" style={{ marginBottom: 14 }}>
                Active coupons · {coupons.length}
              </div>
              <div className="wf-admin-list">
                {coupons.length === 0 && <p className="wf-detail-desc">No coupons yet. Create one →</p>}
                {coupons.map((c) => (
                  <div className="wf-admin-row" key={c.id}>
                    <span className="wf-admin-ico wf-card-ph-desire">%</span>
                    <div className="wf-admin-row-text">
                      <span className="wf-admin-row-title">{c.code}</span>
                      <span className="wf-admin-row-meta">{c.type === 'percent' ? `${c.value}% off` : `$${c.value} off`}</span>
                    </div>
                    <button className="wf-del" aria-label={`Delete ${c.code}`} onClick={() => removeCoupon(c.id)}>
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <form className="wf-form-card wf-admin-add" data-reveal onSubmit={createCoupon}>
              <div className="wf-eyebrow" style={{ marginBottom: 4 }}>
                Create a coupon
              </div>
              <label className="wf-field">
                <span className="wf-field-label">Code</span>
                <input className="wf-input" value={cForm.code} onChange={(e) => setCForm({ ...cForm, code: e.target.value.toUpperCase() })} placeholder="WELCOME20" />
              </label>
              <div className="wf-form-row">
                <label className="wf-field">
                  <span className="wf-field-label">Discount type</span>
                  <select className="wf-select" value={cForm.type} onChange={(e) => setCForm({ ...cForm, type: e.target.value })}>
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed ($)</option>
                  </select>
                </label>
                <label className="wf-field">
                  <span className="wf-field-label">Value</span>
                  <input className="wf-input" value={cForm.value} onChange={(e) => setCForm({ ...cForm, value: e.target.value })} placeholder={cForm.type === 'percent' ? '20' : '50'} />
                </label>
              </div>
              {cErr && <p className="wf-auth-error" style={{ margin: 0 }}>{cErr}</p>}
              <button type="submit" className="wf-form-submit wf-mag" disabled={cBusy}>
                {cBusy ? 'Creating…' : (<><PlusIcon /> Create coupon</>)}
              </button>
            </form>
          </div>
        )}

        {adminTab === 'users' && (
          <div data-reveal>
            <div className="wf-users-head">
              <span>Members · {users.length}</span>
              <span className="wf-users-sub">
                {users.filter((u) => u.role === 'admin' || u.email === adminEmail).length} admin ·{' '}
                {users.filter((u) => u.role !== 'admin' && u.email !== adminEmail).length} customer
              </span>
            </div>
            {users.length === 0 && <p className="wf-detail-desc">No users yet.</p>}
            {users.length > 0 && (
              <div className="wf-utable">
                <div className="wf-utable-head">
                  <span>Member</span>
                  <span>Role</span>
                  <span>Joined</span>
                  <span>Action</span>
                  <span />
                </div>
                {users.map((u) => {
                  const isOwner = u.email === adminEmail
                  const isSelf = u.email === user
                  const isAdminRole = isOwner || u.role === 'admin'
                  const toggleRole = async () => {
                    const next = isAdminRole ? 'customer' : 'admin'
                    if (await setUserRole(u.id, next)) {
                      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role: next } : x)))
                    }
                  }
                  return (
                    <div className="wf-urow" key={u.id}>
                      <div className="wf-umember">
                        <span className="wf-admin-ico wf-card-ph-akashic">{(u.name || u.email || '?').charAt(0).toUpperCase()}</span>
                        <div className="wf-umember-text">
                          <span className="wf-umember-name">{u.name || u.email.split('@')[0]}</span>
                          <span className="wf-umember-email">{u.email}</span>
                        </div>
                      </div>
                      <div className="wf-umeta">
                        <span className={`wf-plan-pill${isAdminRole ? ' inner' : ''}`}>
                          {isOwner ? 'Owner' : isAdminRole ? 'Admin' : 'Customer'}
                        </span>
                        <span className="wf-ujoined">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </span>
                        <span className="wf-uaction">
                          {!isOwner && !isSelf && (
                            <button className="wf-role-btn" onClick={toggleRole}>
                              {isAdminRole ? 'Revoke admin' : 'Make admin'}
                            </button>
                          )}
                          {(isOwner || isSelf) && <span className="wf-muted-mini">—</span>}
                        </span>
                      </div>
                      <div className="wf-udel">
                        {!isOwner && !isSelf && (
                          <button
                            className="wf-del"
                            aria-label={`Delete ${u.email}`}
                            onClick={async () => {
                              if (await deleteUser(u.id)) setUsers((prev) => prev.filter((x) => x.id !== u.id))
                            }}
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {adminTab === 'support' && (
          <div className="wf-support-grid" data-reveal>
            <div className="wf-convo-list">
              <div className="wf-field-label" style={{ marginBottom: 12 }}>
                Conversations · {conversations.length}
              </div>
              {conversations.length === 0 && <p className="wf-detail-desc">No messages yet.</p>}
              {conversations.map((c) => (
                <button
                  key={c.conversationId}
                  className={`wf-convo${activeConv === c.conversationId ? ' active' : ''}`}
                  onClick={() => setActiveConv(c.conversationId)}
                >
                  <span className="wf-convo-name">{c.email || `Guest · ${c.conversationId.slice(0, 6)}`}</span>
                  <span className="wf-convo-last">{c.lastBody}</span>
                </button>
              ))}
            </div>

            <div className="wf-form-card">
              {!activeConv ? (
                <p className="wf-detail-desc" style={{ margin: 0 }}>Select a conversation to reply.</p>
              ) : (
                <>
                  <div className="wf-thread" ref={threadRef}>
                    {thread.map((m, i) => (
                      <div key={i} className={`wf-msg wf-msg--${m.from}`}>
                        {m.from === 'admin' && <span className="wf-msg-who">You</span>}
                        {m.text}
                      </div>
                    ))}
                  </div>
                  <form className="wf-chat-input" onSubmit={sendReply}>
                    <input className="wf-input" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply as Waslerr admin…" />
                    <button className="wf-chat-send" type="submit" aria-label="Send reply">
                      <SendIcon />
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
