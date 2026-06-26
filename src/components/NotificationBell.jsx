import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/StoreProvider'
import { BellIcon, DiscIcon, MegaphoneIcon, TagIcon, ChatIconBubble } from './icons'

const TYPE_ICON = { release: DiscIcon, announce: MegaphoneIcon, offer: TagIcon, reply: ChatIconBubble }
const relTime = (ts) => {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return m + 'm ago'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'h ago'
  return Math.floor(h / 24) + 'd ago'
}

export default function NotificationBell() {
  const { notifications, unreadCount, notifReadAt, markNotifsRead, navigate, openChat } = useStore()
  const [open, setOpen] = useState(false)
  const [shake, setShake] = useState(false)
  const wrapRef = useRef(null)
  const prevCount = useRef(notifications.length)

  // attention shake when a notification arrives programmatically
  useEffect(() => {
    if (notifications.length > prevCount.current) {
      setShake(true)
      const t = setTimeout(() => setShake(false), 700)
      prevCount.current = notifications.length
      return () => clearTimeout(t)
    }
    prevCount.current = notifications.length
  }, [notifications.length])

  // dismiss on outside click / Esc
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openRow = (n) => {
    setOpen(false)
    markNotifsRead()
    if (n.href === 'chat') openChat()
    else if (n.href) navigate({ page: n.href })
  }

  const badge = unreadCount > 9 ? '9+' : String(unreadCount)

  return (
    <div className="wf-notif" ref={wrapRef}>
      <button
        className={`wf-notif-btn${unreadCount > 0 ? ' has-unread' : ''}${shake ? ' shake' : ''}`}
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <BellIcon />
        {unreadCount > 0 && <span className="wf-notif-badge">{badge}</span>}
      </button>

      {open && (
        <div className="wf-notif-panel" role="dialog" aria-label="Notifications">
          <div className="wf-notif-head">
            <span className="wf-notif-h-title">Notifications</span>
            {unreadCount > 0 && (
              <button className="wf-notif-markall" onClick={markNotifsRead}>
                Mark all read
              </button>
            )}
          </div>
          <div className="wf-notif-list">
            {notifications.length === 0 && <div className="wf-notif-empty">You&apos;re all caught up.</div>}
            {notifications.map((n, i) => {
              const Icon = TYPE_ICON[n.type] || MegaphoneIcon
              const unread = n.ts > notifReadAt
              return (
                <button
                  key={n.id}
                  className={`wf-notif-row${unread ? ' unread' : ''}`}
                  style={{ animationDelay: `${i * 0.05}s`, '--shdelay': `${(i % 4) * 0.6}s` }}
                  onClick={() => openRow(n)}
                >
                  {unread && <span className="wf-notif-shimmer" aria-hidden="true" />}
                  <span className="wf-notif-ico">
                    <Icon />
                  </span>
                  <span className="wf-notif-content">
                    <span className="wf-notif-title">
                      {n.title}
                      {unread && <span className="wf-notif-dot" />}
                    </span>
                    {n.body && <span className="wf-notif-body">{n.body}</span>}
                    <span className="wf-notif-time">{relTime(n.ts)}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
