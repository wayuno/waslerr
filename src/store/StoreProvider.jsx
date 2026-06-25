import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { allFields, freeFields, updates as seedUpdates } from '../data/content'
import { getSupabase, loadConfig, normalizeProduct } from '../lib/supabase'

// Single source of truth for routing, catalogue, auth, payment and the support
// thread. Auth + products are REAL (Supabase): sessions persist across reloads,
// admin is gated to ADMIN_EMAIL, and product writes go through the backend.
// (Coupons + persistent chat arrive in Phase 2.)
const StoreCtx = createContext(null)

// Fallback catalogue used only when Supabase isn't configured (e.g. local dev
// without keys) so the storefront is never blank.
const SEED = [...allFields, ...freeFields].map((f) => {
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
})

// fallback journal entries when Supabase isn't configured
const SEED_ANN = seedUpdates.map((u, i) => ({ id: 'seed-' + i, tag: u.tag, title: u.title, body: u.body, date: u.date }))
const normalizeAnnouncement = (row) => ({
  id: row.id,
  tag: row.tag,
  title: row.title,
  body: row.body || '',
  date: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
})

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(file)
  })

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
  const [products, setProducts] = useState(SEED)
  const [announcements, setAnnouncements] = useState(SEED_ANN)

  const [payMethod, setPayMethod] = useState('paypal')
  const [payDone, setPayDone] = useState(false)
  const [orderId, setOrderId] = useState(null)

  const [loggedIn, setLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [adminTab, setAdminTab] = useState('stats')

  const [chatOpen, setChatOpen] = useState(false)
  const [chatMsgs, setChatMsgs] = useState([])
  const [appliedCoupon, setAppliedCoupon] = useState(null)

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
  const reloadProducts = useCallback(async (client) => {
    const supabase = client || supabaseRef.current
    if (!supabase) return
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: true })
    if (!error && Array.isArray(data) && data.length) setProducts(data.map(normalizeProduct))
  }, [])

  const loadAnnouncements = useCallback(async (client) => {
    const supabase = client || supabaseRef.current
    if (!supabase) return
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    if (!error && Array.isArray(data) && data.length) setAnnouncements(data.map(normalizeAnnouncement))
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

  // ---- auth (Supabase) ----
  const applySession = useCallback((session) => {
    accessTokenRef.current = session?.access_token || null
    const u = session?.user
    if (u) {
      const email = (u.email || '').toLowerCase()
      userRef.current = email
      setUser(email)
      setLoggedIn(true)
      setIsAdmin(!!adminEmailRef.current && email === adminEmailRef.current)
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
      loadAnnouncements(supabase)
    })()
    return () => {
      cancelled = true
      sub?.unsubscribe?.()
    }
  }, [applySession, reloadProducts, loadAnnouncements])

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
          const dataBase64 = await fileToBase64(file)
          const up = await fetch('/api/admin/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ filename: file.name, contentType: file.type, dataBase64 }),
          })
          if (!up.ok) return { error: 'Image upload failed.' }
          image_url = (await up.json()).url
        }
        const res = await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...form, image_url }),
        })
        if (!res.ok) return { error: 'Could not publish field.' }
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
      if (res.ok) await reloadProducts()
    },
    [getToken, reloadProducts],
  )

  const addAnnouncement = useCallback(
    async (form) => {
      const r = await authedFetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!r.ok) return { error: 'Could not publish announcement.' }
      await loadAnnouncements()
      return { ok: true }
    },
    [authedFetch, loadAnnouncements],
  )

  const deleteAnnouncement = useCallback(
    async (id) => {
      const r = await authedFetch('/api/admin/announcements/' + id, { method: 'DELETE' })
      if (r.ok) await loadAnnouncements()
    },
    [authedFetch, loadAnnouncements],
  )

  const deleteUser = useCallback(
    async (id) => {
      const r = await authedFetch('/api/admin/users/' + id, { method: 'DELETE' })
      return r.ok
    },
    [authedFetch],
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

  const value = {
    page,
    navigate,
    fieldsCat,
    menuOpen,
    setMenuOpen,
    products,
    reloadProducts,
    addProduct,
    deleteProduct,
    announcements,
    addAnnouncement,
    deleteAnnouncement,
    deleteUser,
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
    loggedIn,
    user,
    isAdmin,
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
