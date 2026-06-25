import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { allFields, freeFields, topPicks } from '../data/content'

// Single source of truth for routing, catalogue, auth, payment and the shared
// support thread. Admin auth is REAL (server-side): logging in as admin requires
// the secret password checked by the backend, which returns a signed token.
// Catalogue + chat are still demo/in-memory (reset on reload).
const StoreCtx = createContext(null)

const TOKEN_KEY = 'wf_admin_token'

const initialProducts = () => allFields.map((f) => ({ ...f }))

export function StoreProvider({ children }) {
  const [page, setPage] = useState('home')
  const [fieldsCat, setFieldsCat] = useState('all')
  const [menuOpen, setMenuOpen] = useState(false)

  const [selectedId, setSelectedId] = useState(null)
  const [products, setProducts] = useState(initialProducts)

  const [payMethod, setPayMethod] = useState('paypal')
  const [payDone, setPayDone] = useState(false)
  const [orderId, setOrderId] = useState(null)

  const [loggedIn, setLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminTab, setAdminTab] = useState('stats')
  const tokenRef = useRef(typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null)

  const [chatOpen, setChatOpen] = useState(false)
  const [chatMsgs, setChatMsgs] = useState([
    { from: 'support', text: 'Hi — I’m here if you have any questions about the fields.' },
  ])

  const pendingSection = useRef(null)
  const idCounter = useRef(1)

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

  // jump to top, or to a requested section once the page has rendered
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

  // catalogue lookup across managed products + free fields + top picks
  const findProduct = useCallback(
    (id) => [...products, ...freeFields, ...topPicks].find((f) => f.id === id) || null,
    [products],
  )
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
      navigate({ page: 'checkout', ...(id != null ? { id } : {}) })
    },
    [navigate],
  )

  const pay = useCallback(() => {
    setOrderId('WF-' + (1000 + Math.floor(Math.random() * 9000)))
    setPayDone(true)
  }, [])

  // Admin login is verified by the backend (secret password). On success we get
  // a signed token and unlock the dashboard. Anything else is a regular
  // (demo) customer session with no admin access.
  const login = useCallback(
    async (email, password) => {
      const mail = (email || '').trim()
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: mail, password: password || '' }),
        })
        if (res.ok) {
          const data = await res.json()
          tokenRef.current = data.token
          try {
            localStorage.setItem(TOKEN_KEY, data.token)
          } catch {
            /* ignore */
          }
          setUser(data.email || mail)
          setLoggedIn(true)
          setIsAdmin(true)
          navigate('admin')
          return { admin: true }
        }
      } catch {
        /* backend unreachable — fall through to a demo customer session */
      }
      // regular customer (demo) session — no admin; drop any stale admin token
      tokenRef.current = null
      try {
        localStorage.removeItem(TOKEN_KEY)
      } catch {
        /* ignore */
      }
      setUser(mail)
      setLoggedIn(true)
      setIsAdmin(false)
      navigate('home')
      return { admin: false }
    },
    [navigate],
  )

  const logout = useCallback(() => {
    tokenRef.current = null
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
    setLoggedIn(false)
    setUser(null)
    setIsAdmin(false)
    navigate('home')
  }, [navigate])

  const requireAdmin = useCallback(() => {
    if (loggedIn && isAdmin) navigate('admin')
    else navigate('login')
  }, [loggedIn, isAdmin, navigate])

  // restore an admin session from a stored token (verified server-side)
  useEffect(() => {
    const token = tokenRef.current
    if (!token) return
    let cancelled = false
    fetch('/api/admin/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return
        if (d && d.admin) {
          setLoggedIn(true)
          setUser(d.email)
          setIsAdmin(true)
        } else {
          tokenRef.current = null
          try {
            localStorage.removeItem(TOKEN_KEY)
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const addProduct = useCallback((p) => {
    const id = 'wf-new-' + idCounter.current++
    setProducts((prev) => [{ id, freq: 200, ...p }, ...prev])
  }, [])

  const deleteProduct = useCallback((id) => {
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const sendUserChat = useCallback((text) => {
    const t = text.trim()
    if (!t) return
    setChatMsgs((prev) => [...prev, { from: 'user', text: t }])
    setTimeout(() => {
      setChatMsgs((prev) => [
        ...prev,
        {
          from: 'support',
          text: 'Thanks for reaching out — a guide will be with you shortly. Which field are you drawn to?',
        },
      ])
    }, 1300)
  }, [])

  const sendAdminReply = useCallback((text) => {
    const t = text.trim()
    if (!t) return
    setChatMsgs((prev) => [...prev, { from: 'admin', text: t }])
  }, [])

  const openChat = useCallback(() => setChatOpen(true), [])

  const value = {
    page,
    navigate,
    fieldsCat,
    menuOpen,
    setMenuOpen,
    products,
    addProduct,
    deleteProduct,
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
    login,
    logout,
    requireAdmin,
    adminTab,
    setAdminTab,
    chatOpen,
    setChatOpen,
    openChat,
    chatMsgs,
    sendUserChat,
    sendAdminReply,
  }

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  return useContext(StoreCtx)
}
