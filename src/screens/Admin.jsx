import { useEffect, useRef, useState } from 'react'
import Background from '../components/Background'
import { useStore } from '../store/StoreProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'
import { TrashIcon, SendIcon, PlusIcon } from '../components/icons'

const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('en-US')

// Inline editor for a field's "sold" count (admin-set social proof).
function SoldEditor({ item, isFree, soldEdits, setSoldEdits, saveSold }) {
  const dirty = soldEdits[item.id] != null
  const val = dirty ? soldEdits[item.id] : String(item.sold || 0)
  return (
    <div className="wf-sold-edit">
      <input
        className="wf-input wf-sold-input"
        type="number"
        min="0"
        value={val}
        onChange={(e) => setSoldEdits((prev) => ({ ...prev, [item.id]: e.target.value }))}
        onKeyDown={(e) => e.key === 'Enter' && saveSold(item.id, isFree)}
        aria-label={`Sold count for ${item.title}`}
      />
      <span className="wf-sold-suffix">sold</span>
      {dirty && (
        <button type="button" className="wf-sold-save" onClick={() => saveSold(item.id, isFree)}>
          Save
        </button>
      )}
    </div>
  )
}
// Per-field benefits editor: add (Enter / Add button), click a chip to remove.
// Used in both the create and edit field forms (free + paid).
function BenefitsEditor({ list, setList }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim()
    if (!v) return
    setList([...list, v].slice(0, 30))
    setDraft('')
  }
  return (
    <label className="wf-field">
      <span className="wf-field-label">Benefits · {list.length} — what this field rewires</span>
      <div className="wf-offer-inc-row">
        <input
          className="wf-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Add a benefit + Enter"
        />
        <button type="button" className="wf-coupon-apply" onClick={add}>Add</button>
      </div>
      {list.length > 0 && (
        <div className="wf-offer-inc-chips">
          {list.map((b, i) => (
            <span key={i} className="wf-offer-inc-chip" onClick={() => setList(list.filter((_, j) => j !== i))}>
              {b} ✕
            </span>
          ))}
        </div>
      )}
    </label>
  )
}

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
    signIn,
    navigate,
    adminTab,
    setAdminTab,
    products,
    paidProducts,
    freeFields,
    addProduct,
    deleteProduct,
    updateProduct,
    addFreeField,
    deleteFreeField,
    announcements,
    addAnnouncement,
    deleteAnnouncement,
    deleteConversation,
    deleteUser,
    setUserRole,
    createOffer,
    deliverOffer,
    showToast,
    communityLinks,
    setCommunityLinks,
    wall,
    reloadReviews,
    featureReview,
    deleteReview,
    adminAddReview,
    setSoldCount,
    authedFetch,
  } = useStore()
  const ref = useRef(null)
  useReveal(ref)
  useMagnetic(ref)

  // product add form
  const [form, setForm] = useState({ title: '', category: 'DESIRE', price: '', desc: '', benefits: [] })
  const [file, setFile] = useState(null)
  const [audioFile, setAudioFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileInputRef = useRef(null)
  const audioInputRef = useRef(null)

  // per-field edit panel
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', category: '', price: '', desc: '', benefits: [], isFree: false })
  const [editImg, setEditImg] = useState(null)
  const [editAudio, setEditAudio] = useState(null)
  const [editBusy, setEditBusy] = useState(false)
  const [editErr, setEditErr] = useState('')

  // coupons
  const [coupons, setCoupons] = useState([])
  const [cForm, setCForm] = useState({ code: '', type: 'percent', value: '', fieldId: '', maxUses: '', expiresAt: '' })
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

  // admin sign-in (inline at the secret path — sign-in only, no account creation)
  const [adminEmailIn, setAdminEmailIn] = useState('')
  const [adminPassIn, setAdminPassIn] = useState('')
  const [adminLoginErr, setAdminLoginErr] = useState('')
  const [adminLoginBusy, setAdminLoginBusy] = useState(false)

  // admin add-review form
  const [rvForm, setRvForm] = useState({ field: '', name: '', text: '', featured: false })
  const [rvPhotos, setRvPhotos] = useState([])
  const [rvErr, setRvErr] = useState('')
  const [rvBusy, setRvBusy] = useState(false)
  const [rvUploading, setRvUploading] = useState(false)
  const rvPhotoRef = useRef(null)

  // inline "sold count" edits per field id → string value
  const [soldEdits, setSoldEdits] = useState({})

  // support
  const [conversations, setConversations] = useState([])
  const [activeConv, setActiveConv] = useState(null)
  const [thread, setThread] = useState([])
  const [convOffers, setConvOffers] = useState([]) // offers in the active thread
  const [reply, setReply] = useState('')

  // offer builder + delivery composer
  const [offerForm, setOfferForm] = useState({ name: '', description: '', amount: '', deliveryEstimate: '6–7 days', includes: [], includeInput: '' })
  const [offerBusy, setOfferBusy] = useState(false)
  const [offerErr, setOfferErr] = useState('')
  const [showOfferBuilder, setShowOfferBuilder] = useState(false)
  const [deliverFiles, setDeliverFiles] = useState([])
  const [deliverNote, setDeliverNote] = useState('')
  const [deliverBusy, setDeliverBusy] = useState(false)
  const [deliverErr, setDeliverErr] = useState('')
  const [deliverPct, setDeliverPct] = useState(0)
  const [deliverElapsed, setDeliverElapsed] = useState(0)
  const [deliveredFlashId, setDeliveredFlashId] = useState(null) // shows "order complete" for ~10s after delivery
  const paidSeen = useRef(new Set())
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

  // load + poll the open conversation thread (messages + offers)
  useEffect(() => {
    if (!activeConv) return
    let t
    const load = async () => {
      const r = await fetch('/api/chat/messages?conversationId=' + encodeURIComponent(activeConv))
      if (!r.ok) return
      const d = await r.json()
      setThread(d.messages || [])
      const offers = d.offers || []
      setConvOffers(offers)
      // payment-landed toast (once per offer)
      offers.forEach((o) => {
        if ((o.status === 'paid' || o.status === 'delivered') && !paidSeen.current.has(o.id)) {
          // skip the first load (don't toast pre-existing paid offers)
          if (paidSeen.current.size >= 0 && paidSeen.current.has('__init_' + activeConv)) {
            showToast(`Payment received · $${o.amount}${o.customerEmail ? ' from ' + o.customerEmail : ''}`)
          }
          paidSeen.current.add(o.id)
        }
      })
      paidSeen.current.add('__init_' + activeConv)
    }
    load()
    t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [activeConv, showToast])

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [thread])

  const submitAdminSignIn = async (e) => {
    e.preventDefault()
    setAdminLoginErr('')
    if (!adminEmailIn.trim() || !adminPassIn) {
      setAdminLoginErr('Enter the admin email and password.')
      return
    }
    setAdminLoginBusy(true)
    const res = await signIn(adminEmailIn, adminPassIn)
    setAdminLoginBusy(false)
    if (res?.error) setAdminLoginErr(res.error)
    // on success the store sets isAdmin (only if the email matches ADMIN_EMAIL),
    // and this gate re-renders as the dashboard or the "restricted" notice.
  }

  if (!loggedIn || !isAdmin) {
    return (
      <div className="wf-app" ref={ref}>
        <Background resonanceTop="50%" />
        <section className="wf-auth" style={{ minHeight: '100vh' }}>
          <form className="wf-auth-card" data-reveal onSubmit={submitAdminSignIn}>
            <span className="wf-monogram" style={{ width: 46, height: 46, fontSize: 26, marginBottom: 18 }}>
              W
            </span>
            <h1 className="wf-auth-title">Admin access</h1>
            {!loggedIn ? (
              <>
                <p className="wf-auth-sub">Restricted area. Sign in with the Waslerr admin account.</p>
                <label className="wf-field" style={{ width: '100%' }}>
                  <span className="wf-field-label">Email</span>
                  <input
                    className="wf-input"
                    type="email"
                    value={adminEmailIn}
                    onChange={(e) => setAdminEmailIn(e.target.value)}
                    placeholder="admin email"
                    autoComplete="email"
                  />
                </label>
                <label className="wf-field" style={{ width: '100%' }}>
                  <span className="wf-field-label">Password</span>
                  <input
                    className="wf-input"
                    type="password"
                    value={adminPassIn}
                    onChange={(e) => setAdminPassIn(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </label>
                {adminLoginErr && <p className="wf-auth-error">{adminLoginErr}</p>}
                <button type="submit" className="wf-form-submit wf-mag" style={{ width: '100%', marginTop: 6 }} disabled={adminLoginBusy}>
                  {adminLoginBusy ? 'Signing in…' : 'Sign in'}
                </button>
                {/* No account creation here — admin is provisioned from Railway env only. */}
              </>
            ) : (
              <>
                <p className="wf-auth-sub">This dashboard is restricted to the Waslerr admin. You&apos;re signed in as {user}, which isn&apos;t the admin account.</p>
                <button type="button" className="wf-form-submit wf-mag" style={{ width: '100%' }} onClick={() => navigate('home')}>
                  Back to home
                </button>
                <button type="button" className="wf-back" style={{ marginTop: 6 }} onClick={logout}>
                  Sign out
                </button>
              </>
            )}
          </form>
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
  const allFieldOptions = [...paidProducts, ...freeFields]
  // active offer in the open support thread + a lookup for rendering cards
  const offerById = Object.fromEntries(convOffers.map((o) => [o.id, o]))
  const activeOffer = [...convOffers].reverse().find((o) => o.status !== 'cancelled') || null
  const activeFree = activeOffer && Number(activeOffer.amount) === 0
  const convStatus =
    !activeOffer ? 'New request'
      : activeOffer.status === 'sent' ? 'Awaiting payment'
      : activeOffer.status === 'paid' ? (activeFree ? 'Free' : 'Paid')
      : activeOffer.status === 'delivered' ? 'Delivered'
      : 'New request'
  // After a completed delivery the order is done — only re-offer "Create field"
  // if the customer has sent a fresh request since the last delivery.
  const deliveredAtMs = activeOffer?.deliveredAt ? Date.parse(activeOffer.deliveredAt) : 0
  const newRequestAfterDelivery =
    activeOffer?.status === 'delivered' &&
    thread.some((m) => m.from === 'user' && (Date.parse(m.at || 0) || 0) > deliveredAtMs)

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
            { title: form.title.trim(), line: form.category.toLowerCase(), description: form.desc.trim() || 'A free Waslerr field.', benefits: form.benefits },
            file,
            audioFile,
          )
        : await addProduct(
            {
              title: form.title.trim(),
              line: form.category.toLowerCase(),
              price: priceNum,
              description: form.desc.trim() || 'A new Waslerr field.',
              benefits: form.benefits,
            },
            file,
            audioFile,
          )
    setBusy(false)
    if (res?.error) {
      setErr(res.error)
      return
    }
    setForm({ title: '', category: 'DESIRE', price: '', desc: '', benefits: [] })
    setFile(null)
    setAudioFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (audioInputRef.current) audioInputRef.current.value = ''
  }

  // open/save the per-field edit panel
  const openEdit = (p, isFree) => {
    setEditErr('')
    setEditImg(null)
    setEditAudio(null)
    setEditId(p.id)
    setEditForm({
      title: p.title || '',
      category: (p.line || 'desire').toUpperCase(),
      price: isFree ? '' : String(p.priceNum ?? ''),
      desc: p.desc || '',
      benefits: Array.isArray(p.benefits) ? p.benefits : [],
      isFree,
    })
  }
  const saveEdit = async () => {
    setEditErr('')
    if (!editForm.title.trim()) return setEditErr('Title is required.')
    setEditBusy(true)
    const patch = { title: editForm.title.trim(), line: editForm.category.toLowerCase(), description: editForm.desc, benefits: editForm.benefits }
    if (!editForm.isFree) patch.price = parseFloat(String(editForm.price).replace(/[^0-9.]/g, '')) || 0
    const res = await updateProduct(editId, editForm.isFree, patch, editImg, editAudio)
    setEditBusy(false)
    if (res?.error) return setEditErr(res.error)
    setEditId(null)
  }
  const renderEditPanel = (p) => (
    <div className="wf-field-edit" key={p.id + '-edit'}>
      <div className="wf-eyebrow" style={{ marginBottom: 2 }}>Edit field</div>
      <label className="wf-field">
        <span className="wf-field-label">Title</span>
        <input className="wf-input" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
      </label>
      <div className="wf-form-row">
        <label className="wf-field">
          <span className="wf-field-label">Category</span>
          <input className="wf-input" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value.toUpperCase() })} />
        </label>
        {!editForm.isFree && (
          <label className="wf-field">
            <span className="wf-field-label">Price</span>
            <input className="wf-input" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} placeholder="$" />
          </label>
        )}
      </div>
      <label className="wf-field">
        <span className="wf-field-label">Description</span>
        <textarea className="wf-textarea" rows="2" value={editForm.desc} onChange={(e) => setEditForm({ ...editForm, desc: e.target.value })} />
      </label>
      <BenefitsEditor list={editForm.benefits} setList={(b) => setEditForm((f) => ({ ...f, benefits: b }))} />
      <label className="wf-field">
        <span className="wf-field-label">Replace image {editImg ? `· ${editImg.name}` : '(keep current)'}</span>
        <input className="wf-input wf-file" type="file" accept="image/*" onChange={(e) => setEditImg(e.target.files?.[0] || null)} />
      </label>
      <label className="wf-field">
        <span className="wf-field-label">Replace audio {editAudio ? `· ${editAudio.name}` : p.hasAudio ? '(audio set — keep current)' : '(no audio yet)'}</span>
        <input className="wf-input wf-file" type="file" accept="audio/*" onChange={(e) => setEditAudio(e.target.files?.[0] || null)} />
      </label>
      {editErr && <p className="wf-auth-error" style={{ margin: 0 }}>{editErr}</p>}
      <div className="wf-form-row" style={{ marginTop: 4 }}>
        <button type="button" className="wf-back" onClick={() => setEditId(null)}>Cancel</button>
        <button type="button" className="wf-form-submit wf-mag" onClick={saveEdit} disabled={editBusy}>{editBusy ? 'Saving…' : 'Save changes'}</button>
      </div>
    </div>
  )

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
      body: JSON.stringify({
        code,
        type: cForm.type,
        value: Number(cForm.value) || 0,
        fieldId: cForm.fieldId || null, // '' = all paid fields
        maxUses: cForm.maxUses || null,
        expiresAt: cForm.expiresAt || null,
      }),
    })
    setCBusy(false)
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setCErr(j.error === 'duplicate' ? 'That code already exists.' : 'Could not create coupon.')
      return
    }
    setCForm({ code: '', type: 'percent', value: '', fieldId: '', maxUses: '', expiresAt: '' })
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

  // ---- offers (create field, deliver) ----
  const addInclude = () => {
    const v = offerForm.includeInput.trim()
    if (!v) return
    setOfferForm((f) => ({ ...f, includes: [...f.includes, v].slice(0, 12), includeInput: '' }))
  }
  const sendOffer = async (e) => {
    e.preventDefault()
    setOfferErr('')
    const amount = parseFloat(String(offerForm.amount).replace(/[^0-9.]/g, '')) || 0
    if (!offerForm.name.trim()) return setOfferErr('Add a field name.')
    if (amount < 0) return setOfferErr('Amount can’t be negative.') // 0 = free
    setOfferBusy(true)
    const res = await createOffer(activeConv, {
      name: offerForm.name.trim(),
      description: offerForm.description.trim(),
      amount,
      currency: 'USD',
      deliveryEstimate: offerForm.deliveryEstimate.trim() || '6–7 days',
      includes: offerForm.includes,
    })
    setOfferBusy(false)
    if (res?.error) return setOfferErr(res.error)
    setOfferForm({ name: '', description: '', amount: '', deliveryEstimate: '6–7 days', includes: [], includeInput: '' })
    setShowOfferBuilder(false)
    // the server supersedes any prior unpaid offer — reflect that locally too
    setConvOffers((prev) => [...prev.map((o) => (o.status === 'sent' ? { ...o, status: 'cancelled' } : o)), res.offer])
    showToast(amount === 0 ? 'Free field sent — ready to deliver' : 'Field sent — awaiting payment')
  }
  const submitDelivery = async (offerId) => {
    setDeliverErr('')
    if (!deliverFiles.length) return setDeliverErr('Choose at least one file to deliver.')
    setDeliverBusy(true)
    setDeliverPct(0)
    setDeliverElapsed(0)
    const startedAt = Date.now()
    const tick = setInterval(() => setDeliverElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    const res = await deliverOffer(offerId, {
      files: deliverFiles,
      note: deliverNote,
      onProgress: (p) => setDeliverPct(p),
    })
    clearInterval(tick)
    setDeliverBusy(false)
    if (res?.error) return setDeliverErr(res.error)
    setDeliverFiles([])
    setDeliverNote('')
    setDeliverPct(0)
    setConvOffers((prev) => prev.map((o) => (o.id === offerId ? res.offer : o)))
    showToast('Field delivered ✓')
    // flash "order complete" for ~10s, then let it fade out (admin-only cue)
    setDeliveredFlashId(offerId)
    setTimeout(() => setDeliveredFlashId((cur) => (cur === offerId ? null : cur)), 10000)
  }
  const fmtElapsed = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  // ---- admin add-review ----
  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result).split(',')[1])
      r.onerror = reject
      r.readAsDataURL(file)
    })

  const onPickReviewPhotos = async (e) => {
    setRvErr('')
    const files = Array.from(e.target.files || [])
    if (rvPhotoRef.current) rvPhotoRef.current.value = ''
    const room = 2 - rvPhotos.length
    if (room <= 0) return setRvErr('Up to 2 photos.')
    setRvUploading(true)
    for (const file of files.slice(0, room)) {
      if (!file.type.startsWith('image/')) { setRvErr('Images only.'); continue }
      try {
        const dataBase64 = await fileToBase64(file)
        const r = await fetch('/api/reviews/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, contentType: file.type, dataBase64 }),
        })
        const d = await r.json().catch(() => ({}))
        if (r.ok && d.url) setRvPhotos((prev) => (prev.length < 2 ? [...prev, d.url] : prev))
        else setRvErr(`Photo upload failed${d.detail ? ': ' + d.detail : ''}`)
      } catch {
        setRvErr('Photo upload failed.')
      }
    }
    setRvUploading(false)
  }

  const submitAdminReview = async (e) => {
    e.preventDefault()
    setRvErr('')
    const field = rvForm.field || allFieldOptions[0]?.id
    if (!field) return setRvErr('Pick a field.')
    if (!rvForm.name.trim()) return setRvErr('Add a name.')
    if (rvForm.text.trim().length < 4) return setRvErr('Add a short story.')
    setRvBusy(true)
    const res = await adminAddReview({
      field,
      name: rvForm.name.trim(),
      text: rvForm.text.trim(),
      featured: rvForm.featured,
      images: rvPhotos,
    })
    setRvBusy(false)
    if (res?.error) return setRvErr(res.error)
    setRvForm({ field, name: '', text: '', featured: false })
    setRvPhotos([])
  }

  const saveSold = async (id, isFree) => {
    const val = soldEdits[id]
    if (val == null) return
    if (await setSoldCount(id, isFree, val)) setSoldEdits((prev) => { const n = { ...prev }; delete n[id]; return n })
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
                  <div key={p.id}>
                    <div className="wf-admin-row">
                      <span className={`wf-admin-ico ${phClass(p.line)}`}>{p.image_url ? '' : 'W'}</span>
                      <div className="wf-admin-row-text">
                        <span className="wf-admin-row-title">
                          {p.title} {p.hasAudio && <span className="wf-audio-tag">♪ audio</span>}
                        </span>
                        <span className="wf-admin-row-meta">
                          {CAT_LABEL[p.line] || (p.line ? p.line[0].toUpperCase() + p.line.slice(1) : 'Desire')} · {p.price || '—'}
                        </span>
                      </div>
                      <SoldEditor item={p} isFree={false} soldEdits={soldEdits} setSoldEdits={setSoldEdits} saveSold={saveSold} />
                      <button className="wf-edit-btn" aria-label={`Edit ${p.title}`} onClick={() => openEdit(p, false)}>✎</button>
                      <button className="wf-del" aria-label={`Delete ${p.title}`} onClick={() => deleteProduct(p.id)}>
                        <TrashIcon />
                      </button>
                    </div>
                    {editId === p.id && renderEditPanel(p)}
                  </div>
                ))}
              </div>

              <div className="wf-field-label" style={{ margin: '28px 0 14px' }}>
                Free fields · {freeFields.length}
              </div>
              <div className="wf-admin-list">
                {freeFields.length === 0 && <p className="wf-detail-desc">No free fields yet. Add one with price 0 →</p>}
                {freeFields.map((p) => (
                  <div key={p.id}>
                    <div className="wf-admin-row">
                      <span className={`wf-admin-ico ${phClass(p.line)}`}>{p.image_url ? '' : 'W'}</span>
                      <div className="wf-admin-row-text">
                        <span className="wf-admin-row-title">
                          {p.title} {p.hasAudio && <span className="wf-audio-tag">♪ audio</span>}
                        </span>
                        <span className="wf-admin-row-meta">{CAT_LABEL[p.line] || (p.line ? p.line[0].toUpperCase() + p.line.slice(1) : 'Desire')} · Free</span>
                      </div>
                      <SoldEditor item={p} isFree={true} soldEdits={soldEdits} setSoldEdits={setSoldEdits} saveSold={saveSold} />
                      <button className="wf-edit-btn" aria-label={`Edit ${p.title}`} onClick={() => openEdit(p, true)}>✎</button>
                      <button className="wf-del" aria-label={`Delete ${p.title}`} onClick={() => deleteFreeField(p.id)}>
                        <TrashIcon />
                      </button>
                    </div>
                    {editId === p.id && renderEditPanel(p)}
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
              <BenefitsEditor list={form.benefits} setList={(b) => setForm((f) => ({ ...f, benefits: b }))} />
              <label className="wf-field">
                <span className="wf-field-label">Artwork image {file ? `· ${file.name}` : '(optional)'}</span>
                <input ref={fileInputRef} className="wf-input wf-file" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
              <label className="wf-field">
                <span className="wf-field-label">Audio file {audioFile ? `· ${audioFile.name}` : '(the product — gated)'}</span>
                <input ref={audioInputRef} className="wf-input wf-file" type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
                <span className="wf-field-hint">Paid fields: only unlocked after the customer pays. Free fields: open to all.</span>
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
          <div className="wf-admin-fields">
            <div data-reveal>
              <div className="wf-field-label" style={{ marginBottom: 16 }}>
                Community stories · {wall.length} · {wall.filter((r) => r.featured).length} featured
              </div>
              {wall.length === 0 && <p className="wf-detail-desc">No stories yet.</p>}
              <div className="wf-rv-list">
                {wall.map((rv) => {
                  const prod = products.find((p) => p.id === rv.field)
                  return (
                    <div className={`wf-rv-card${rv.featured ? ' featured' : ''}`} key={rv.id}>
                      <div className="wf-rv-head">
                        <span className="wf-admin-ico wf-card-ph-akashic">{(rv.name || '?').charAt(0).toUpperCase()}</span>
                        <div className="wf-rv-headtext">
                          <span className="wf-rv-name">
                            {rv.name}
                            {rv.featured && <span className="wf-rv-feat">★ Featured</span>}
                          </span>
                          <span className="wf-rv-field">on {prod?.title || 'a field'}</span>
                        </div>
                      </div>
                      <p className="wf-rv-text">{rv.text}</p>
                      {Array.isArray(rv.images) && rv.images.length > 0 && (
                        <div className="wf-rv-photos">
                          {rv.images.map((u) => (
                            <a className="wf-rv-photo" href={u} target="_blank" rel="noreferrer" key={u}>
                              <img src={u} alt="Review" loading="lazy" />
                            </a>
                          ))}
                        </div>
                      )}
                      <div className="wf-rv-actions">
                        <button className={`wf-role-btn${rv.featured ? ' on' : ''}`} onClick={() => featureReview(rv.id, !rv.featured)}>
                          {rv.featured ? '★ Featured' : 'Feature'}
                        </button>
                        <button className="wf-del" aria-label={`Delete ${rv.name}'s story`} onClick={() => deleteReview(rv.id)}>
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <form className="wf-form-card wf-admin-add" data-reveal onSubmit={submitAdminReview}>
              <div className="wf-eyebrow" style={{ marginBottom: 4 }}>
                Add a review
              </div>
              <label className="wf-field">
                <span className="wf-field-label">Field</span>
                <select
                  className="wf-select"
                  value={rvForm.field || allFieldOptions[0]?.id || ''}
                  onChange={(e) => setRvForm({ ...rvForm, field: e.target.value })}
                >
                  {allFieldOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="wf-field">
                <span className="wf-field-label">Name</span>
                <input className="wf-input" value={rvForm.name} onChange={(e) => setRvForm({ ...rvForm, name: e.target.value })} placeholder="e.g. Priya M." />
              </label>
              <label className="wf-field">
                <span className="wf-field-label">Story</span>
                <textarea className="wf-textarea" rows="3" value={rvForm.text} onChange={(e) => setRvForm({ ...rvForm, text: e.target.value })} placeholder="What changed…" />
              </label>
              <div className="wf-field">
                <span className="wf-field-label">Photos (up to 2)</span>
                <div className="wf-review-photos">
                  {rvPhotos.map((u) => (
                    <div className="wf-review-thumb" key={u}>
                      <img src={u} alt="Review" />
                      <button type="button" className="wf-review-thumb-x" aria-label="Remove" onClick={() => setRvPhotos((prev) => prev.filter((x) => x !== u))}>
                        ✕
                      </button>
                    </div>
                  ))}
                  {rvPhotos.length < 2 && (
                    <button type="button" className="wf-review-add-photo" onClick={() => rvPhotoRef.current?.click()} disabled={rvUploading}>
                      {rvUploading ? '…' : '+ Add photo'}
                    </button>
                  )}
                </div>
                <input ref={rvPhotoRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onPickReviewPhotos} />
              </div>
              <label className="wf-check-row">
                <input type="checkbox" checked={rvForm.featured} onChange={(e) => setRvForm({ ...rvForm, featured: e.target.checked })} />
                <span>Feature this story</span>
              </label>
              {rvErr && <p className="wf-auth-error" style={{ margin: 0 }}>{rvErr}</p>}
              <button type="submit" className="wf-form-submit wf-mag" disabled={rvBusy || rvUploading}>
                {rvBusy ? 'Adding…' : rvUploading ? 'Uploading…' : (<><PlusIcon /> Add review</>)}
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
                {coupons.map((c) => {
                  const scope = c.fieldId ? (allFieldOptions.find((p) => p.id === c.fieldId)?.title || 'a field') : 'All fields'
                  const usesStr = c.maxUses != null ? `${c.uses}/${c.maxUses} used` : `${c.uses} used`
                  const exp = c.expiresAt ? new Date(c.expiresAt) : null
                  const expired = exp && exp.getTime() <= Date.now()
                  return (
                    <div className="wf-admin-row" key={c.id}>
                      <span className="wf-admin-ico wf-card-ph-desire">%</span>
                      <div className="wf-admin-row-text">
                        <span className="wf-admin-row-title">
                          {c.code} {expired && <span className="wf-coupon-expired">expired</span>}
                        </span>
                        <span className="wf-admin-row-meta">
                          {c.type === 'percent' ? `${c.value}% off` : `$${c.value} off`} · {scope} · {usesStr}
                          {exp ? ` · until ${exp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                        </span>
                      </div>
                      <button className="wf-del" aria-label={`Delete ${c.code}`} onClick={() => removeCoupon(c.id)}>
                        <TrashIcon />
                      </button>
                    </div>
                  )
                })}
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
              <label className="wf-field">
                <span className="wf-field-label">Applies to</span>
                <select className="wf-select" value={cForm.fieldId} onChange={(e) => setCForm({ ...cForm, fieldId: e.target.value })}>
                  <option value="">All paid fields</option>
                  {paidProducts.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
                <span className="wf-field-hint">Choose one field, or apply to every paid field.</span>
              </label>
              <div className="wf-form-row">
                <label className="wf-field">
                  <span className="wf-field-label">Max uses (blank = unlimited)</span>
                  <input className="wf-input" type="number" min="1" value={cForm.maxUses} onChange={(e) => setCForm({ ...cForm, maxUses: e.target.value })} placeholder="e.g. 50" />
                </label>
                <label className="wf-field">
                  <span className="wf-field-label">Expires (blank = never)</span>
                  <input className="wf-input" type="date" value={cForm.expiresAt} onChange={(e) => setCForm({ ...cForm, expiresAt: e.target.value })} />
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
                  <div className="wf-thread-head">
                    <span className={`wf-conv-pill wf-conv-pill--${convStatus.replace(/\s+/g, '').toLowerCase()}`}>{convStatus}</span>
                  </div>
                  <div className="wf-thread" ref={threadRef}>
                    {thread.map((m, i) => {
                      if (m.kind === 'offer' && m.meta?.offerId) {
                        const o = offerById[m.meta.offerId]
                        return (
                          <div key={m.id || i} className="wf-msg-offer">
                            <span className="wf-mo-eyebrow">✦ Field sent</span>
                            <span className="wf-mo-name">{o?.name || m.text}</span>
                            <span className="wf-mo-foot">
                              <span className="wf-mo-amt">${o?.amount ?? ''}</span>
                              <span className={`wf-mo-status wf-mo-status--${o?.status || 'sent'}`}>{o?.status || 'sent'}</span>
                            </span>
                          </div>
                        )
                      }
                      if (m.kind === 'systemPaid') {
                        return (
                          <div key={m.id || i} className="wf-msg-sys">✓ {m.text}</div>
                        )
                      }
                      if (m.kind === 'delivery') {
                        return (
                          <div key={m.id || i} className="wf-msg-deliv">📦 {m.text}</div>
                        )
                      }
                      return (
                        <div key={m.id || i} className={`wf-msg wf-msg--${m.from}`}>
                          {m.from === 'admin' && <span className="wf-msg-who">You</span>}
                          {m.text}
                        </div>
                      )
                    })}
                  </div>

                  {/* offer-aware composer */}
                  {activeOffer?.status === 'sent' ? (
                    <div className="wf-offer-await">
                      <span className="wf-offer-await-dot" /> Awaiting payment · ${activeOffer.amount}
                      <span className="wf-offer-await-hint">Customer asked for something else? Send a new field below — it replaces this one.</span>
                    </div>
                  ) : activeOffer?.status === 'paid' ? (
                    <div className="wf-offer-deliver">
                      <div className="wf-offer-cleared">{activeFree ? '✓ Free field — ready to deliver' : '✓ Payment cleared — ready to deliver'}</div>
                      <label className="wf-field" style={{ marginTop: 10 }}>
                        <span className="wf-field-label">Field files {deliverFiles.length ? `· ${deliverFiles.length} selected` : '· you can pick more than one'}</span>
                        <input
                          className="wf-input wf-file"
                          type="file"
                          multiple
                          disabled={deliverBusy}
                          onChange={(e) => setDeliverFiles((prev) => {
                            const picked = Array.from(e.target.files || [])
                            const seen = new Set(prev.map((f) => f.name + f.size))
                            return [...prev, ...picked.filter((f) => !seen.has(f.name + f.size))]
                          })}
                        />
                      </label>
                      {deliverFiles.length > 0 && (
                        <div className="wf-deliver-files">
                          {deliverFiles.map((f, i) => (
                            <span className="wf-deliver-file" key={f.name + f.size}>
                              📄 {f.name}
                              {!deliverBusy && (
                                <button type="button" aria-label="Remove file" onClick={() => setDeliverFiles((prev) => prev.filter((_, j) => j !== i))}>✕</button>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                      <textarea className="wf-textarea" rows="2" value={deliverNote} onChange={(e) => setDeliverNote(e.target.value)} placeholder="Note to the customer (optional)…" disabled={deliverBusy} />
                      {deliverErr && <p className="wf-auth-error" style={{ margin: '4px 0 0' }}>{deliverErr}</p>}
                      {deliverBusy && (
                        <div className="wf-deliver-progress" role="status" aria-live="polite">
                          <div className="wf-deliver-bar">
                            <span style={{ width: `${deliverPct}%` }} className={deliverPct >= 100 ? 'done' : ''} />
                          </div>
                          <div className="wf-deliver-prog-row">
                            <span className="wf-deliver-spin" aria-hidden="true" />
                            <span>
                              {deliverPct >= 100
                                ? 'Finalizing on server…'
                                : `Uploading ${deliverFiles.length > 1 ? deliverFiles.length + ' files' : 'file'} · ${deliverPct}%`}
                              {' · '}{fmtElapsed(deliverElapsed)}
                            </span>
                          </div>
                          <span className="wf-deliver-hint">Large files can take several minutes — keep this tab open.</span>
                        </div>
                      )}
                      <button className="wf-form-submit wf-mag" style={{ marginTop: 8 }} disabled={deliverBusy} onClick={() => submitDelivery(activeOffer.id)}>
                        {deliverBusy ? `Delivering… ${deliverPct >= 100 ? '' : deliverPct + '%'}`.trim() : 'Deliver field →'}
                      </button>
                    </div>
                  ) : activeOffer?.status === 'delivered' && activeOffer.id === deliveredFlashId ? (
                    <div className="wf-offer-done wf-offer-done--flash">✓ Field delivered — order complete</div>
                  ) : null}

                  {/* create-field builder — hidden once an order is delivered & complete,
                      unless the customer has come back with a fresh request */}
                  {(!activeOffer || activeOffer.status === 'sent' || newRequestAfterDelivery) && (
                    showOfferBuilder ? (
                      <form className="wf-offer-builder" onSubmit={sendOffer}>
                        <div className="wf-eyebrow" style={{ marginBottom: 2 }}>
                          {activeOffer?.status === 'sent' ? '✦ Replace with a new field' : '✦ Create field'}
                        </div>
                        <input className="wf-input" value={offerForm.name} onChange={(e) => setOfferForm({ ...offerForm, name: e.target.value })} placeholder="Field name (e.g. Focus & productivity field)" />
                        <textarea className="wf-textarea" rows="2" value={offerForm.description} onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })} placeholder="Short description…" />
                        <div className="wf-form-row">
                          <input className="wf-input" value={offerForm.amount} onChange={(e) => setOfferForm({ ...offerForm, amount: e.target.value })} placeholder="$ amount (0 = free)" />
                          <input className="wf-input" value={offerForm.deliveryEstimate} onChange={(e) => setOfferForm({ ...offerForm, deliveryEstimate: e.target.value })} placeholder="Delivery time (e.g. 6–7 days)" />
                        </div>
                        {parseFloat(String(offerForm.amount).replace(/[^0-9.]/g, '')) === 0 && offerForm.amount !== '' && (
                          <p className="wf-offer-free-note">Free field — the customer pays nothing and you can deliver it right away.</p>
                        )}
                        <div className="wf-offer-inc-row">
                          <input className="wf-input" value={offerForm.includeInput} onChange={(e) => setOfferForm({ ...offerForm, includeInput: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInclude() } }} placeholder="Add an 'includes' point + Enter" />
                          <button type="button" className="wf-coupon-apply" onClick={addInclude}>Add</button>
                        </div>
                        {offerForm.includes.length > 0 && (
                          <div className="wf-offer-inc-chips">
                            {offerForm.includes.map((it, i) => (
                              <span key={i} className="wf-offer-inc-chip" onClick={() => setOfferForm((f) => ({ ...f, includes: f.includes.filter((_, j) => j !== i) }))}>
                                {it} ✕
                              </span>
                            ))}
                          </div>
                        )}
                        {offerErr && <p className="wf-auth-error" style={{ margin: '2px 0 0' }}>{offerErr}</p>}
                        <div className="wf-form-row" style={{ marginTop: 6 }}>
                          <button type="button" className="wf-back" onClick={() => setShowOfferBuilder(false)}>Cancel</button>
                          <button type="submit" className="wf-form-submit wf-mag" disabled={offerBusy}>
                            {offerBusy ? 'Sending…' : parseFloat(String(offerForm.amount).replace(/[^0-9.]/g, '')) === 0 && offerForm.amount !== '' ? 'Send free field →' : 'Send field →'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button className="wf-offer-create-btn" onClick={() => setShowOfferBuilder(true)}>
                        {activeOffer?.status === 'sent' ? '✦ Send a different field' : '✦ Create field'}
                      </button>
                    )
                  )}

                  <form className="wf-chat-input" onSubmit={sendReply} style={{ marginTop: 10 }}>
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
