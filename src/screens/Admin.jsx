import { useCallback, useEffect, useRef, useState } from 'react'
import Background from '../components/Background'
import { useStore } from '../store/StoreProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'
import MethodEditor from '../components/MethodEditor'
import AudioBundleEditor from '../components/AudioBundleEditor'
import { normalizeMethod, defaultMethod } from '../components/methodShared'
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
    uploadAudios,
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
    listPeople,
    loadPerson,
    updateRequest,
    rejectRequest,
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
  const [form, setForm] = useState({ title: '', category: 'DESIRE', price: '', desc: '', benefits: [], method: defaultMethod('') })
  const [file, setFile] = useState(null)
  const [audioFiles, setAudioFiles] = useState([]) // new field: bundle of audio files
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileInputRef = useRef(null)

  // per-field edit panel
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', category: '', price: '', desc: '', benefits: [], method: null, isFree: false })
  // version chooser + editor (paid fields): pencil shows Main/version choices once
  // a field has versions; the editor persists each version to the field
  const [verPickId, setVerPickId] = useState(null)
  const [verEdit, setVerEdit] = useState(null) // { fieldId, isFree, id|null, name, price, tagline, audios, method }
  const [verAudioFiles, setVerAudioFiles] = useState([]) // new files to add to this version
  const [verBusy, setVerBusy] = useState(false)
  const [verErr, setVerErr] = useState('')
  const [editImg, setEditImg] = useState(null)
  const [editAudioFiles, setEditAudioFiles] = useState([]) // new files to add when editing
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

  // support — per-person inbox
  const [people, setPeople] = useState([])
  const [selectedPerson, setSelectedPerson] = useState(null) // bucket key (email or anon:<cid>)
  const [personDetail, setPersonDetail] = useState(null)
  const [activeTab, setActiveTab] = useState('conversation') // 'conversation' | offerId
  const [activeConv, setActiveConv] = useState(null) // reply/offer target = the person's most-recent conversation
  const [thread, setThread] = useState([]) // union of the person's messages
  const [convOffers, setConvOffers] = useState([]) // the person's offers (= custom-code requests)
  const [reply, setReply] = useState('')
  // request-workspace draft (the open request tab)
  const [reqDraft, setReqDraft] = useState({ focus: '', budget: '', lengthEstimate: '', internalNote: '' })
  const [reqDraftFor, setReqDraftFor] = useState(null)
  const [reqBusy, setReqBusy] = useState(false)
  const [reqErr, setReqErr] = useState('')
  const [reqFlash, setReqFlash] = useState(false)
  // which people the admin has already seen (last-read time per person key) — for
  // the NEW/unread dot. Persisted so it survives reloads.
  const [readMap, setReadMap] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wf_admin_read') || '{}') } catch { return {} }
  })
  const markRead = useCallback((key, at) => {
    if (!key || !at) return
    setReadMap((prev) => {
      if (String(prev[key] || '') >= String(at)) return prev
      const next = { ...prev, [key]: at }
      try { localStorage.setItem('wf_admin_read', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  // inline responder for a custom-code request block (amount + description → offer)
  const [respondTo, setRespondTo] = useState(null) // the request message id being answered
  const [respondAmount, setRespondAmount] = useState('')
  const [respondDesc, setRespondDesc] = useState('')
  const [respondBusy, setRespondBusy] = useState(false)
  const [respondErr, setRespondErr] = useState('')
  // delivery composer
  const [deliverFiles, setDeliverFiles] = useState([])
  const [deliverNote, setDeliverNote] = useState('')
  const [deliverBusy, setDeliverBusy] = useState(false)
  const [deliverErr, setDeliverErr] = useState('')
  const [deliverPct, setDeliverPct] = useState(0)
  const [deliverElapsed, setDeliverElapsed] = useState(0)
  const paidSeen = useRef(new Set())
  const threadRef = useRef(null)

  // load the people list (left column); poll while on the support tab
  useEffect(() => {
    if (!isAdmin) return
    let t
    const load = async () => setPeople(await listPeople())
    load()
    if (adminTab === 'support') t = setInterval(load, 8000)
    return () => t && clearInterval(t)
  }, [isAdmin, adminTab, listPeople])

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

  // load + poll the selected person's detail (union of messages + their offers)
  useEffect(() => {
    if (!selectedPerson) return
    let t
    let cancelled = false
    const load = async () => {
      const p = await loadPerson(selectedPerson)
      if (cancelled || !p) return
      setPersonDetail(p)
      setThread(p.messages || [])
      const offers = p.offers || []
      setConvOffers(offers)
      // reply / new-offer target = the conversation of the most recent message
      const lastMsg = p.messages && p.messages.length ? p.messages[p.messages.length - 1] : null
      setActiveConv(lastMsg?.conversationId || p.conversationIds?.[0] || null)
      // opening a person marks it read (clears the NEW dot)
      if (lastMsg) markRead(selectedPerson, lastMsg.at)
      // payment-landed toast (once per offer, skipping the first load for this person)
      offers.forEach((o) => {
        if ((o.status === 'paid' || o.status === 'delivered') && !paidSeen.current.has(o.id)) {
          if (paidSeen.current.has('__init_' + selectedPerson)) {
            showToast(`Payment received · $${o.amount}${o.customerEmail ? ' from ' + o.customerEmail : ''}`)
          }
          paidSeen.current.add(o.id)
        }
      })
      paidSeen.current.add('__init_' + selectedPerson)
    }
    load()
    t = setInterval(load, 4000)
    return () => { cancelled = true; clearInterval(t) }
  }, [selectedPerson, loadPerson, showToast, markRead])

  // when the open request tab changes, load its draft (focus / budget / length /
  // internal note) once — don't clobber admin edits on every 4s poll.
  useEffect(() => {
    if (activeTab === 'conversation') return
    if (reqDraftFor === activeTab) return
    const o = convOffers.find((x) => String(x.id) === String(activeTab))
    if (!o) return
    setReqDraft({ focus: o.focus || '', budget: o.budget || '', lengthEstimate: o.lengthEstimate || '', internalNote: o.internalNote || '' })
    setReqDraftFor(activeTab)
    setReqErr('')
    setReqFlash(false)
    // reset the deliver composer when moving between request tabs
    setDeliverFiles([])
    setDeliverNote('')
    setDeliverErr('')
  }, [activeTab, convOffers, reqDraftFor])

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
  // lookups for rendering thread cards
  const offerById = Object.fromEntries(convOffers.map((o) => [o.id, o]))
  // offer answering a given request message (prefer the live, non-cancelled one)
  const offerByRequest = {}
  for (const o of convOffers) {
    if (o.requestMessageId == null) continue
    const k = String(o.requestMessageId)
    const cur = offerByRequest[k]
    if (!cur || cur.status === 'cancelled' || o.status !== 'cancelled') offerByRequest[k] = o
  }
  const activeOffer = [...convOffers].reverse().find((o) => o.status !== 'cancelled') || null
  const activeFree = activeOffer && Number(activeOffer.amount) === 0
  const convStatus =
    !activeOffer ? 'New request'
      : activeOffer.status === 'sent' ? 'Awaiting payment'
      : activeOffer.status === 'paid' ? (activeFree ? 'Free' : 'Paid')
      : activeOffer.status === 'delivered' ? 'Delivered'
      : 'New request'

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
    // upload the audio bundle first (free fields → free bucket)
    let audios = []
    if (audioFiles.length) {
      const up = await uploadAudios(audioFiles, priceNum === 0)
      if (up?.error) { setBusy(false); return setErr(up.error) }
      audios = up.audios
    }
    // price 0 → goes to the separate free_fields table; otherwise to products
    const res =
      priceNum === 0
        ? await addFreeField(
            { title: form.title.trim(), line: form.category.toLowerCase(), description: form.desc.trim() || 'A free Waslerr field.', benefits: form.benefits, method: form.method, audios },
            file,
            null,
          )
        : await addProduct(
            {
              title: form.title.trim(),
              line: form.category.toLowerCase(),
              price: priceNum,
              description: form.desc.trim() || 'A new Waslerr field.',
              benefits: form.benefits,
              method: form.method,
              audios,
            },
            file,
            null,
          )
    setBusy(false)
    if (res?.error) {
      setErr(res.error)
      return
    }
    setForm({ title: '', category: 'DESIRE', price: '', desc: '', benefits: [], method: defaultMethod('') })
    setFile(null)
    setAudioFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // open/save the per-field edit panel
  const openEdit = (p, isFree) => {
    setEditErr('')
    setEditImg(null)
    setEditAudioFiles([])
    setEditId(p.id)
    setEditForm({
      title: p.title || '',
      category: (p.line || 'desire').toUpperCase(),
      price: isFree ? '' : String(p.priceNum ?? ''),
      desc: p.desc || '',
      benefits: Array.isArray(p.benefits) ? p.benefits : [],
      method: normalizeMethod(p.method, p.title),
      audios: Array.isArray(p.audios) ? p.audios : [], // existing bundle (with paths)
      isFree,
    })
  }
  const saveEdit = async () => {
    setEditErr('')
    if (!editForm.title.trim()) return setEditErr('Title is required.')
    setEditBusy(true)
    // upload any newly-added files, then keep them alongside the existing bundle
    let audios = editForm.audios || []
    if (editAudioFiles.length) {
      const up = await uploadAudios(editAudioFiles, editForm.isFree)
      if (up?.error) { setEditBusy(false); return setEditErr(up.error) }
      audios = [...audios, ...up.audios]
    }
    const patch = { title: editForm.title.trim(), line: editForm.category.toLowerCase(), description: editForm.desc, benefits: editForm.benefits, method: editForm.method, audios }
    if (!editForm.isFree) patch.price = parseFloat(String(editForm.price).replace(/[^0-9.]/g, '')) || 0
    const res = await updateProduct(editId, editForm.isFree, patch, editImg, null)
    setEditBusy(false)
    if (res?.error) return setEditErr(res.error)
    setEditId(null)
  }

  // ---- per-field versions (paid): chooser + editor ----
  const onEditClick = (p, isFree) => {
    setVerEdit(null)
    const vers = Array.isArray(p.versions) ? p.versions : []
    if (!isFree && vers.length > 0) {
      setEditId(null)
      setVerPickId((cur) => (cur === p.id ? null : p.id))
    } else {
      setVerPickId(null)
      openEdit(p, isFree)
    }
  }
  const startVersionEdit = (p, isFree, version) => {
    setVerPickId(null)
    setEditId(null)
    setVerAudioFiles([])
    setVerErr('')
    const vers = Array.isArray(p.versions) ? p.versions : []
    // existing version bundle: prefer `audios`, else lift the legacy single `audio`
    const audios = Array.isArray(version?.audios) && version.audios.length
      ? version.audios
      : (version?.audio ? [{ path: version.audio, name: 'Audio', size: 0 }] : [])
    setVerEdit({
      fieldId: p.id,
      isFree,
      id: version?.id ?? null,
      name: version?.name ?? 'New version',
      price: version?.price ?? (vers[vers.length - 1]?.price ?? p.priceNum ?? 0) + 33,
      tagline: version?.tagline ?? '',
      audios,
      method: normalizeMethod(version?.method, version?.name ?? p.title),
    })
  }
  const fieldVersions = (id) => {
    const f = [...paidProducts, ...freeFields].find((x) => x.id === id)
    return Array.isArray(f?.versions) ? f.versions : []
  }
  const saveVersion = async () => {
    setVerErr('')
    if (!verEdit.name.trim()) return setVerErr('Version name is required.')
    setVerBusy(true)
    try {
      // keep existing files + upload any newly-added ones
      let audios = verEdit.audios || []
      if (verAudioFiles.length) {
        const up = await uploadAudios(verAudioFiles, verEdit.isFree)
        if (up?.error) return setVerErr(up.error)
        audios = [...audios, ...up.audios]
      }
      let versions = [...fieldVersions(verEdit.fieldId)]
      const row = { name: verEdit.name.trim(), price: Math.max(0, Number(verEdit.price) || 0), tagline: verEdit.tagline, audios, audio: audios[0]?.path || '', method: verEdit.method }
      if (verEdit.id == null) {
        const id = versions.reduce((m, v) => Math.max(m, Number(v.id) || 0), 0) + 1
        versions.push({ id, ...row })
      } else {
        versions = versions.map((v) => (v.id === verEdit.id ? { ...v, ...row } : v))
      }
      const res = await updateProduct(verEdit.fieldId, verEdit.isFree, { versions })
      if (res?.error) return setVerErr(res.error)
      setVerEdit(null)
    } catch (e) {
      setVerErr(`Couldn’t save${e?.message ? ': ' + e.message : '. Please try again.'}`)
    } finally {
      setVerBusy(false)
    }
  }
  const deleteVersion = async () => {
    setVerErr('')
    setVerBusy(true)
    try {
      const versions = fieldVersions(verEdit.fieldId).filter((v) => v.id !== verEdit.id)
      const res = await updateProduct(verEdit.fieldId, verEdit.isFree, { versions })
      if (res?.error) return setVerErr(res.error)
      setVerEdit(null)
    } catch (e) {
      setVerErr(`Couldn’t delete${e?.message ? ': ' + e.message : '. Please try again.'}`)
    } finally {
      setVerBusy(false)
    }
  }
  const renderVersionChooser = (p, isFree) => (
    <div className="wf-ver-chooser" key={p.id + '-vpick'}>
      <div className="wf-field-label" style={{ marginBottom: 10 }}>What do you want to edit?</div>
      <div className="wf-ver-choices">
        <button type="button" className="wf-ver-choice" onClick={() => { setVerPickId(null); openEdit(p, isFree) }}>Main field</button>
        {(p.versions || []).map((v) => (
          <button type="button" className="wf-ver-choice" key={v.id} onClick={() => startVersionEdit(p, isFree, v)}>
            {v.name || 'Untitled'}
          </button>
        ))}
        <button type="button" className="wf-ver-choice add" onClick={() => startVersionEdit(p, isFree, null)}>+ Add version</button>
      </div>
    </div>
  )
  const renderVersionEditor = () => (
    <div className="wf-field-edit" key={verEdit.fieldId + '-veredit'}>
      <div className="wf-eyebrow" style={{ marginBottom: 2 }}>{verEdit.id == null ? 'New version' : 'Edit version'}</div>
      <label className="wf-field">
        <span className="wf-field-label">Version name</span>
        <input className="wf-input" value={verEdit.name} onChange={(e) => setVerEdit({ ...verEdit, name: e.target.value })} />
      </label>
      <div className="wf-form-row">
        <label className="wf-field">
          <span className="wf-field-label">Price ($)</span>
          <input className="wf-input" type="number" min="0" value={verEdit.price} onChange={(e) => setVerEdit({ ...verEdit, price: Math.max(0, Number(e.target.value) || 0) })} />
        </label>
        <label className="wf-field">
          <span className="wf-field-label">Tagline</span>
          <input className="wf-input" value={verEdit.tagline} onChange={(e) => setVerEdit({ ...verEdit, tagline: e.target.value })} />
        </label>
      </div>
      <AudioBundleEditor
        label="Version audio"
        hint="buyers of this version get all of these"
        existing={verEdit.audios}
        setExisting={(a) => setVerEdit({ ...verEdit, audios: a })}
        pending={verAudioFiles}
        setPending={setVerAudioFiles}
      />
      <MethodEditor value={verEdit.method} onChange={(m) => setVerEdit({ ...verEdit, method: m })} />
      {verErr && <p className="wf-auth-error" style={{ margin: 0 }}>{verErr}</p>}
      <div className="wf-form-row" style={{ marginTop: 4, justifyContent: 'space-between' }}>
        <button type="button" className="wf-back" onClick={() => setVerEdit(null)}>Cancel</button>
        <span style={{ display: 'flex', gap: 12 }}>
          {verEdit.id != null && (
            <button type="button" className="wf-del" onClick={deleteVersion} disabled={verBusy} aria-label="Delete version">
              <TrashIcon />
            </button>
          )}
          <button type="button" className="wf-form-submit wf-mag" onClick={saveVersion} disabled={verBusy}>{verBusy ? (verAudioFiles.length ? 'Uploading audio…' : 'Saving…') : 'Save version'}</button>
        </span>
      </div>
    </div>
  )
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
      {editForm.method && (
        <MethodEditor value={editForm.method} onChange={(m) => setEditForm((f) => ({ ...f, method: m }))} />
      )}
      <label className="wf-field">
        <span className="wf-field-label">
          Image {editImg ? `· new: ${editImg.name}` : p.image_url ? '· set ✓ (choose to replace)' : '· none yet'}
        </span>
        {!editImg && p.image_url && <img src={p.image_url} alt="" className="wf-edit-thumb" />}
        <input className="wf-input wf-file" type="file" accept="image/*" onChange={(e) => setEditImg(e.target.files?.[0] || null)} />
      </label>
      <AudioBundleEditor
        label="Audio files"
        hint="buyer gets all of these"
        existing={editForm.audios}
        setExisting={(a) => setEditForm((f) => ({ ...f, audios: a }))}
        pending={editAudioFiles}
        setPending={setEditAudioFiles}
      />
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

  // ---- custom-code requests: a ✦ CUSTOM CODE REQUEST chat message ----
  const isCustomReq = (m) => m.from === 'user' && /^✦\s*CUSTOM CODE REQUEST/i.test(String(m.text || '').trim())
  // pull { focus, intention } out of the request body
  const parseReq = (text) => {
    const body = String(text || '').replace(/^✦\s*CUSTOM CODE REQUEST\s*/i, '')
    const lines = body.split('\n')
    let focus = ''
    const rest = []
    for (const ln of lines) {
      const fm = ln.match(/^\s*Focus:\s*(.*)$/i)
      if (fm && !focus) focus = fm[1].trim()
      else rest.push(ln)
    }
    if (!focus) return { focus: (lines[0] || '').trim(), intention: lines.slice(1).join('\n').trim() }
    return { focus, intention: rest.join('\n').trim() }
  }
  const openResponder = (m) => {
    setRespondTo(m.id)
    setRespondAmount('')
    setRespondDesc('')
    setRespondErr('')
  }
  // answer a request block inline → create the offer the customer pays for
  const sendRequestOffer = async (m) => {
    setRespondErr('')
    if (!activeConv) return setRespondErr('No conversation selected.')
    const amount = parseFloat(String(respondAmount).replace(/[^0-9.]/g, '')) || 0
    if (amount < 0) return setRespondErr('Amount can’t be negative.') // 0 = free gift
    const { focus, intention } = parseReq(m.text)
    setRespondBusy(true)
    const res = await createOffer(activeConv, {
      name: focus || 'Custom field',
      description: respondDesc.trim(),
      amount,
      currency: 'USD',
      deliveryEstimate: '6–7 days',
      requestMessageId: m.id,
      focus,
      intention,
    })
    setRespondBusy(false)
    if (res?.error) return setRespondErr(res.error)
    // the server supersedes only a prior unpaid offer for THIS request
    setConvOffers((prev) => [
      ...prev.map((o) => (String(o.requestMessageId || '') === String(m.id) && o.status === 'sent' ? { ...o, status: 'cancelled' } : o)),
      res.offer,
    ])
    setRespondTo(null)
    // open this request's workspace tab (delivery happens there after payment)
    if (res.offer?.id != null) { setActiveTab(String(res.offer.id)); setReqDraftFor(null) }
    showToast(amount === 0 ? 'Free field sent — open its workspace to deliver' : 'Offer sent — awaiting payment')
  }
  // reject (or re-open) a custom-code request
  const toggleReject = async (m, rejected) => {
    if (rejected && !window.confirm('Reject this request? You can undo it afterwards.')) return
    if (respondTo === m.id) setRespondTo(null)
    // optimistic: flag the request message + cancel a still-unpaid linked offer
    const cancelledOffer = rejected
      ? convOffers.find((o) => String(o.requestMessageId || '') === String(m.id) && o.status === 'sent')
      : null
    setThread((prev) => prev.map((x) => (x.id === m.id ? { ...x, meta: { ...(x.meta || {}), rejected } } : x)))
    if (cancelledOffer) {
      setConvOffers((prev) => prev.map((o) => (o.id === cancelledOffer.id ? { ...o, status: 'cancelled' } : o)))
    }
    const res = await rejectRequest(m.id, rejected)
    if (res?.error) {
      // revert exactly what we optimistically changed
      setThread((prev) => prev.map((x) => (x.id === m.id ? { ...x, meta: { ...(x.meta || {}), rejected: !rejected } } : x)))
      if (cancelledOffer) setConvOffers((prev) => prev.map((o) => (o.id === cancelledOffer.id ? { ...o, status: 'sent' } : o)))
      return showToast(res.error)
    }
    showToast(rejected ? 'Request declined' : 'Request re-opened')
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
  }
  const fmtElapsed = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  // ---- per-person inbox helpers ----
  const selectPerson = (key) => {
    setSelectedPerson(key)
    setActiveTab('conversation')
    setReqDraftFor(null)
    setShowOfferBuilder(false)
    setDeliverFiles([])
    setDeliverNote('')
    setDeliverErr('')
  }
  // production pipeline stage of an offer (delivered file always wins)
  const stageOf = (o) => (o && o.status === 'delivered' ? 'delivered' : (o?.productionStatus || 'requested'))
  // click a stage in the pipeline → advance/rewind production status
  const setStage = async (offerId, stage) => {
    setConvOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, productionStatus: stage } : o)))
    const res = await updateRequest(offerId, { productionStatus: stage })
    if (res?.error) return showToast(res.error)
    setConvOffers((prev) => prev.map((o) => (o.id === offerId ? res.offer : o)))
  }
  // save the editable workspace fields (focus / budget / length / internal note)
  const saveRequest = async (offerId) => {
    setReqErr('')
    setReqBusy(true)
    const res = await updateRequest(offerId, {
      focus: reqDraft.focus,
      budget: reqDraft.budget,
      lengthEstimate: reqDraft.lengthEstimate,
      internalNote: reqDraft.internalNote,
    })
    setReqBusy(false)
    if (res?.error) return setReqErr(res.error)
    setConvOffers((prev) => prev.map((o) => (o.id === offerId ? res.offer : o)))
    setReqFlash(true)
    setTimeout(() => setReqFlash(false), 2500)
    showToast('Request saved')
  }
  // pull the customer's original ✦ CUSTOM CODE REQUEST text from the thread (spec fallback)
  const requestSpecFromThread = () => {
    const m = [...thread].reverse().find((x) => x.from === 'user' && /^✦\s*CUSTOM CODE REQUEST/i.test((x.text || '').trim()))
    if (!m) return ''
    return (m.text || '').replace(/^✦\s*CUSTOM CODE REQUEST\s*/i, '').trim()
  }

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

  const removePerson = async (person) => {
    if (!window.confirm('Delete this person’s conversation(s)? This clears their messages permanently. Delivered fields stay accessible.')) return
    for (const cid of person.conversationIds || []) await deleteConversation(cid)
    setPeople((prev) => prev.filter((p) => p.key !== person.key))
    if (selectedPerson === person.key) {
      setSelectedPerson(null)
      setPersonDetail(null)
      setThread([])
      setConvOffers([])
      setActiveConv(null)
    }
  }
  const fmtDate = (s) => {
    if (!s) return '—'
    const d = new Date(s)
    return isNaN(d) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // a ✦ CUSTOM CODE REQUEST message, rendered as an actionable card: price it +
  // send the offer inline, then watch its status (awaiting payment → paid →
  // delivered) right here. Delivery itself happens in the request's workspace tab.
  const renderRequestCard = (m) => {
    const { focus, intention } = parseReq(m.text)
    const linked = offerByRequest[String(m.id)]
    // a cancelled offer (superseded, or cancelled by a reject that was undone) is
    // treated as "no live offer" so the card offers to respond again
    const offer = linked && linked.status !== 'cancelled' ? linked : null
    const responding = respondTo === m.id
    const rejected = !!(m.meta && m.meta.rejected)
    const freeNow = parseFloat(String(respondAmount).replace(/[^0-9.]/g, '')) === 0 && respondAmount !== ''
    const delivered = offer ? stageOf(offer) === 'delivered' : false
    return (
      <div key={m.id} className={`wf-reqcard${rejected ? ' wf-reqcard--rejected' : ''}`}>
        <span className="wf-reqcard-eyebrow">✦ Custom code request</span>
        <span className="wf-reqcard-focus">{focus || 'Custom field'}</span>
        {intention && <p className="wf-reqcard-intent">{intention}</p>}

        {rejected ? (
          <div className="wf-reqcard-status">
            <span className="wf-reqcard-badge wf-reqcard-badge--rejected">Declined</span>
            <button type="button" className="wf-reqcard-change" onClick={() => toggleReject(m, false)}>Undo</button>
          </div>
        ) : (
          <>
            {!offer && !responding && (
              <div className="wf-reqcard-actions">
                <button type="button" className="wf-reqcard-respond" onClick={() => openResponder(m)}>
                  Respond with an offer →
                </button>
                <button type="button" className="wf-reqcard-reject" onClick={() => toggleReject(m, true)}>Reject</button>
              </div>
            )}

            {responding && (
              <div className="wf-reqcard-form">
                <input className="wf-input" value={respondAmount} onChange={(e) => setRespondAmount(e.target.value)} placeholder="$ amount (0 = free)" autoFocus />
                <textarea className="wf-textarea" rows="2" value={respondDesc} onChange={(e) => setRespondDesc(e.target.value)} placeholder="Short note for the customer (optional)…" />
                {freeNow && <p className="wf-offer-free-note">Free field — the customer pays nothing; deliver it right away from the workspace tab.</p>}
                {respondErr && <p className="wf-auth-error" style={{ margin: '2px 0 0' }}>{respondErr}</p>}
                <div className="wf-form-row" style={{ marginTop: 4 }}>
                  <button type="button" className="wf-back" onClick={() => setRespondTo(null)}>Cancel</button>
                  <button type="button" className="wf-form-submit wf-mag" disabled={respondBusy} onClick={() => sendRequestOffer(m)}>
                    {respondBusy ? 'Sending…' : freeNow ? 'Send free field →' : 'Send offer →'}
                  </button>
                </div>
              </div>
            )}

            {offer && !responding && (
              <div className="wf-reqcard-status">
                <span className="wf-reqcard-amt">{Number(offer.amount) === 0 ? 'Free' : `$${offer.amount}`}</span>
                <span className={`wf-reqcard-badge wf-reqcard-badge--${delivered ? 'delivered' : offer.status}`}>
                  {delivered ? 'Delivered ✓' : offer.status === 'paid' ? 'Paid ✓' : offer.status === 'sent' ? 'Awaiting payment' : offer.status}
                </span>
                {!delivered && (
                  <button type="button" className="wf-reqcard-link" onClick={() => { setActiveTab(String(offer.id)); setReqDraftFor(null) }}>
                    {offer.status === 'paid' ? 'Deliver →' : 'Open workspace →'}
                  </button>
                )}
                {offer.status === 'sent' && (
                  <>
                    <button type="button" className="wf-reqcard-change" onClick={() => openResponder(m)}>Change offer</button>
                    <button type="button" className="wf-reqcard-reject" onClick={() => toggleReject(m, true)}>Reject</button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // the chat thread + reply box (the "Conversation" tab). Offers are created by
  // answering a request card above — there is no separate "create field" form.
  const renderConversation = () => (
    <>
      <div className="wf-thread-head">
        <span className={`wf-conv-pill wf-conv-pill--${convStatus.replace(/\s+/g, '').toLowerCase()}`}>{convStatus}</span>
      </div>
      <div className="wf-thread" ref={threadRef}>
        {thread.length === 0 && <p className="wf-detail-desc" style={{ margin: 0 }}>No messages yet.</p>}
        {thread.map((m, i) => {
          // the customer's custom-code request → actionable card
          if (isCustomReq(m)) return renderRequestCard(m)
          // the offer card is folded into its request card — don't double-render it
          if (m.kind === 'offer' && m.meta?.offerId) {
            const o = offerById[m.meta.offerId]
            if (o?.requestMessageId) return null
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
          if (m.kind === 'systemPaid') return <div key={m.id || i} className="wf-msg-sys">✓ {m.text}</div>
          if (m.kind === 'delivery') return <div key={m.id || i} className="wf-msg-deliv">📦 {m.text}</div>
          return (
            <div key={m.id || i} className={`wf-msg wf-msg--${m.from}`}>
              {m.from === 'admin' && <span className="wf-msg-who">You</span>}
              {m.text}
            </div>
          )
        })}
      </div>

      <form className="wf-chat-input" onSubmit={sendReply} style={{ marginTop: 10 }}>
        <input className="wf-input" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply as Waslerr admin…" />
        <button className="wf-chat-send" type="submit" aria-label="Send reply">
          <SendIcon />
        </button>
      </form>
    </>
  )

  // the deliverable block inside a request workspace — gated by payment status
  const renderDeliverComposer = (offer) => {
    if (!offer) return null
    if (offer.status === 'delivered') {
      return (
        <div className="wf-rw-delivered">
          <span className="wf-rw-delivered-tag">✓ Delivered to the customer</span>
          <div className="wf-deliver-files">
            {(offer.deliveryFiles || []).map((f, i) => (
              <span key={i} className="wf-deliver-file"><a href={`/api/offers/${offer.id}/download?conversationId=${encodeURIComponent(offer.conversationId)}&i=${i}`} target="_blank" rel="noreferrer">📄 {f.name}</a></span>
            ))}
          </div>
          {offer.deliveryNote && <p className="wf-rw-delivered-note">“{offer.deliveryNote}”</p>}
        </div>
      )
    }
    if (offer.status === 'sent') {
      return (
        <div className="wf-rw-await">
          <span className="wf-offer-await-dot" /> Awaiting payment · ${offer.amount} — the file can be delivered once the customer pays.
        </div>
      )
    }
    // paid / free → upload + deliver
    return (
      <div className="wf-rw-drop">
        <label className="wf-field">
          <span className="wf-field-label">Field files {deliverFiles.length ? `· ${deliverFiles.length} selected` : '· choose one or more'}</span>
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
                {!deliverBusy && <button type="button" aria-label="Remove file" onClick={() => setDeliverFiles((prev) => prev.filter((_, j) => j !== i))}>✕</button>}
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
                {deliverPct >= 100 ? 'Finalizing on server…' : `Uploading ${deliverFiles.length > 1 ? deliverFiles.length + ' files' : 'file'} · ${deliverPct}%`}
                {' · '}{fmtElapsed(deliverElapsed)}
              </span>
            </div>
            <span className="wf-deliver-hint">Large files can take several minutes — keep this tab open.</span>
          </div>
        )}
        <button className="wf-form-submit wf-mag" style={{ marginTop: 8 }} disabled={deliverBusy} onClick={() => submitDelivery(offer.id)}>
          {deliverBusy ? `Delivering… ${deliverPct >= 100 ? '' : deliverPct + '%'}`.trim() : 'Deliver field →'}
        </button>
      </div>
    )
  }

  // a single custom-code request as a production workspace (one tab per offer)
  const RW_STAGES = [['requested', 'Requested'], ['production', 'In production'], ['review', 'Review'], ['delivered', 'Delivered']]
  const renderRequest = (offer) => {
    if (!offer) return <p className="wf-detail-desc" style={{ margin: 0 }}>This request is no longer available.</p>
    const stage = stageOf(offer)
    const curIdx = RW_STAGES.findIndex((s) => s[0] === stage)
    const spec = offer.intention || requestSpecFromThread() || offer.description || ''
    return (
      <div className="wf-rw">
        <span className="wf-rw-badge">✦ Custom code request</span>
        <input
          className="wf-rw-focus"
          value={reqDraft.focus}
          onChange={(e) => setReqDraft((d) => ({ ...d, focus: e.target.value }))}
          placeholder={offer.name || 'Focus / intention…'}
        />

        <div className="wf-rw-meta">
          <div className="wf-rw-meta-cell">
            <span className="wf-rw-meta-k">Requested</span>
            <span className="wf-rw-meta-v">{fmtDate(offer.requestedAt || offer.createdAt)}</span>
          </div>
          <div className="wf-rw-meta-cell">
            <span className="wf-rw-meta-k">Budget</span>
            <input className="wf-rw-meta-in" value={reqDraft.budget} onChange={(e) => setReqDraft((d) => ({ ...d, budget: e.target.value }))} placeholder={Number(offer.amount) ? `$${offer.amount}` : '—'} />
          </div>
          <div className="wf-rw-meta-cell">
            <span className="wf-rw-meta-k">Length</span>
            <input className="wf-rw-meta-in" value={reqDraft.lengthEstimate} onChange={(e) => setReqDraft((d) => ({ ...d, lengthEstimate: e.target.value }))} placeholder="e.g. 20 min" />
          </div>
        </div>

        <div className="wf-rw-pipe" role="tablist" aria-label="Production status">
          {RW_STAGES.map(([key, label], i) => (
            <button
              key={key}
              type="button"
              className={`wf-rw-stage${i <= curIdx ? ' done' : ''}${key === stage ? ' active' : ''}`}
              onClick={() => setStage(offer.id, key)}
            >
              <span className="wf-rw-stage-dot" />
              <span className="wf-rw-stage-label">{label}</span>
            </button>
          ))}
        </div>

        <div className="wf-rw-section">
          <div className="wf-rw-section-k">Specification</div>
          <div className="wf-rw-spec">
            {spec ? spec : <span className="wf-rw-empty">No spec captured yet — the customer’s original request shows here.</span>}
          </div>
        </div>

        <div className="wf-rw-section">
          <div className="wf-rw-section-k">Deliverable</div>
          {renderDeliverComposer(offer)}
        </div>

        <div className="wf-rw-section">
          <div className="wf-rw-section-k">Internal note <span className="wf-rw-admin-only">admin only</span></div>
          <textarea
            className="wf-textarea"
            rows="3"
            value={reqDraft.internalNote}
            onChange={(e) => setReqDraft((d) => ({ ...d, internalNote: e.target.value }))}
            placeholder="Private notes — never shown to the customer…"
          />
        </div>

        {reqErr && <p className="wf-auth-error" style={{ margin: '2px 0 0' }}>{reqErr}</p>}
        <div className="wf-rw-foot">
          <button type="button" className="wf-back" onClick={() => saveRequest(offer.id)} disabled={reqBusy}>
            {reqBusy ? 'Saving…' : reqFlash ? 'Saved ✓' : 'Save changes'}
          </button>
          <button type="button" className="wf-form-submit wf-mag" onClick={() => setStage(offer.id, 'delivered')} disabled={stage === 'delivered'}>
            Mark as delivered
          </button>
        </div>
      </div>
    )
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
                      <span
                        className={`wf-admin-ico ${phClass(p.line)}`}
                        style={p.image_url ? { backgroundImage: `url(${p.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                      >{p.image_url ? '' : 'W'}</span>
                      <div className="wf-admin-row-text">
                        <span className="wf-admin-row-title">
                          {p.title} {p.hasAudio && <span className="wf-audio-tag">♪ audio</span>}
                        </span>
                        <span className="wf-admin-row-meta">
                          {CAT_LABEL[p.line] || (p.line ? p.line[0].toUpperCase() + p.line.slice(1) : 'Desire')} · {p.price || '—'}
                        </span>
                      </div>
                      <SoldEditor item={p} isFree={false} soldEdits={soldEdits} setSoldEdits={setSoldEdits} saveSold={saveSold} />
                      <button className="wf-ver-add" aria-label={`Add version to ${p.title}`} onClick={() => startVersionEdit(p, false, null)}>+ Version</button>
                      <button className="wf-edit-btn" aria-label={`Edit ${p.title}`} onClick={() => onEditClick(p, false)}>✎</button>
                      <button className="wf-del" aria-label={`Delete ${p.title}`} onClick={() => deleteProduct(p.id)}>
                        <TrashIcon />
                      </button>
                    </div>
                    {verPickId === p.id && renderVersionChooser(p, false)}
                    {verEdit?.fieldId === p.id && renderVersionEditor()}
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
                      <span
                        className={`wf-admin-ico ${phClass(p.line)}`}
                        style={p.image_url ? { backgroundImage: `url(${p.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                      >{p.image_url ? '' : 'W'}</span>
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
              <MethodEditor value={form.method} onChange={(m) => setForm((f) => ({ ...f, method: m }))} />
              <label className="wf-field">
                <span className="wf-field-label">Artwork image {file ? `· ${file.name}` : '(optional)'}</span>
                <input ref={fileInputRef} className="wf-input wf-file" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
              <AudioBundleEditor
                label="Audio files (the product — gated)"
                hint="add as many as you like; buyer gets all"
                pending={audioFiles}
                setPending={setAudioFiles}
              />
              <span className="wf-field-hint">Paid fields: only unlocked after the customer pays. Free fields: open to all.</span>
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
          <div className="wf-support-grid wf-inbox" data-reveal>
            <div className="wf-convo-list">
              <div className="wf-field-label" style={{ marginBottom: 12 }}>
                People · {people.length}
              </div>
              {people.length === 0 && <p className="wf-detail-desc">No messages yet.</p>}
              {people.map((p) => {
                const unread = p.lastFrom === 'user' && String(readMap[p.key] || '') < String(p.lastAt || '')
                return (
                <div className="wf-convo-wrap" key={p.key}>
                  <button
                    className={`wf-person${selectedPerson === p.key ? ' active' : ''}${unread ? ' unread' : ''}`}
                    onClick={() => selectPerson(p.key)}
                  >
                    <span className="wf-person-top">
                      {unread && <span className="wf-person-new" title="New message" aria-label="New" />}
                      <span className="wf-person-name">{p.email || `Guest · ${(p.conversationIds?.[0] || '').slice(0, 6)}`}</span>
                      {p.pendingCount > 0 && (
                        <span className="wf-person-badge" title={`${p.pendingCount} open request${p.pendingCount === 1 ? '' : 's'}`}>{p.pendingCount}</span>
                      )}
                    </span>
                    <span className="wf-convo-last">{p.lastBody}</span>
                  </button>
                  <button
                    className="wf-convo-del"
                    aria-label="Delete conversation"
                    onClick={() => removePerson(p)}
                  >
                    <TrashIcon />
                  </button>
                </div>
                )
              })}
            </div>

            <div className="wf-form-card wf-person-pane">
              {!selectedPerson ? (
                <p className="wf-detail-desc" style={{ margin: 0 }}>Select a person to see their conversation and custom-code requests.</p>
              ) : (
                <>
                  <div className="wf-person-head">
                    <span className="wf-person-head-name">{personDetail?.displayName || '…'}</span>
                    {personDetail?.email && personDetail.email !== personDetail.displayName && (
                      <span className="wf-person-head-mail">{personDetail.email}</span>
                    )}
                  </div>
                  <div className="wf-tab-pills" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      className={`wf-tab-pill${activeTab === 'conversation' ? ' active' : ''}`}
                      onClick={() => setActiveTab('conversation')}
                    >
                      Conversation
                    </button>
                    {convOffers.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        role="tab"
                        className={`wf-tab-pill wf-tab-pill--req${String(activeTab) === String(o.id) ? ' active' : ''}`}
                        onClick={() => setActiveTab(String(o.id))}
                      >
                        <span className="wf-tab-pill-spark">✦</span>
                        {o.name || 'Custom code'}
                        <span className={`wf-tab-pill-dot wf-tab-pill-dot--${stageOf(o)}`} />
                      </button>
                    ))}
                  </div>

                  {activeTab === 'conversation'
                    ? renderConversation()
                    : renderRequest(convOffers.find((o) => String(o.id) === String(activeTab)))}
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
