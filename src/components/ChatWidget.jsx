import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/StoreProvider'
import { faqs } from '../data/content'
import { ChatIconBubble, CloseIcon, SendIcon, CheckIcon, DownloadIcon, PayPalMark, BinanceMark } from './icons'

const CHIP_LABELS = [
  'How do they work?',
  'Will I hear the affirmations?',
  'How often should I listen?',
  'When will I see results?',
  'Are they safe?',
  'Can I listen while sleeping?',
]
const CHIPS = faqs.slice(0, 6).map((f, i) => ({ q: CHIP_LABELS[i] || f.q, a: f.a }))
const FOCUS_LABELS = {
  wealth: 'Wealth & abundance',
  confidence: 'Confidence & self-worth',
  attraction: 'Attraction & magnetism',
  success: 'Success & performance',
  focus: 'Focus & productivity',
  sleep: 'Sleep & healing',
  akashic: 'Identity & inner alignment',
  other: 'Something else',
}

const uid = () => 'm' + Math.random().toString(36).slice(2) + Date.now()
const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}
const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

// ---- gold offer card (the field offered by the admin) ----
function OfferCard({ offer, onPay }) {
  if (!offer) return null
  const paid = offer.status === 'paid'
  const delivered = offer.status === 'delivered'
  return (
    <div className={`wf-offer-card${paid || delivered ? ' is-paid' : ''}`}>
      <div className="wf-offer-shine" aria-hidden="true" />
      <div className="wf-offer-eyebrow">✦ A field, made for you</div>
      <div className="wf-offer-name">{offer.name}</div>
      {offer.description && <p className="wf-offer-desc">{offer.description}</p>}
      {offer.includes?.length > 0 && (
        <ul className="wf-offer-includes">
          {offer.includes.map((it, i) => (
            <li key={i}>
              <CheckIcon size={12} stroke={2.6} /> {it}
            </li>
          ))}
        </ul>
      )}
      <div className="wf-offer-row">
        <span className="wf-offer-delivery">Delivery · {offer.deliveryEstimate}</span>
        <span className="wf-offer-price">${offer.amount}</span>
      </div>
      {offer.status === 'sent' ? (
        <button className="wf-offer-pay wf-mag" onClick={() => onPay(offer)}>
          Pay ${offer.amount} →
        </button>
      ) : (
        <div className="wf-offer-state">
          {delivered ? '✓ Field delivered' : '✓ Payment complete · field in production'}
        </div>
      )}
    </div>
  )
}

// ---- delivery reveal card ----
function DeliveryCard({ offer, onDownload }) {
  if (!offer) return null
  return (
    <div className="wf-delivery-card">
      <div className="wf-delivery-shine" aria-hidden="true" />
      <span className="wf-delivery-badge" aria-hidden="true">
        <CheckIcon size={22} stroke={2.6} />
      </span>
      <div className="wf-delivery-eyebrow">Your field has arrived</div>
      <div className="wf-delivery-name">{offer.name}</div>
      {offer.deliveryNote && <p className="wf-delivery-note">{offer.deliveryNote}</p>}
      {offer.deliveryFileName && <span className="wf-delivery-file">📄 {offer.deliveryFileName}</span>}
      <button className="wf-offer-pay wf-mag" onClick={() => onDownload(offer)} style={{ marginTop: 14 }}>
        <DownloadIcon size={15} /> Download field
      </button>
    </div>
  )
}

export default function ChatWidget() {
  const { chatOpen, setChatOpen, conversationId, userEmail, chatRequest, clearChatRequest, pushNotification } = useStore()
  const [msgs, setMsgs] = useState([])
  const [offers, setOffers] = useState({})
  const [typing, setTyping] = useState(false)
  const [text, setText] = useState('')
  const [unread, setUnread] = useState(false)
  const [checkout, setCheckout] = useState(null) // { offerId, step, method, reference, amount, payee, binance }
  const listRef = useRef(null)
  const timers = useRef([])
  const seen = useRef(new Set())
  const greetedRef = useRef(false)
  const offersRef = useRef({})

  const later = (fn, ms) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }
  const addMsg = (m) => {
    const id = uid()
    setMsgs((p) => [...p, { id, time: nowTime(), ...m }])
    return id
  }
  const patchMsg = (id, patch) => setMsgs((p) => p.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  const removeMsg = (id) => {
    patchMsg(id, { leaving: true })
    later(() => setMsgs((p) => p.filter((m) => m.id !== id)), 450)
  }

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  useEffect(() => {
    let opened = false
    try {
      opened = sessionStorage.getItem('wf_chat_opened') === '1'
    } catch {
      /* ignore */
    }
    if (opened) return
    const id = setTimeout(() => setUnread(true), 800)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!chatOpen) return
    setUnread(false)
    try {
      sessionStorage.setItem('wf_chat_opened', '1')
    } catch {
      /* ignore */
    }
    if (!greetedRef.current) {
      greetedRef.current = true
      addMsg({
        from: 'bot',
        text: `${greeting()} ✨ Welcome to Waslerr Fields. Tap a question below for an instant answer, or send a message and the team will reply shortly.`,
      })
    }
  }, [chatOpen])

  // poll for admin replies + typed cards (offers) while open
  useEffect(() => {
    if (!chatOpen || !conversationId) return
    const poll = async () => {
      try {
        const r = await fetch('/api/chat/messages?conversationId=' + encodeURIComponent(conversationId))
        if (!r.ok) return
        const d = await r.json()
        const offMap = {}
        ;(d.offers || []).forEach((o) => (offMap[o.id] = o))
        offersRef.current = offMap
        setOffers(offMap)
        ;(d.messages || []).forEach((m) => {
          if (!m.id || seen.current.has(m.id)) return
          if (m.kind === 'text' && m.from === 'admin') {
            seen.current.add(m.id)
            addMsg({ from: 'bot', admin: true, text: m.text })
          } else if (m.kind === 'offer' && m.meta?.offerId) {
            seen.current.add(m.id)
            addMsg({ from: 'bot', kind: 'offer', offerId: m.meta.offerId })
          } else if (m.kind === 'systemPaid' && m.meta?.offerId) {
            seen.current.add(m.id)
            addMsg({ kind: 'systemPaid', text: m.text })
          } else if (m.kind === 'delivery' && m.meta?.offerId) {
            seen.current.add(m.id)
            addMsg({ from: 'bot', kind: 'delivery', offerId: m.meta.offerId })
          }
        })
      } catch {
        /* ignore */
      }
    }
    poll()
    const t = setInterval(poll, 4000)
    return () => clearInterval(t)
  }, [chatOpen, conversationId])

  // Custom Code request routed into the chat
  useEffect(() => {
    if (!chatRequest) return
    const { name, email, focus, intention } = chatRequest
    const label = FOCUS_LABELS[focus] || 'Something else'
    const uId = addMsg({ from: 'user', eyebrow: '✦ Custom Code request', text: `${label} — ${intention}`, status: 'Sending request…' })
    if (conversationId) {
      fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, email: email || userEmail || null, text: `✦ CUSTOM CODE REQUEST\nFocus: ${label}\n${intention}` }),
      }).catch(() => {})
    }
    later(() => patchMsg(uId, { status: '✓ Delivered' }), 600)
    later(() => setTyping(true), 1100)
    later(() => {
      setTyping(false)
      addMsg({
        from: 'bot',
        text: `Got it, ${name || 'there'} — your Custom Code request has been logged. An admin will review it and send you a field offer right here, with a price and delivery time.`,
      })
    }, 1800)
    clearChatRequest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatRequest])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [msgs, typing])

  const faqTap = (c) => {
    addMsg({ from: 'user', text: c.q })
    setTyping(true)
    later(() => {
      setTyping(false)
      addMsg({ from: 'bot', text: c.a })
    }, 650)
  }

  const sendTyped = (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    setText('')
    const uId = addMsg({ from: 'user', text: t, status: 'Sending…' })
    if (conversationId) {
      fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, email: userEmail || null, text: t }),
      }).catch(() => {})
    }
    pushNotification({ type: 'reply', title: 'Support is on it', body: 'Your message reached the team — we’ll reply right here shortly.', href: 'chat' })
    later(() => patchMsg(uId, { status: '✓ Delivered' }), 600)
    later(() => setTyping(true), 1600)
    later(() => {
      setTyping(false)
      const hId = addMsg({
        from: 'bot',
        text: 'Thanks for reaching out — your message is with the team. An admin will reply here soon.',
      })
      later(() => removeMsg(hId), 10000)
    }, 2300)
  }

  const downloadOffer = (offer) => {
    window.open(`/api/offers/${offer.id}/download?conversationId=${encodeURIComponent(conversationId)}`, '_blank')
  }

  return (
    <>
      {chatOpen && (
        <div className="wf-chat-panel" role="dialog" aria-label="Waslerr support">
          <div className="wf-chat-header">
            <div className="wf-chat-id">
              <span className="wf-chat-avatar">
                W<span className="wf-chat-online" />
              </span>
              <span>
                <span className="wf-chat-title">Waslerr support</span>
                <span className="wf-chat-meta">Online · typically replies in minutes</span>
              </span>
            </div>
            <button className="wf-chat-close" aria-label="Close chat" onClick={() => setChatOpen(false)}>
              <CloseIcon />
            </button>
          </div>

          <div className="wf-chat-list" ref={listRef}>
            {msgs.map((m) => {
              if (m.kind === 'offer') {
                return (
                  <div key={m.id} className="wf-cmsg wf-cmsg--bot wf-cmsg--card">
                    <OfferCard offer={offers[m.offerId]} onPay={(o) => setCheckout({ offerId: o.id, step: 'method', method: 'paypal' })} />
                  </div>
                )
              }
              if (m.kind === 'systemPaid') {
                return (
                  <div key={m.id} className="wf-cmsg wf-cmsg--system">
                    <span className="wf-sys-pill">✓ {m.text}</span>
                  </div>
                )
              }
              if (m.kind === 'delivery') {
                return (
                  <div key={m.id} className="wf-cmsg wf-cmsg--bot wf-cmsg--card">
                    <DeliveryCard offer={offers[m.offerId]} onDownload={downloadOffer} />
                  </div>
                )
              }
              return (
                <div key={m.id} className={`wf-cmsg wf-cmsg--${m.from}${m.leaving ? ' leaving' : ''}`}>
                  <div className="wf-cmsg-row">
                    {m.from === 'bot' && <span className="wf-cmsg-av">W</span>}
                    <div className="wf-cmsg-bubble">
                      {m.eyebrow && <span className="wf-cmsg-eyebrow">{m.eyebrow}</span>}
                      {m.admin && <span className="wf-cmsg-who">Waslerr team</span>}
                      {m.text}
                    </div>
                  </div>
                  <div className="wf-cmsg-meta">{m.status || m.time}</div>
                </div>
              )
            })}
            {typing && (
              <div className="wf-cmsg wf-cmsg--bot">
                <div className="wf-cmsg-row">
                  <span className="wf-cmsg-av">W</span>
                  <div className="wf-cmsg-bubble wf-typing" aria-label="typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="wf-chip-row">
            {CHIPS.map((c) => (
              <button key={c.q} className="wf-chip-q" onClick={() => faqTap(c)}>
                {c.q}
              </button>
            ))}
          </div>

          <form className="wf-chat-input" onSubmit={sendTyped}>
            <input className="wf-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about a field…" />
            <button className="wf-chat-send" type="submit" aria-label="Send message">
              <SendIcon />
            </button>
          </form>

          {checkout && (
            <CheckoutPanel
              checkout={checkout}
              setCheckout={setCheckout}
              onPaid={(offerId) => {
                // optimistic: reflect paid immediately; the poll appends systemPaid
                setOffers((prev) => ({ ...prev, [offerId]: { ...prev[offerId], status: 'paid' } }))
                setCheckout(null)
              }}
            />
          )}
        </div>
      )}

      <button
        className={`wf-fab${chatOpen ? ' open' : ''}`}
        aria-label={chatOpen ? 'Close support chat' : 'Open support chat'}
        onClick={() => setChatOpen(!chatOpen)}
      >
        {!chatOpen && <span className="wf-fab-ring" aria-hidden="true" />}
        {!chatOpen && unread && <span className="wf-fab-badge">1</span>}
        {chatOpen ? <CloseIcon size={20} /> : <ChatIconBubble />}
      </button>
    </>
  )
}

// ---- in-widget secure checkout (slide-up) ----
function CheckoutPanel({ checkout, setCheckout, onPaid }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [countdown, setCountdown] = useState(15 * 60)
  const [copying, setCopying] = useState(null)
  const [phase, setPhase] = useState('waiting') // waiting | confirming | paid
  const [fallbackOpen, setFallbackOpen] = useState(false)
  const [txn, setTxn] = useState('')
  const [txnMsg, setTxnMsg] = useState('')
  const pollRef = useRef(null)
  const { offerId, step, method, reference, amount, payee, binance } = checkout

  // countdown during pay step
  useEffect(() => {
    if (step !== 'pay') return
    const id = setInterval(() => setCountdown((p) => (p <= 1 ? 0 : p - 1)), 1000)
    return () => clearInterval(id)
  }, [step])

  // poll the offer status during pay step
  useEffect(() => {
    if (step !== 'pay' || !offerId) return
    const tick = async () => {
      try {
        const r = await fetch(`/api/offers/${offerId}/status`)
        if (!r.ok) return
        const d = await r.json()
        if (d.status === 'paid' || d.status === 'delivered') {
          setPhase('paid')
          clearInterval(pollRef.current)
          setTimeout(() => onPaid(offerId), 1200)
        }
      } catch {
        /* keep polling */
      }
    }
    tick()
    pollRef.current = setInterval(tick, 4000)
    return () => clearInterval(pollRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, offerId])

  const startPay = async (m) => {
    setBusy(true)
    setErr('')
    try {
      const r = await fetch(`/api/offers/${offerId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: m }),
      })
      const d = await r.json().catch(() => ({}))
      setBusy(false)
      if (!r.ok || !d.reference) {
        setErr(d.detail || 'Could not start checkout.')
        return
      }
      setCheckout({ ...checkout, step: 'pay', method: m, reference: d.reference, amount: d.amount, payee: d.payee, binance: d.binance })
      setCountdown(15 * 60)
    } catch {
      setBusy(false)
      setErr('Network error. Please try again.')
    }
  }

  const copy = async (val, key) => {
    try {
      await navigator.clipboard.writeText(String(val))
    } catch {
      /* noop */
    }
    setCopying(key)
    setTimeout(() => setCopying((k) => (k === key ? null : k)), 1600)
  }

  const submitTxn = async () => {
    if (txn.trim().length < 6) return setTxnMsg('Enter a valid Transaction ID.')
    setTxnMsg('')
    setPhase('confirming')
    try {
      const r = await fetch(`/api/offers/${offerId}/verify-txid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txid: txn.trim() }),
      })
      const d = await r.json().catch(() => ({}))
      if (d.status === 'paid' || d.status === 'delivered') {
        setPhase('paid')
        setTimeout(() => onPaid(offerId), 1000)
      } else {
        setPhase('waiting')
        setTxnMsg('Not confirmed yet — we keep checking automatically.')
      }
    } catch {
      setPhase('waiting')
      setTxnMsg('Network error.')
    }
  }

  const payTarget = payee?.binanceId || payee?.paypalEmail || ''
  const payTargetLabel = payee?.binanceId ? 'Binance Pay UID' : 'PayPal email'

  return (
    <div className="wf-cocheckout">
      <div className="wf-cocheckout-head">
        <span>Secure checkout</span>
        <button className="wf-chat-close" aria-label="Close checkout" onClick={() => setCheckout(null)}>
          <CloseIcon size={16} />
        </button>
      </div>

      {step === 'method' && (
        <div className="wf-cocheckout-body">
          <div className="wf-co-mini-label">Choose how to pay</div>
          {[
            { id: 'paypal', label: 'PayPal', sub: 'Balance or any card' },
            { id: 'binance', label: 'Binance Pay', sub: 'Crypto — USDT / BTC / BNB' },
          ].map((m) => (
            <button key={m.id} className="wf-co-mini-method" disabled={busy} onClick={() => startPay(m.id)}>
              <span className={`wf-co-mini-mark ${m.id}`}>{m.id === 'paypal' ? <PayPalMark size={22} /> : <BinanceMark size={26} />}</span>
              <span className="wf-co-mini-text">
                <span className="wf-co-mini-name">{m.label}</span>
                <span className="wf-co-mini-sub">{m.sub}</span>
              </span>
              <span className="wf-co-mini-arrow">{busy ? '…' : '→'}</span>
            </button>
          ))}
          {err && <p className="wf-auth-error" style={{ margin: '4px 0 0' }}>{err}</p>}
        </div>
      )}

      {step === 'pay' && (
        <div className="wf-cocheckout-body">
          {phase === 'paid' ? (
            <div className="wf-co-mini-success">
              <span className="wf-co-mini-check">
                <CheckIcon size={26} stroke={2.6} />
              </span>
              <div className="wf-co-mini-name">Payment confirmed</div>
              <p className="wf-co-mini-sub">Your field has entered production.</p>
            </div>
          ) : (
            <>
              <div className="wf-co-mini-amount">
                <span>Amount</span>
                <strong>${amount}</strong>
              </div>
              <div className="wf-co-mini-rows">
                <div className="wf-co-mini-row">
                  <span className="wf-co-mini-rlabel">{payTargetLabel}</span>
                  <span className="wf-co-mini-rval">{payTarget}</span>
                  <button className={`wf-payto-copy${copying === 't' ? ' copied' : ''}`} onClick={() => copy(payTarget, 't')}>
                    {copying === 't' ? <CheckIcon size={12} stroke={2.5} /> : 'Copy'}
                  </button>
                </div>
                <div className="wf-co-mini-row">
                  <span className="wf-co-mini-rlabel">Note / reference</span>
                  <span className="wf-co-mini-rval mono">{reference}</span>
                  <button className={`wf-payto-copy${copying === 'r' ? ' copied' : ''}`} onClick={() => copy(reference, 'r')}>
                    {copying === 'r' ? <CheckIcon size={12} stroke={2.5} /> : 'Copy'}
                  </button>
                </div>
              </div>

              {method === 'binance' && binance?.checkoutUrl && (
                <a className="wf-offer-pay wf-mag" href={binance.checkoutUrl} target="_blank" rel="noreferrer" style={{ marginTop: 4 }}>
                  Pay instantly in Binance →
                </a>
              )}

              <div className="wf-co-mini-watch">
                <span className="wf-co-mini-spinner" aria-hidden="true" />
                {phase === 'confirming' ? 'Confirming…' : `Waiting for payment · ${fmtTime(countdown)}`}
              </div>
              <p className="wf-co-mini-hint">Send the exact amount with the reference in the note — we detect it automatically.</p>

              {!fallbackOpen ? (
                <button className="wf-co-mini-fallback" onClick={() => setFallbackOpen(true)}>
                  Taking too long? Submit transaction ID
                </button>
              ) : (
                <div className="wf-co-mini-txn">
                  <input className="wf-input" value={txn} onChange={(e) => setTxn(e.target.value)} placeholder="Transaction ID…" />
                  <button className="wf-offer-pay wf-mag" onClick={submitTxn}>
                    Verify →
                  </button>
                </div>
              )}
              {txnMsg && <p className="wf-auth-error" style={{ margin: '2px 0 0', textAlign: 'center' }}>{txnMsg}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
