import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/StoreProvider'
import { faqs } from '../data/content'
import { ChatIconBubble, CloseIcon, SendIcon } from './icons'

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

export default function ChatWidget() {
  const { chatOpen, setChatOpen, conversationId, userEmail, chatRequest, clearChatRequest, pushNotification } = useStore()
  const [msgs, setMsgs] = useState([])
  const [typing, setTyping] = useState(false)
  const [text, setText] = useState('')
  const [unread, setUnread] = useState(false)
  const listRef = useRef(null)
  const timers = useRef([])
  const seenAdmin = useRef(new Set())
  const greetedRef = useRef(false)

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

  // clear all timers on unmount
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // unread badge ~0.8s after load; hidden once the chat is opened (per session)
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

  // time-aware greeting on first open (once per session)
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

  // poll for admin replies while open; append new ones
  useEffect(() => {
    if (!chatOpen || !conversationId) return
    const poll = async () => {
      try {
        const r = await fetch('/api/chat/messages?conversationId=' + encodeURIComponent(conversationId))
        if (!r.ok) return
        const d = await r.json()
        ;(d.messages || []).forEach((m) => {
          if (m.from === 'admin' && m.id && !seenAdmin.current.has(m.id)) {
            seenAdmin.current.add(m.id)
            addMsg({ from: 'bot', admin: true, text: m.text })
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
        text: `Got it, ${name || 'there'} — your Custom Code request has been logged. It'll be reviewed by an admin shortly, and we'll email a scope to ${email} within 7 days.`,
      })
    }, 1800)
    clearChatRequest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatRequest])

  // keep pinned to latest
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
        text: 'Thanks for reaching out — your message is with the team. An admin will reply here soon. In the meantime, the questions below answer most things instantly.',
      })
      later(() => removeMsg(hId), 10000)
    }, 2300)
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
            {msgs.map((m) => (
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
            ))}
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
