import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { allFields, freeFields, topPicks } from '../data/content'

// Single source of truth for routing, catalogue, auth, payment and the shared
// support thread. Demo-only: no backend — auth/payments are mocked and the
// catalogue + chat live in memory (reset on reload).
const StoreCtx = createContext(null)

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
  const [pendingAdmin, setPendingAdmin] = useState(false)
  const [adminTab, setAdminTab] = useState('stats')

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

  const login = useCallback(
    (email) => {
      setUser(email)
      setLoggedIn(true)
      if (pendingAdmin) {
        setPendingAdmin(false)
        navigate('admin')
      } else {
        navigate('home')
      }
    },
    [pendingAdmin, navigate],
  )

  const logout = useCallback(() => {
    setLoggedIn(false)
    setUser(null)
    navigate('home')
  }, [navigate])

  const requireAdmin = useCallback(() => {
    if (loggedIn) navigate('admin')
    else {
      setPendingAdmin(true)
      navigate('login')
    }
  }, [loggedIn, navigate])

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
