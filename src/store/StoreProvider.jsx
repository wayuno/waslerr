import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getSupabase, loadConfig, normalizeProduct, normalizeReview } from '../lib/supabase'
import { COMMUNITY_LINKS_KEY, loadCommunityLinks, saveCommunityLinks } from '../lib/communityLinks'
import { WALL_KEY, loadWall, saveWall } from '../lib/wall'

// Single source of truth for routing, catalogue, auth, payment and the support
// thread. The catalogue is 100% Supabase-driven — there is no hardcoded seed, so
// what the admin publishes/deletes is permanent and nothing reappears on deploy.
const StoreCtx = createContext(null)

// normalize a free_fields row into the storefront product shape
const normalizeFreeField = (row) => ({
  id: row.id,
  title: row.title,
  line: row.line || 'desire',
  price: undefined,
  priceNum: 0,
  desc: row.description || '',
  image_url: row.image_url || null,
  sold: Number(row.sold_count) || 0,
  hasAudio: !!row.audio_url,
  freq: 200,
})

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

// Upload an audio file through the backend → returns { path } or { error }.
// isFree routes it to the free-audio bucket; otherwise the paid field-audio bucket.
const uploadAudioViaApi = async (file, token, isFree = false) => {
  if (file && file.size > 120 * 1024 * 1024) return { error: 'Audio is too large (max ~120MB). Please compress it.' }
  if (file && !String(file.type).startsWith('audio/')) return { error: 'Please choose an audio file.' }
  try {
    const dataBase64 = await fileToBase64(file)
    const up = await fetch('/api/admin/upload-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ filename: file.name, contentType: file.type, dataBase64, free: !!isFree }),
    })
    if (!up.ok) {
      const j = await up.json().catch(() => ({}))
      return { error: `Audio upload failed${j.detail ? ': ' + j.detail : j.status ? ' (' + j.status + ')' : ''}` }
    }
    return { path: (await up.json()).path }
  } catch {
    return { error: 'Audio upload failed — network error. Try a smaller file.' }
  }
}

export function StoreProvider({ children }) {
  // The admin panel is reachable ONLY via the secret ADMIN_PATH (set in Railway)
  // — resolved after /api/config loads. /admin no longer opens it. We start on
  // home; the config effect deep-links to admin if the URL matches the secret.
  const [page, setPage] = useState('home')
  const [fieldsCat, setFieldsCat] = useState('all')
  const [menuOpen, setMenuOpen] = useState(false)

  const [selectedId, setSelectedId] = useState(null)
  const [paidProducts, setPaidProducts] = useState([])
  const [freeFieldsList, setFreeFieldsList] = useState([])
  const [announcements, setAnnouncements] = useState([])

  // storefront catalogue = paid products + free fields (merged, memoized)
  const products = useMemo(() => [...paidProducts, ...freeFieldsList], [paidProducts, freeFieldsList])

  const [payMethod, setPayMethod] = useState('paypal')
  const [payDone, setPayDone] = useState(false)
  const [orderId, setOrderId] = useState(null)
  const [deliveredParams, setDeliveredParams] = useState(null)

  const [loggedIn, setLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [userName, setUserName] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [purchasedIds, setPurchasedIds] = useState([]) // field ids this user has paid for
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
      // push a browser-history entry so the device/browser Back button returns to
      // the PREVIOUS page (not straight to home).
      try {
        window.history.pushState(
          { wf: { page: p, fieldsCat: cat || fieldsCat, selectedId: id != null ? id : selectedId, section: section || null } },
          '',
        )
      } catch {
        /* ignore */
      }
    },
    [page, fieldsCat, selectedId],
  )

  // seed the initial history entry + handle Back/Forward (popstate)
  useEffect(() => {
    try {
      window.history.replaceState({ wf: { page, fieldsCat, selectedId } }, '')
    } catch {
      /* ignore */
    }
    const onPop = (e) => {
      const wf = e.state && e.state.wf
      setMenuOpen(false)
      if (wf) {
        if (wf.selectedId !== undefined) setSelectedId(wf.selectedId)
        if (wf.fieldsCat !== undefined) setFieldsCat(wf.fieldsCat)
        pendingSection.current = wf.section || null
        setPage(wf.page || 'home')
      } else {
        setPage('home') // back past the first in-app entry → home
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      if (!loggedIn) {
        showToast('Please sign in to purchase a field')
        navigate('login')
        return
      }
      setPayDone(false)
      setAppliedCoupon(null)
      navigate({ page: 'checkout', ...(id != null ? { id } : {}) })
    },
    [navigate, loggedIn, showToast],
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
      setUserName((u.user_metadata && u.user_metadata.name) || '')
      setLoggedIn(true)
      setIsAdmin(role === 'admin' || (!!adminEmailRef.current && email === adminEmailRef.current))
    } else {
      userRef.current = null
      setUser(null)
      setUserName('')
      setLoggedIn(false)
      setIsAdmin(false)
    }
  }, [])

  useEffect(() => {
    let sub
    let cancelled = false
    // capture this BEFORE the Supabase client consumes & clears the URL hash —
    // a "forgot password" email link lands here with #type=recovery
    const isRecovery = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash)
    ;(async () => {
      const cfg = await loadConfig()
      if (cancelled) return
      adminEmailRef.current = (cfg.adminEmail || '').toLowerCase()
      // secret admin deep-link: open the panel only when the URL matches ADMIN_PATH
      const secret = (cfg.adminPath || '').toLowerCase()
      if (secret) {
        try {
          const here = window.location.pathname.replace(/\/+$/, '').toLowerCase()
          if (here === secret) setPage('admin')
        } catch {
          /* ignore */
        }
      }
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
      const { data: listener } = supabase.auth.onAuthStateChange((evt, s) => {
        applySession(s)
        // recovery link signed the user in just to let them pick a new password
        if (evt === 'PASSWORD_RECOVERY') setPage('reset')
      })
      sub = listener?.subscription
      // belt-and-suspenders: if the listener missed the event, the captured flag routes us
      if (isRecovery) setPage('reset')
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
    let { data } = await supabase.auth.getSession()
    let token = data.session?.access_token
    // access token expired but refresh token still valid → refresh in place
    if (!token) {
      try {
        const { data: r } = await supabase.auth.refreshSession()
        token = r.session?.access_token
      } catch {
        /* ignore */
      }
    }
    return token || accessTokenRef.current
  }, [])

  // fetch helper that attaches the admin's Supabase token, and recovers from an
  // expired token by refreshing the session once and retrying (so a stale token
  // no longer forces a manual sign-out/sign-in).
  const authedFetch = useCallback(
    async (path, opts = {}) => {
      const token = await getToken()
      const run = (t) =>
        fetch(path, { ...opts, headers: { ...(opts.headers || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } })
      let res = await run(token)
      if ((res.status === 401 || res.status === 403) && supabaseRef.current) {
        try {
          const { data } = await supabaseRef.current.auth.refreshSession()
          const t2 = data.session?.access_token
          if (t2) res = await run(t2)
        } catch {
          /* ignore */
        }
      }
      return res
    },
    [getToken],
  )

  // Which fields has this user actually paid for? Used to gate posting a story
  // to the wall (only buyers may post; everyone may read). Merges the local
  // post-checkout flags (instant) with the server's paid/delivered orders
  // (authoritative).
  const refreshPurchases = useCallback(async () => {
    const ids = new Set()
    try {
      const orders = JSON.parse(localStorage.getItem('wf_orders') || '[]')
      orders.forEach((o) => {
        const id = o.fieldId != null ? o.fieldId : o.id
        if (id != null) ids.add(String(id))
      })
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('wf_purchased_') && localStorage.getItem(k) === '1') ids.add(k.slice(13))
      }
    } catch {
      /* ignore */
    }
    if (loggedIn) {
      try {
        const r = await authedFetch('/api/orders')
        if (r.ok) {
          const d = await r.json().catch(() => ({}))
          ;(d.orders || []).forEach((o) => { if (o.fieldId != null) ids.add(String(o.fieldId)) })
        }
      } catch {
        /* ignore */
      }
    }
    setPurchasedIds(Array.from(ids))
  }, [loggedIn, authedFetch])

  useEffect(() => {
    if (authReady) refreshPurchases()
  }, [authReady, loggedIn, refreshPurchases])

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

  // forgot-password: email a recovery link that returns to the app and fires
  // the PASSWORD_RECOVERY flow (-> the reset screen)
  const requestPasswordReset = useCallback(async (email) => {
    const supabase = supabaseRef.current
    if (!supabase) return { error: 'Password reset isn’t available right now.' }
    if (!email || !email.trim()) return { error: 'Enter your account email first.' }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    if (error) return { error: error.message }
    return { ok: true }
  }, [])

  const logout = useCallback(async () => {
    const supabase = supabaseRef.current
    if (supabase) await supabase.auth.signOut()
    setUser(null)
    setUserName('')
    setLoggedIn(false)
    setIsAdmin(false)
    navigate('home')
  }, [navigate])

  // update display name and/or password (Supabase auth.updateUser)
  const updateProfile = useCallback(async ({ name, password } = {}) => {
    const supabase = supabaseRef.current
    if (!supabase) return { error: 'Account updates aren’t available right now.' }
    const payload = {}
    if (name != null) payload.data = { name: String(name).trim() }
    if (password) payload.password = password
    if (!Object.keys(payload).length) return { error: 'Nothing to update.' }
    const { error } = await supabase.auth.updateUser(payload)
    if (error) return { error: error.message }
    if (name != null) setUserName(String(name).trim())
    return { ok: true }
  }, [])

  const requireAdmin = useCallback(() => {
    if (loggedIn && isAdmin) navigate('admin')
    else navigate('login')
  }, [loggedIn, isAdmin, navigate])

  // ---- admin product CRUD (via backend, service-role) ----
  const addProduct = useCallback(
    async (form, file, audioFile) => {
      const token = await getToken()
      if (!token) return { error: 'Not authorized.' }
      try {
        let image_url = form.image_url || null
        if (file) {
          const up = await uploadImageViaApi(file, token)
          if (up.error) return { error: up.error }
          image_url = up.url
        }
        let audio_url = null
        if (audioFile) {
          const au = await uploadAudioViaApi(audioFile, token)
          if (au.error) return { error: au.error }
          audio_url = au.path
        }
        const res = await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...form, image_url, audio_url }),
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

  // edit a field (paid or free): change any of title/line/price/description and
  // optionally replace the image and/or audio.
  const updateProduct = useCallback(
    async (id, isFree, patch, imageFile, audioFile) => {
      const token = await getToken()
      if (!token) return { error: 'Not authorized.' }
      try {
        const body = { ...patch }
        if (imageFile) {
          const up = await uploadImageViaApi(imageFile, token)
          if (up.error) return { error: up.error }
          body.image_url = up.url
        }
        if (audioFile) {
          const au = await uploadAudioViaApi(audioFile, token, isFree)
          if (au.error) return { error: au.error }
          body.audio_url = au.path
        }
        const path = isFree ? '/api/admin/free-fields/' + id : '/api/admin/products/' + id
        const res = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          return { error: `Save failed (${res.status})${j.detail ? ': ' + j.detail : ''}` }
        }
        if (isFree) await loadFreeFields()
        else await reloadProducts()
        return { ok: true }
      } catch {
        return { error: 'Network error.' }
      }
    },
    [getToken, reloadProducts, loadFreeFields],
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
    async (form, file, audioFile) => {
      const token = await getToken()
      if (!token) return { error: 'Not authorized.' }
      try {
        let image_url = form.image_url || null
        if (file) {
          const up = await uploadImageViaApi(file, token)
          if (up.error) return { error: up.error }
          image_url = up.url
        }
        let audio_url = null
        if (audioFile) {
          const au = await uploadAudioViaApi(audioFile, token, true) // free → free-audio bucket
          if (au.error) return { error: au.error }
          audio_url = au.path
        }
        const res = await fetch('/api/admin/free-fields', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title: form.title, line: form.line, description: form.description, image_url, audio_url }),
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
    const images = Array.isArray(entry.images) ? entry.images.slice(0, 2) : []
    const supabase = supabaseRef.current
    if (supabase) {
      const { data, error } = await supabase
        .from('reviews')
        .insert({ field: entry.field, name: entry.name, rating: entry.rating, text: entry.text, images })
        .select()
        .single()
      if (!error && data) {
        const item = normalizeReview(data)
        setWall((prev) => [item, ...prev])
        return item
      }
    }
    const item = { id: 'w-' + Math.random().toString(36).slice(2), ts: Date.now(), featured: false, ...entry, images }
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
      if (r.ok) {
        setWall((prev) => prev.filter((rv) => rv.id !== id)) // optimistic — works for seed + new
        saveWall(loadWall().filter((rv) => rv.id !== id))
        await loadReviews()
      }
      return r.ok
    },
    [authedFetch, loadReviews],
  )

  // admin: create a review for any field (custom name/rating/text/photos)
  const adminAddReview = useCallback(
    async (entry) => {
      const r = await authedFetch('/api/admin/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        return { error: j.detail || j.error || 'Could not add review.' }
      }
      await loadReviews()
      return { ok: true }
    },
    [authedFetch, loadReviews],
  )

  // admin: set the editable "sold" count for a paid product or free field
  const setSoldCount = useCallback(
    async (id, isFree, value) => {
      const sold = Math.max(0, parseInt(value, 10) || 0)
      const path = isFree ? '/api/admin/free-fields/' + id : '/api/admin/products/' + id
      const r = await authedFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sold_count: sold }),
      })
      if (r.ok) {
        const setter = isFree ? setFreeFieldsList : setPaidProducts
        setter((prev) => prev.map((p) => (p.id === id ? { ...p, sold } : p)))
      }
      return r.ok
    },
    [authedFetch],
  )

  // ---- coupons ----
  const applyCoupon = useCallback(async (code, fieldId) => {
    const c = (code || '').trim()
    if (!c) return { error: 'Enter a code.' }
    const COUPON_ERR = {
      expired: 'This code has expired.',
      used_up: 'This code has reached its usage limit.',
      wrong_field: "This code doesn't apply to this field.",
      invalid: 'Invalid code.',
      invalid_coupon: 'Invalid code.',
    }
    try {
      const r = await fetch('/api/coupons/' + encodeURIComponent(c) + (fieldId ? '?field=' + encodeURIComponent(fieldId) : ''))
      const data = await r.json().catch(() => ({}))
      if (!r.ok) return { error: COUPON_ERR[data.error] || 'Invalid or expired code.' }
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

  const openChat = useCallback(() => {
    if (!loggedIn) {
      showToast('Please sign in to chat with support')
      navigate('login')
      return
    }
    setChatOpen(true)
  }, [loggedIn, showToast, navigate])
  // route a Custom Code request into the support chat
  const requestViaChat = useCallback(
    (payload) => {
      if (!loggedIn) {
        showToast('Please sign in to request a Custom Code')
        navigate('login')
        return
      }
      setChatRequest({ ...payload, ts: Date.now() })
      setChatOpen(true)
    },
    [loggedIn, showToast, navigate],
  )
  const clearChatRequest = useCallback(() => setChatRequest(null), [])

  // ---- offers (chat: field offered → pay → deliver) ----
  // admin: create an offer in a conversation
  const createOffer = useCallback(
    async (conversationId, payload) => {
      const r = await authedFetch(`/api/admin/conversations/${encodeURIComponent(conversationId)}/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        return { error: j.detail || j.error || 'Could not send field.' }
      }
      return { ok: true, offer: (await r.json()).offer }
    },
    [authedFetch],
  )
  // admin: deliver one or more files (base64 through the backend, stored
  // privately). Uses XHR so the admin sees real upload progress on large files.
  // onProgress(percent) is called as the browser→server upload streams.
  const deliverOffer = useCallback(
    async (offerId, { files, file, note, onProgress } = {}) => {
      const list = (files && files.length ? files : file ? [file] : []).filter(Boolean)
      if (!list.length) return { error: 'Choose at least one file to deliver.' }
      try {
        const payloadFiles = []
        for (const f of list) {
          payloadFiles.push({ fileName: f.name, contentType: f.type, size: f.size, dataBase64: await fileToBase64(f) })
        }
        const body = JSON.stringify({ files: payloadFiles, note: note || '' })
        const send = (token) =>
          new Promise((resolve) => {
            const xhr = new XMLHttpRequest()
            xhr.open('POST', `/api/admin/offers/${offerId}/deliver`)
            xhr.setRequestHeader('Content-Type', 'application/json')
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
            }
            xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText })
            xhr.onerror = () => resolve({ status: 0, text: '' })
            xhr.send(body)
          })
        let r = await send(await getToken())
        if ((r.status === 401 || r.status === 403) && supabaseRef.current) {
          // stale token → refresh once and retry
          try {
            const { data } = await supabaseRef.current.auth.refreshSession()
            if (data.session?.access_token) r = await send(data.session.access_token)
          } catch {
            /* ignore */
          }
        }
        if (r.status < 200 || r.status >= 300) {
          let detail = ''
          try {
            const j = JSON.parse(r.text)
            detail = j.detail || j.error || ''
          } catch {
            /* ignore */
          }
          return { error: detail || 'Delivery failed.' }
        }
        return { ok: true, offer: JSON.parse(r.text).offer }
      } catch {
        return { error: 'Delivery failed — network error. Try smaller files.' }
      }
    },
    [getToken],
  )

  // ---- reviews wall navigation ----
  const openReviews = useCallback(
    (fieldId = null, share = false) => {
      if (!loggedIn) {
        showToast('Please sign in to view the reviews wall')
        navigate('login')
        return
      }
      setReviewField(fieldId)
      setReviewShare(share)
      navigate('reviews')
    },
    [navigate, loggedIn, showToast],
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
    updateProduct,
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
    userName,
    isAdmin,
    adminEmail: adminEmailRef.current,
    authReady,
    signIn,
    signUp,
    logout,
    requestPasswordReset,
    updateProfile,
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
    createOffer,
    deliverOffer,
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
    adminAddReview,
    setSoldCount,
    reloadReviews: loadReviews,
    featureReview,
    deleteReview,
    reviewField,
    reviewShare,
    openReviews,
    clearReviewShare,
    purchasedIds,
    hasPurchased: purchasedIds.length > 0,
    refreshPurchases,
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
