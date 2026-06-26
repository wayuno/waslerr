import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { allFields, freeFields, updates as seedUpdates } from '../data/content'
import { getSupabase, loadConfig, normalizeProduct, normalizeReview } from '../lib/supabase'
import { COMMUNITY_LINKS_KEY, loadCommunityLinks, saveCommunityLinks } from '../lib/communityLinks'
import { WALL_KEY, loadWall, saveWall } from '../lib/wall'

// Single source of truth for routing, catalogue, auth, payment and the support
// thread. Auth + products are REAL (Supabase): sessions persist across reloads,
// admin is gated to ADMIN_EMAIL, and product writes go through the backend.
// (Coupons + persistent chat arrive in Phase 2.)
const StoreCtx = createContext(null)

// Fallback catalogue used only when Supabase isn't configured (e.g. local dev
// without keys) so the storefront is never blank.
const toSeed = (f) => {
  const priceNum = f.price ? parseFloat(String(f.price).replace(/[^0-9.]/g, '')) || 0 : 0
  return {
    id: f.id,
    title: f.title,
    line: f.line,
    price: priceNum > 0 ? `$${priceNum}` : undefined,
    priceNum,
    desc: f.desc,
    image_url: f.img || null,
    freq: f.freq || 200,
  }
}
// paid catalogue and free fields are seeded (and stored) separately
const SEED_PAID = allFields.map(toSeed)
const SEED_FREE = freeFields.map(toSeed)

// normalize a free_fields row into the storefront product shape
const normalizeFreeField = (row) => ({
  id: row.id,
  title: row.title,
  line: row.line || 'desire',
  price: undefined,
  priceNum: 0,
  desc: row.description || '',
  image_url: row.image_url || null,
  freq: 200,
})

// fallback journal entries when Supabase isn't configured
const SEED_ANN = seedUpdates.map((u, i) => ({
  id: 'seed-' + i,
  tag: u.tag,
  title: u.title,
  body: u.body,
  date: u.date,
  ts: Date.parse(u.date) || Date.now() - i * 6 * 864e5,
}))
const normalizeAnnouncement = (row) => ({
  id: row.id,
  tag: row.tag,
  title: row.title,
  body: row.body || '',
  image_url: row.image_url || null,
  date: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  ts: Date.parse(row.created_at) || Date.now(),
})

// map an announcement tag to a notification type + icon
const tagToType = (tag) => {
  const t = (tag || '').toUpperCase()
  if (t === 'NEW FIELD') return 'release'
  if (t === 'OFFER') return 'offer'
  return 'announce'
}

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(file)
  })

// Upload an image through the backend → returns { url } or { error } with the
// real reason surfaced from the server (bucket missing, too large, etc.).
const uploadImageViaApi = async (file, token) => {
  if (file && file.size > 28 * 1024 * 1024) return { error: 'Image is too large (max ~28MB). Please compress it and try again.' }
  try {
    const dataBase64 = await fileToBase64(file)
    const up = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ filename: file.name, contentType: file.type, dataBase64 }),
    })
    if (!up.ok) {
      const j = await up.json().catch(() => ({}))
      return { error: `Image upload failed${j.detail ? ': ' + j.detail : j.status ? ' (' + j.status + ')' : ''}` }
    }
    return { url: (await up.json()).url }
  } catch {
    return { error: 'Image upload failed — network error. Try a smaller image.' }
  }
}

export function StoreProvider({ children }) {
  // deep-link: /admin opens the admin screen (its gate shows your signed-in
  // email, so a wrong-email login is obvious).
  const [page, setPage] = useState(() => {
    try {
      return window.location.pathname.replace(/\/+$/, '').toLowerCase() === '/admin' ? 'admin' : 'home'
    } catch {
      return 'home'
    }
  })
  const [fieldsCat, setFieldsCat] = useState('all')
  const [menuOpen, setMenuOpen] = useState(false)

  const [selectedId, setSelectedId] = useState(null)
  const [paidProducts, setPaidProducts] = useState(SEED_PAID)
  const [freeFieldsList, setFreeFieldsList] = useState(SEED_FREE)
  const [announcements, setAnnouncements] = useState(SEED_ANN)

  // storefront catalogue = paid products + free fields (merged, memoized)
  const products = useMemo(() => [...paidProducts, ...freeFieldsList], [paidProducts, freeFieldsList])

  const [payMethod, setPayMethod] = useState('paypal')
  const [payDone, setPayDone] = useState(false)
  const [orderId, setOrderId] = useState(null)
  const [deliveredParams, setDeliveredParams] = useState(null)

  const [loggedIn, setLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [adminTab, setAdminTab] = useState('stats')

  const [chatOpen, setChatOpen] = useState(false)
  const [chatMsgs, setChatMsgs] = useState([])
  const [chatRequest, setChatRequest] = useState(null)
  const [appliedCoupon, setAppliedCoupon] = useState(null)

  // notifications: derived from announcements (admin-published) + local items
  // (e.g. chat replies); per-user read state via localStorage.
  const readInit = () => {
    try {
      return Number(localStorage.getItem('wf_notif_read_at')) || 0
    } catch {
      return 0
    }
  }
  const localInit = () => {
    try {
      return JSON.parse(localStorage.getItem('wf_notif_local') || '[]')
    } catch {
      return []
    }
  }
  const [notifReadAt, setNotifReadAt] = useState(readInit)
  const [localNotifs, setLocalNotifs] = useState(localInit)

  // admin-controlled community links (YouTube / Discord / 1:1). Permanent source
  // is Supabase (settings table); localStorage is an offline cache/fallback.
  const [communityLinks, setCommunityLinksState] = useState(loadCommunityLinks)

  // cart (lightweight, demo) + global toast + reviews wall
  const [cart, setCart] = useState([])
  const [toast, setToast] = useState(null)
  const [wall, setWall] = useState(loadWall)
  const [reviewField, setReviewField] = useState(null)
  const [reviewShare, setReviewShare] = useState(false)
  const toastTimer = useRef(null)

  const showToast = useCallback((message, kind = 'ok') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, kind, key: Math.random().toString(36).slice(2) })
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }, [])

  const addToCart = useCallback(
    (product) => {
      if (!product) return
      setCart((prev) => (prev.some((i) => i.id === product.id) ? prev : [...prev, product]))
      showToast(`${product.title} added to cart`)
    },
    [showToast],
  )
  const removeFromCart = useCallback((id) => setCart((prev) => prev.filter((i) => i.id !== id)), [])

  const pendingSection = useRef(null)
  const supabaseRef = useRef(null)
  const adminEmailRef = useRef('')
  const accessTokenRef = useRef(null)
  const userRef = useRef(null)
  const conversationIdRef = useRef(null)

  const navigate = useCallback(
    (target) => {
      const t = typeof target === 'string' ? { page: target } : target || {}
      const { page: p = 'home', section, cat, id } = t
      if (id != null) setSelectedId(id)
      if (cat) setFieldsCat(cat)
      setMenuOpen(false)
      if (p === page && (!cat || p !== 'fields')) {
        if (section) document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' })
        else window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      pendingSection.current = section || null
      setPage(p)
    },
    [page],
  )

  useEffect(() => {
    const id = pendingSection.current
    if (id) {
      pendingSection.current = null
      requestAnimationFrame(() => {
        const el = document.getElementById(id)
        if (el) el.scrollIntoView({ behavior: 'auto' })
        else window.scrollTo(0, 0)
      })
    } else {
      window.scrollTo(0, 0)
    }
  }, [page, fieldsCat])

  // ---- products ----
  // Once Supabase is reachable it is the source of truth — set even when the
  // table is empty (so deleting the last row clears the list; the seed only
  // covers the no-Supabase case).
  const reloadProducts = useCallback(async (client) => {
    const supabase = client || supabaseRef.current
    if (!supabase) return
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    if (!error && Array.isArray(data)) setPaidProducts(data.map(normalizeProduct))
  }, [])

  const loadFreeFields = useCallback(async (client) => {
    const supabase = client || supabaseRef.current
    if (!supabase) return
    const { data, error } = await supabase.from('free_fields').select('*').order('created_at', { ascending: false })
    if (!error && Array.isArray(data)) setFreeFieldsList(data.map(normalizeFreeField))
  }, [])

  const loadAnnouncements = useCallback(async (client) => {
    const supabase = client || supabaseRef.current
    if (!supabase) return
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    if (!error && Array.isArray(data)) setAnnouncements(data.map(normalizeAnnouncement))
  }, [])

  // reviews wall — Supabase is the permanent source when configured
  const loadReviews = useCallback(async (client) => {
    const supabase = client || supabaseRef.current
    if (!supabase) return
    const { data, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false })
    if (!error && Array.isArray(data)) setWall(data.map(normalizeReview))
  }, [])

  // community links from the settings table (overrides the localStorage cache)
  const loadSettings = useCallback(async (client) => {
    const supabase = client || supabaseRef.current
    if (!supabase) return
    const { data, error } = await supabase.from('settings').select('value').eq('key', 'community_links').maybeSingle()
    if (!error && data && data.value) {
      setCommunityLinksState((prev) => ({ ...prev, ...data.value }))
      saveCommunityLinks({ ...loadCommunityLinks(), ...data.value })
    }
  }, [])

  const findProduct = useCallback((id) => products.find((p) => p.id === id) || null, [products])
  const selectedProduct = selectedId != null ? findProduct(selectedId) : null

  const openDetail = useCallback(
    (id) => {
      setPayDone(false)
      navigate({ page: 'detail', id })
    },
    [navigate],
  )
  const goCheckout = useCallback(
    (id) => {
      setPayDone(false)
      setAppliedCoupon(null)
      navigate({ page: 'checkout', ...(id != null ? { id } : {}) })
    },
    [navigate],
  )
  const pay = useCallback(() => {
    setOrderId('WF-' + (1000 + Math.floor(Math.random() * 9000)))
    setPayDone(true)
  }, [])

  const goDelivered = useCallback(
    (params) => {
      setDeliveredParams(params || null)
      navigate('delivered')
    },
    [navigate],
  )

  // ---- auth (Supabase) ----
  const applySession = useCallback((session) => {
    accessTokenRef.current = session?.access_token || null
    const u = session?.user
    if (u) {
      const email = (u.email || '').toLowerCase()
      const role = (u.app_metadata && u.app_metadata.role) || 'customer'
      userRef.current = email
      setUser(email)
      setLoggedIn(true)
      setIsAdmin(role === 'admin' || (!!adminEmailRef.current && email === adminEmailRef.current))
    } else {
      userRef.current = null
      setUser(null)
      setLoggedIn(false)
      setIsAdmin(false)
    }
  }, [])

  useEffect(() => {
    let sub
    let cancelled = false
    ;(async () => {
      const cfg = await loadConfig()
      if (cancelled) return
      adminEmailRef.current = (cfg.adminEmail || '').toLowerCase()
      const supabase = await getSupabase()
      if (cancelled) return
      supabaseRef.current = supabase
      if (!supabase) {
        setAuthReady(true)
        return
      }
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      applySession(session)
      const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => applySession(s))
      sub = listener?.subscription
      setAuthReady(true)
      reloadProducts(supabase)
      loadFreeFields(supabase)
      loadAnnouncements(supabase)
      loadReviews(supabase)
      loadSettings(supabase)
    })()
    return () => {
      cancelled = true
      sub?.unsubscribe?.()
    }
  }, [applySession, reloadProducts, loadFreeFields, loadAnnouncements, loadReviews, loadSettings])

  const getToken = useCallback(async () => {
    const supabase = supabaseRef.current
    if (!supabase) return null
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || accessTokenRef.current
  }, [])

  // fetch helper that attaches the admin's Supabase token
  const authedFetch = useCallback(
    async (path, opts = {}) => {
      const token = await getToken()
      return fetch(path, {
        ...opts,
        headers: { ...(opts.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
    },
    [getToken],
  )

  const signIn = useCallback(
    async (email, password) => {
      const supabase = supabaseRef.current
      if (!supabase) return { error: 'Sign-in is not available yet — Supabase isn’t configured.' }
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) return { error: error.message }
      const mail = (data.user?.email || '').toLowerCase()
      navigate(adminEmailRef.current && mail === adminEmailRef.current ? 'admin' : 'home')
      return { ok: true }
    },
    [navigate],
  )

  const signUp = useCallback(
    async (email, password, name) => {
      const supabase = supabaseRef.current
      if (!supabase) return { error: 'Sign-up is not available yet — Supabase isn’t configured.' }
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: (name || '').trim() } },
      })
      if (error) return { error: error.message }
      if (!data.session) return { ok: true, needsConfirm: true }
      navigate('home')
      return { ok: true }
    },
    [navigate],
  )

  const logout = useCallback(async () => {
    const supabase = supabaseRef.current
    if (supabase) await supabase.auth.signOut()
    setUser(null)
    setLoggedIn(false)
    setIsAdmin(false)
    navigate('home')
  }, [navigate])

  const requireAdmin = useCallback(() => {
    if (loggedIn && isAdmin) navigate('admin')
    else navigate('login')
  }, [loggedIn, isAdmin, navigate])

  // ---- admin product CRUD (via backend, service-role) ----
  const addProduct = useCallback(
    async (form, file) => {
      const token = await getToken()
      if (!token) return { error: 'Not authorized.' }
      try {
        let image_url = form.image_url || null
        if (file) {
          const up = await uploadImageViaApi(file, token)
          if (up.error) return { error: up.error }
          image_url = up.url
        }
        const res = await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...form, image_url }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          return { error: `Publish failed (${res.status})${j.detail ? ': ' + j.detail : j.error ? ': ' + j.error : ''}` }
        }
        await reloadProducts()
        return { ok: true }
      } catch {
        return { error: 'Network error.' }
      }
    },
    [getToken, reloadProducts],
  )

  const deleteProduct = useCallback(
    async (id) => {
      const token = await getToken()
      if (!token) return
      const res = await fetch('/api/admin/products/' + id, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setPaidProducts((prev) => prev.filter((p) => p.id !== id)) // optimistic
        await reloadProducts()
      }
    },
    [getToken, reloadProducts],
  )

  // free fields (separate table) ----------------------------------
  const addFreeField = useCallback(
    async (form, file) => {
      const token = await getToken()
      if (!token) return { error: 'Not authorized.' }
      try {
        let image_url = form.image_url || null
        if (file) {
          const up = await uploadImageViaApi(file, token)
          if (up.error) return { error: up.error }
          image_url = up.url
        }
        const res = await fetch('/api/admin/free-fields', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title: form.title, line: form.line, description: form.description, image_url }),
        })
        if (!res.ok) return { error: `Publish failed (${res.status})` }
        await loadFreeFields()
        return { ok: true }
      } catch {
        return { error: 'Network error.' }
      }
    },
    [getToken, loadFreeFields],
  )

  const deleteFreeField = useCallback(
    async (id) => {
      const token = await getToken()
      if (!token) return
      const res = await fetch('/api/admin/free-fields/' + id, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setFreeFieldsList((prev) => prev.filter((p) => p.id !== id)) // optimistic
        await loadFreeFields()
      }
    },
    [getToken, loadFreeFields],
  )

  const addAnnouncement = useCallback(
    async (form, file) => {
      try {
        let image_url = form.image_url || null
        if (file) {
          const up = await uploadImageViaApi(file, await getToken())
          if (up.error) return { error: up.error }
          image_url = up.url
        }
        const r = await authedFetch('/api/admin/announcements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, image_url }),
        })
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          return { error: `Publish failed (${r.status})${j.detail ? ': ' + j.detail : j.error ? ': ' + j.error : ''}` }
        }
        await loadAnnouncements()
        return { ok: true }
      } catch {
        return { error: 'Network error.' }
      }
    },
    [authedFetch, getToken, loadAnnouncements],
  )

  const setUserRole = useCallback(
    async (id, role) => {
      const r = await authedFetch('/api/admin/users/' + id + '/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      return r.ok
    },
    [authedFetch],
  )

  const deleteAnnouncement = useCallback(
    async (id) => {
      const r = await authedFetch('/api/admin/announcements/' + id, { method: 'DELETE' })
      if (r.ok) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== id)) // optimistic
        await loadAnnouncements()
      }
    },
    [authedFetch, loadAnnouncements],
  )

  // admin: delete a whole support conversation (clears its messages)
  const deleteConversation = useCallback(
    async (conversationId) => {
      const r = await authedFetch('/api/admin/conversations/' + encodeURIComponent(conversationId), { method: 'DELETE' })
      return r.ok
    },
    [authedFetch],
  )

  const deleteUser = useCallback(
    async (id) => {
      const r = await authedFetch('/api/admin/users/' + id, { method: 'DELETE' })
      return r.ok
    },
    [authedFetch],
  )

  // ---- community links (admin save → Supabase settings) ----
  const setCommunityLinks = useCallback(
    async (next) => {
      const merged = { ...loadCommunityLinks(), ...next }
      setCommunityLinksState(merged)
      saveCommunityLinks(merged) // instant local cache + offline fallback
      try {
        const r = await authedFetch('/api/admin/settings/community', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged),
        })
        return r.ok
      } catch {
        return false
      }
    },
    [authedFetch],
  )

  // ---- reviews wall writes ----
  // anyone may post (public insert via the anon client); offline → localStorage
  const addReview = useCallback(async (entry) => {
    const supabase = supabaseRef.current
    if (supabase) {
      const { data, error } = await supabase
        .from('reviews')
        .insert({ field: entry.field, name: entry.name, rating: entry.rating, text: entry.text })
        .select()
        .single()
      if (!error && data) {
        const item = normalizeReview(data)
        setWall((prev) => [item, ...prev])
        return item
      }
    }
    const item = { id: 'w-' + Math.random().toString(36).slice(2), ts: Date.now(), featured: false, ...entry }
    setWall((prev) => {
      const next = [item, ...prev]
      saveWall(next)
      return next
    })
    return item
  }, [])

  // admin: feature / delete a story (service-role via backend)
  const featureReview = useCallback(
    async (id, featured) => {
      const r = await authedFetch(`/api/admin/reviews/${id}/feature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured }),
      })
      if (r.ok) await loadReviews()
      return r.ok
    },
    [authedFetch, loadReviews],
  )
  const deleteReview = useCallback(
    async (id) => {
      const r = await authedFetch(`/api/admin/reviews/${id}`, { method: 'DELETE' })
      if (r.ok) await loadReviews()
      return r.ok
    },
    [authedFetch, loadReviews],
  )

  // ---- coupons ----
  const applyCoupon = useCallback(async (code) => {
    const c = (code || '').trim()
    if (!c) return { error: 'Enter a code.' }
    try {
      const r = await fetch('/api/coupons/' + encodeURIComponent(c))
      if (!r.ok) return { error: 'Invalid or expired code.' }
      const data = await r.json()
      setAppliedCoupon(data)
      return { ok: true, coupon: data }
    } catch {
      return { error: 'Network error.' }
    }
  }, [])
  const clearCoupon = useCallback(() => setAppliedCoupon(null), [])

  // ---- support chat (persisted in Supabase via backend) ----
  const ensureConvId = useCallback(() => {
    if (conversationIdRef.current) return conversationIdRef.current
    let id = null
    try {
      id = localStorage.getItem('wf_conv')
    } catch {
      /* ignore */
    }
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : 'c' + Math.random().toString(36).slice(2) + Date.now()
      try {
        localStorage.setItem('wf_conv', id)
      } catch {
        /* ignore */
      }
    }
    conversationIdRef.current = id
    return id
  }, [])

  const loadChat = useCallback(async () => {
    const id = ensureConvId()
    try {
      const r = await fetch('/api/chat/messages?conversationId=' + encodeURIComponent(id))
      if (r.ok) {
        const d = await r.json()
        setChatMsgs(d.messages || [])
      }
    } catch {
      /* ignore */
    }
  }, [ensureConvId])

  const sendUserChat = useCallback(
    async (text) => {
      const t = (text || '').trim()
      if (!t) return
      const id = ensureConvId()
      setChatMsgs((prev) => [...prev, { from: 'user', text: t }]) // optimistic
      try {
        await fetch('/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: id, text: t, email: userRef.current || null }),
        })
        await loadChat()
      } catch {
        /* ignore */
      }
    },
    [ensureConvId, loadChat],
  )

  const openChat = useCallback(() => setChatOpen(true), [])
  // route a Custom Code request into the support chat
  const requestViaChat = useCallback((payload) => {
    setChatRequest({ ...payload, ts: Date.now() })
    setChatOpen(true)
  }, [])
  const clearChatRequest = useCallback(() => setChatRequest(null), [])

  // ---- reviews wall navigation ----
  const openReviews = useCallback(
    (fieldId = null, share = false) => {
      setReviewField(fieldId)
      setReviewShare(share)
      navigate('reviews')
    },
    [navigate],
  )
  const clearReviewShare = useCallback(() => setReviewShare(false), [])

  // ---- notifications ----
  const pushNotification = useCallback((n) => {
    const item = { id: 'l-' + Math.random().toString(36).slice(2), ts: Date.now(), ...n }
    setLocalNotifs((prev) => {
      const next = [item, ...prev].slice(0, 30)
      try {
        localStorage.setItem('wf_notif_local', JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])
  const markNotifsRead = useCallback(() => {
    const now = Date.now()
    setNotifReadAt(now)
    try {
      localStorage.setItem('wf_notif_read_at', String(now))
    } catch {
      /* ignore */
    }
  }, [])
  // cross-tab sync
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'wf_notif_read_at') setNotifReadAt(Number(e.newValue) || 0)
      if (e.key === 'wf_notif_local') {
        try {
          setLocalNotifs(JSON.parse(e.newValue || '[]'))
        } catch {
          /* ignore */
        }
      }
      if (e.key === COMMUNITY_LINKS_KEY) setCommunityLinksState(loadCommunityLinks())
      if (e.key === WALL_KEY) setWall(loadWall())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const notifications = [
    ...announcements.map((a) => ({ id: 'a-' + a.id, type: tagToType(a.tag), title: a.title, body: a.body, href: 'updates', ts: a.ts || 0 })),
    ...localNotifs,
  ].sort((a, b) => b.ts - a.ts)
  const unreadCount = notifications.filter((n) => n.ts > notifReadAt).length

  const value = {
    page,
    navigate,
    fieldsCat,
    menuOpen,
    setMenuOpen,
    products,
    paidProducts,
    freeFields: freeFieldsList,
    reloadProducts,
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
    selectedId,
    selectedProduct,
    findProduct,
    openDetail,
    goCheckout,
    payMethod,
    setPayMethod,
    payDone,
    orderId,
    pay,
    deliveredParams,
    goDelivered,
    loggedIn,
    user,
    isAdmin,
    adminEmail: adminEmailRef.current,
    authReady,
    signIn,
    signUp,
    logout,
    requireAdmin,
    adminTab,
    setAdminTab,
    chatOpen,
    setChatOpen,
    openChat,
    chatMsgs,
    loadChat,
    sendUserChat,
    conversationId: ensureConvId(),
    userEmail: user,
    chatRequest,
    requestViaChat,
    clearChatRequest,
    notifications,
    unreadCount,
    notifReadAt,
    markNotifsRead,
    pushNotification,
    communityLinks,
    setCommunityLinks,
    cart,
    cartCount: cart.length,
    addToCart,
    removeFromCart,
    toast,
    showToast,
    wall,
    addReview,
    reloadReviews: loadReviews,
    featureReview,
    deleteReview,
    reviewField,
    reviewShare,
    openReviews,
    clearReviewShare,
    authedFetch,
    appliedCoupon,
    applyCoupon,
    clearCoupon,
  }

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  return useContext(StoreCtx)
}
