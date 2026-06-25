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
  { id: 'support', label: 'Support' },
]
const CAT_LABEL = { desire: 'Desire', akashic: 'Akashic', wealth: 'Wealth' }
const phClass = (line) => (line === 'akashic' ? 'wf-card-ph-akashic' : line === 'wealth' ? 'wf-card-ph-wealth' : 'wf-card-ph-desire')

export default function Admin() {
  const {
    loggedIn,
    isAdmin,
    user,
    logout,
    requireAdmin,
    navigate,
    adminTab,
    setAdminTab,
    products,
    addProduct,
    deleteProduct,
    chatMsgs,
    sendAdminReply,
  } = useStore()
  const ref = useRef(null)
  useReveal(ref)
  useMagnetic(ref)

  const [form, setForm] = useState({ title: '', category: 'DESIRE', price: '', desc: '' })
  const [reply, setReply] = useState('')
  const threadRef = useRef(null)

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [chatMsgs, adminTab])

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
                <p className="wf-auth-sub">
                  This dashboard is restricted to the Waslerr admin. You&apos;re signed in as {user}.
                </p>
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

  const openChats = chatMsgs.filter((m) => m.from === 'user').length
  const stats = [
    { label: 'Revenue · June', value: adminMeta.revenue },
    { label: 'Active listeners', value: adminMeta.listeners },
    { label: 'Fields published', value: String(products.length) },
    { label: 'Open support chats', value: String(openChats) },
  ]
  const maxBar = Math.max(...revenueBars.map((b) => b.v))

  const publish = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    const price = form.price.trim()
    addProduct({
      title: form.title.trim(),
      line: form.category.toLowerCase(),
      price: price ? (price.startsWith('$') ? price : `$${price}`) : '$0',
      desc: form.desc.trim() || 'A new Waslerr field.',
    })
    setForm({ title: '', category: 'DESIRE', price: '', desc: '' })
  }

  const submitReply = (e) => {
    e.preventDefault()
    sendAdminReply(reply)
    setReply('')
  }

  return (
    <div className="wf-app" ref={ref}>
      <Background resonanceTop="50%" />

      <section className="wf-section" style={{ maxWidth: 1080, margin: '0 auto', padding: '110px 28px 100px' }}>
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
            <button
              key={t.id}
              className={`wf-tab${adminTab === t.id ? ' active' : ''}`}
              onClick={() => setAdminTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {adminTab === 'stats' && (
          <div>
            <div className="wf-stat-grid" data-reveal>
              {stats.map((s) => (
                <div className="wf-stat-card" key={s.label}>
                  <div className="wf-stat-value">{s.value}</div>
                  <div className="wf-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="wf-chart-card" data-reveal>
              <div className="wf-field-label" style={{ marginBottom: 20 }}>
                Revenue · last 6 months (thousands)
              </div>
              <div className="wf-chart">
                {revenueBars.map((b, i) => (
                  <div className="wf-chart-col" key={b.m}>
                    <div className="wf-chart-bar-track">
                      <div
                        className="wf-chart-bar"
                        style={{ height: `${(b.v / maxBar) * 100}%`, animationDelay: `${i * 0.08}s` }}
                      >
                        <span>{b.v}</span>
                      </div>
                    </div>
                    <div className="wf-chart-x">{b.m}</div>
                  </div>
                ))}
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
                    <span className={`wf-admin-ico ${phClass(p.line)}`}>W</span>
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
                <input
                  className="wf-input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Field title"
                />
              </label>
              <div className="wf-form-row">
                <label className="wf-field">
                  <span className="wf-field-label">Category</span>
                  <select
                    className="wf-select"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    <option value="DESIRE">DESIRE</option>
                    <option value="AKASHIC">AKASHIC</option>
                    <option value="WEALTH">WEALTH</option>
                  </select>
                </label>
                <label className="wf-field">
                  <span className="wf-field-label">Price</span>
                  <input
                    className="wf-input"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="$150"
                  />
                </label>
              </div>
              <label className="wf-field">
                <span className="wf-field-label">Description</span>
                <textarea
                  className="wf-textarea"
                  rows="3"
                  value={form.desc}
                  onChange={(e) => setForm({ ...form, desc: e.target.value })}
                  placeholder="What does this field encode?"
                />
              </label>
              <button type="submit" className="wf-form-submit wf-mag">
                <PlusIcon /> Publish field
              </button>
            </form>
          </div>
        )}

        {adminTab === 'support' && (
          <div className="wf-form-card" data-reveal style={{ maxWidth: 620 }}>
            <div className="wf-eyebrow" style={{ marginBottom: 16 }}>
              Live support thread
            </div>
            <div className="wf-thread" ref={threadRef}>
              {chatMsgs.map((m, i) => (
                <div key={i} className={`wf-msg wf-msg--${m.from}`}>
                  {m.from !== 'user' && <span className="wf-msg-who">{m.from === 'admin' ? 'You' : 'Auto'}</span>}
                  {m.text}
                </div>
              ))}
            </div>
            <form className="wf-chat-input" onSubmit={submitReply}>
              <input
                className="wf-input"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Reply as Waslerr admin…"
              />
              <button className="wf-chat-send" type="submit" aria-label="Send reply">
                <SendIcon />
              </button>
            </form>
          </div>
        )}
      </section>
    </div>
  )
}
