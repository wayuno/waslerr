import { useEffect, useRef, useState } from 'react'
import Background from '../components/Background'
import { useStore } from '../store/StoreProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'
import { Stars } from '../components/StoryCard'
import { TrashIcon, SendIcon, PlusIcon } from '../components/icons'

const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('en-US')
const ZERO_STATS = {
  revenueWeek: 0, revenueMonth: 0, revenueYear: 0, revenueTotal: 0,
  salesWeek: 0, salesMonth: 0, salesYear: 0, salesTotal: 0,
  fieldsPublished: 0, freeFields: 0, supportChats: 0,
  monthly: [], topFields: [],
}

const TABS = [
  { id: 'stats', label: 'Stats' },
  { id: 'fields', label: 'Fields' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'coupons', label: 'Coupons' },
  { id: 'users', label: 'Users' },
  { id: 'community', label: 'Community' },
  { id: 'support', label: 'Support' },
]
const CAT_LABEL = { desire: 'Desire', akashic: 'Akashic', wealth: 'Wealth' }
const phClass = (line) => (line === 'akashic' ? 'wf-card-ph-akashic' : line === 'wealth' ? 'wf-card-ph-wealth' : 'wf-card-ph-desire')

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
    paidProducts,
    freeFields,
    addProduct,
    deleteProduct,
    addFreeField,
    deleteFreeField,
    announcements,
    addAnnouncement,
    deleteAnnouncement,
    deleteConversation,
    deleteUser,
    setUserRole,
    communityLinks,
    setCommunityLinks,
    wall,
    reloadReviews,
    featureReview,
    deleteReview,
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

  // community links
  const [clForm, setClForm] = useState(communityLinks)
  const [clSaved, setClSaved] = useState(false)

  // stats (real, from Supabase orders)
  const [stats, setStats] = useState(ZERO_STATS)

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

  // load real stats when on the stats tab
  useEffect(() => {
    if (!isAdmin || adminTab !== 'stats') return
    ;(async () => {
      const r = await authedFetch('/api/admin/stats')
      if (r.ok) setStats({ ...ZERO_STATS, ...(await r.json()) })
    })()
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

  // refresh the wall when on the reviews tab (to pick up featured states)
  useEffect(() => {
    if (isAdmin && adminTab === 'reviews') reloadReviews()
  }, [isAdmin, adminTab, reloadReviews])

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

  const statCards = [
    { label: 'Revenue · this month', value: fmtMoney(stats.revenueMonth) },
    { label: 'Sales · this week', value: String(stats.salesWeek), badge: stats.salesWeek > 0 ? 'live' : undefined },
    { label: 'Sales · this year', value: String(stats.salesYear) },
    { label: 'Fields published', value: String(stats.fieldsPublished + stats.freeFields) },
  ]
  const monthly = stats.monthly || []
  const maxBar = Math.max(1, ...monthly.map((b) => b.v))
  const topFields = stats.topFields || []
  const maxUnits = topFields.length ? Math.max(1, topFields[0].units) : 1
  const categoryOptions = [...new Set([...paidProducts.map((p) => (p.line || '').toUpperCase()), 'DESIRE', 'AKASHIC', 'WEALTH'])].filter(Boolean)

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
    const priceNum = parseFloat(String(form.price).replace(/[^0-9.]/g, '')) || 0
    // price 0 → goes to the separate free_fields table; otherwise to products
    const res =
      priceNum === 0
        ? await addFreeField(
            { title: form.title.trim(), line: form.category.toLowerCase(), description: form.desc.trim() || 'A free Waslerr field.' },
            file,
          )
        : await addProduct(
            {
              title: form.title.trim(),
              line: form.category.toLowerCase(),
              price: priceNum,
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

  const saveCommunity = async (e) => {
    e.preventDefault()
    await setCommunityLinks({
      youtube: clForm.youtube.trim(),
      discord: clForm.discord.trim(),
      creator: clForm.creator.trim(),
    })
    setClSaved(true)
    setTimeout(() => setClSaved(false), 2200)
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

  const removeConversation = async (conversationId) => {
    if (!window.confirm('Delete this conversation? This clears its messages permanently.')) return
    if (await deleteConversation(conversationId)) {
      setConversations((prev) => prev.filter((c) => c.conversationId !== conversationId))
      if (activeConv === conversationId) {
        setActiveConv(null)
        setThread([])
      }
    }
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
              {statCards.map((s) => (
                <div className="wf-stat-card" key={s.label}>
                  {s.badge && <span className="wf-stat-badge">{s.badge}</span>}
                  <div className="wf-stat-value">{s.value}</div>
                  <div className="wf-stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="wf-stat-grid" data-reveal style={{ marginTop: 14 }}>
              <div className="wf-stat-card">
                <div className="wf-stat-value">{fmtMoney(stats.revenueWeek)}</div>
                <div className="wf-stat-label">Revenue · this week</div>
              </div>
              <div className="wf-stat-card">
                <div className="wf-stat-value">{fmtMoney(stats.revenueYear)}</div>
                <div className="wf-stat-label">Revenue · this year</div>
              </div>
              <div className="wf-stat-card">
                <div className="wf-stat-value">{fmtMoney(stats.revenueTotal)}</div>
                <div className="wf-stat-label">Revenue · all time</div>
              </div>
              <div className="wf-stat-card">
                <div className="wf-stat-value">{String(stats.supportChats)}</div>
                <div className="wf-stat-label">Support chats</div>
              </div>
            </div>

            <div className="wf-analytics-split" data-reveal>
              <div className="wf-chart-card">
                <div className="wf-field-label" style={{ marginBottom: 20 }}>
                  Revenue · last 6 months ($)
                </div>
                <div className="wf-chart">
                  {monthly.map((b, i) => (
                    <div className="wf-chart-col" key={`${b.m}-${i}`}>
                      <div className="wf-chart-bar-track">
                        <div className="wf-chart-bar" style={{ height: `${(b.v / maxBar) * 100}%`, animationDelay: `${i * 0.08}s` }}>
                          <span>{b.v}</span>
                        </div>
                      </div>
                      <div className="wf-chart-x">{b.m}</div>
                    </div>
                  ))}
                  {monthly.length === 0 && <p className="wf-detail-desc">No revenue data yet.</p>}
                </div>
              </div>

              <div className="wf-chart-card">
                <div className="wf-field-label" style={{ marginBottom: 16 }}>
                  Top fields · by sales
                </div>
                <div className="wf-top-list">
                  {topFields.map((p) => (
                    <div className="wf-top-row" key={p.id}>
                      <span className="wf-top-ico wf-card-ph-desire">W</span>
                      <div className="wf-top-text">
                        <span className="wf-top-title">{p.title}</span>
                        <span className="wf-top-count">{p.units.toLocaleString('en-US')} sold · {fmtMoney(p.revenue)}</span>
                      </div>
                      <div className="wf-spark" aria-hidden="true">
                        {Array.from({ length: 7 }, (_, i) => (
                          <span key={i} style={{ height: `${Math.max(12, (p.units / maxUnits) * 100)}%`, opacity: 0.4 + (p.units / maxUnits) * 0.6 }} />
                        ))}
                      </div>
                    </div>
                  ))}
                  {topFields.length === 0 && <p className="wf-detail-desc">No sales yet.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {adminTab === 'fields' && (
          <div className="wf-admin-fields">
            <div data-reveal>
              <div className="wf-field-label" style={{ marginBottom: 14 }}>
                Paid fields · {paidProducts.length}
              </div>
              <div className="wf-admin-list">
                {paidProducts.length === 0 && <p className="wf-detail-desc">No paid fields yet. Add one →</p>}
                {paidProducts.map((p) => (
                  <div className="wf-admin-row" key={p.id}>
                    <span className={`wf-admin-ico ${phClass(p.line)}`}>{p.image_url ? '' : 'W'}</span>
                    <div className="wf-admin-row-text">
                      <span className="wf-admin-row-title">{p.title}</span>
                      <span className="wf-admin-row-meta">
                        {CAT_LABEL[p.line] || 'Desire'} · {p.price || '—'}
                      </span>
                    </div>
                    <button className="wf-del" aria-label={`Delete ${p.title}`} onClick={() => deleteProduct(p.id)}>
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>

              <div className="wf-field-label" style={{ margin: '28px 0 14px' }}>
                Free fields · {freeFields.length}
              </div>
              <div className="wf-admin-list">
                {freeFields.length === 0 && <p className="wf-detail-desc">No free fields yet. Add one with price 0 →</p>}
                {freeFields.map((p) => (
                  <div className="wf-admin-row" key={p.id}>
                    <span className={`wf-admin-ico ${phClass(p.line)}`}>{p.image_url ? '' : 'W'}</span>
                    <div className="wf-admin-row-text">
                      <span className="wf-admin-row-title">{p.title}</span>
                      <span className="wf-admin-row-meta">{CAT_LABEL[p.line] || 'Desire'} · Free</span>
                    </div>
                    <button className="wf-del" aria-label={`Delete ${p.title}`} onClick={() => deleteFreeField(p.id)}>
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

        {adminTab === 'reviews' && (
          <div data-reveal>
            <div className="wf-field-label" style={{ marginBottom: 14 }}>
              Community stories · {wall.length} · {wall.filter((r) => r.featured).length} featured
            </div>
            {wall.length === 0 && <p className="wf-detail-desc">No stories yet.</p>}
            <div className="wf-admin-list">
              {wall.map((rv) => {
                const prod = products.find((p) => p.id === rv.field)
                const snippet = rv.text.length > 90 ? rv.text.slice(0, 90) + '…' : rv.text
                return (
                  <div className="wf-admin-row" key={rv.id}>
                    <span className="wf-admin-ico wf-card-ph-akashic">{(rv.name || '?').charAt(0).toUpperCase()}</span>
                    <div className="wf-admin-row-text">
                      <span className="wf-admin-row-title">{rv.name}</span>
                      <span className="wf-admin-row-meta">
                        {(prod?.title || 'a field')} · “{snippet}”
                      </span>
                    </div>
                    <span className="wf-stars-row" style={{ flex: 'none' }}>
                      <Stars rating={rv.rating} size={12} />
                    </span>
                    <button
                      className={`wf-role-btn${rv.featured ? ' on' : ''}`}
                      style={{ flex: 'none' }}
                      onClick={() => featureReview(rv.id, !rv.featured)}
                    >
                      {rv.featured ? '★ Featured' : 'Feature'}
                    </button>
                    <button className="wf-del" aria-label={`Delete ${rv.name}'s story`} onClick={() => deleteReview(rv.id)}>
                      <TrashIcon />
                    </button>
                  </div>
                )
              })}
            </div>
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

        {adminTab === 'community' && (
          <div className="wf-cl-wrap" data-reveal>
            <form className="wf-form-card" onSubmit={saveCommunity}>
              <div className="wf-eyebrow" style={{ marginBottom: 4 }}>
                Community links
              </div>
              <p className="wf-card-sub" style={{ margin: '0 0 8px' }}>
                These power the Community page and the footer. Changes apply across the site instantly.
              </p>
              <label className="wf-field">
                <span className="wf-field-label">YouTube URL</span>
                <input
                  className="wf-input"
                  value={clForm.youtube}
                  onChange={(e) => setClForm({ ...clForm, youtube: e.target.value })}
                  placeholder="https://youtube.com/@waslerrfields"
                />
              </label>
              <label className="wf-field">
                <span className="wf-field-label">Discord invite URL</span>
                <input
                  className="wf-input"
                  value={clForm.discord}
                  onChange={(e) => setClForm({ ...clForm, discord: e.target.value })}
                  placeholder="https://discord.gg/waslerrfields"
                />
              </label>
              <label className="wf-field">
                <span className="wf-field-label">1:1 with the creator — email or booking link</span>
                <input
                  className="wf-input"
                  value={clForm.creator}
                  onChange={(e) => setClForm({ ...clForm, creator: e.target.value })}
                  placeholder="hello@waslerrfields.com or https://cal.com/you"
                />
                <span className="wf-field-hint">An email opens the visitor&apos;s mail app; a link opens in a new tab.</span>
              </label>
              <button type="submit" className="wf-form-submit wf-mag">
                {clSaved ? '✓ Saved' : 'Save links'}
              </button>
            </form>
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
                <div className="wf-convo-wrap" key={c.conversationId}>
                  <button
                    className={`wf-convo${activeConv === c.conversationId ? ' active' : ''}`}
                    onClick={() => setActiveConv(c.conversationId)}
                  >
                    <span className="wf-convo-name">{c.email || `Guest · ${c.conversationId.slice(0, 6)}`}</span>
                    <span className="wf-convo-last">{c.lastBody}</span>
                  </button>
                  <button
                    className="wf-convo-del"
                    aria-label="Delete conversation"
                    onClick={() => removeConversation(c.conversationId)}
                  >
                    <TrashIcon />
                  </button>
                </div>
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
