import { useEffect, useState } from 'react'
import { useStore } from '../store/StoreProvider'
import { useT } from '../lib/i18n'
import { CloseIcon } from './icons'
import NotificationBell from './NotificationBell'
import CartButton from './CartButton'
import LanguageSwitcher from './LanguageSwitcher'

// primary nav links for the DESKTOP bar (unchanged). Labels are i18n keys.
const NAV_LINKS = [
  { key: 'nav.fields', target: { page: 'fields' } },
  { key: 'nav.method', target: { page: 'method' } },
  { key: 'nav.updates', target: { page: 'updates' } },
  { key: 'nav.reviews', target: { page: 'reviews' } },
  { key: 'nav.custom', target: { page: 'home', section: 'wf-custom' } },
  { key: 'nav.community', target: { page: 'community' } },
  { key: 'nav.faq', chat: true },
]

// ---- menu glyphs (Lucide-style, 1.6px stroke) ----
const Svg = ({ children }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)
const IcFields = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
)
const IcMethod = () => (
  <Svg>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <circle cx="3.6" cy="6" r="1.1" />
    <circle cx="3.6" cy="12" r="1.1" />
    <circle cx="3.6" cy="18" r="1.1" />
  </Svg>
)
const IcNew = () => (
  <Svg>
    <path d="M12 3l1.7 4.8L18.5 9.5 13.7 11.2 12 16l-1.7-4.8L5.5 9.5l4.8-1.7z" />
    <path d="M19 14l.5 1.6L21 16l-1.5.4L19 18l-.5-1.6L17 16l1.5-.4z" />
  </Svg>
)
const IcReviews = () => (
  <Svg>
    <path d="M12 3.2l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.9 6.6 19.4l1.2-5.9L3.4 9.4l6-.7z" />
  </Svg>
)
const IcCommunity = () => (
  <Svg>
    <path d="M16 18v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 16.5V18" />
    <circle cx="10" cy="8" r="3" />
    <path d="M20 18v-1.5a3.5 3.5 0 0 0-2.6-3.4M16 5.2a3 3 0 0 1 0 5.8" />
  </Svg>
)
const IcCustom = () => (
  <Svg>
    <path d="M20 12v9H4v-9" />
    <path d="M2 7h20v5H2z" />
    <path d="M12 22V7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </Svg>
)
const IcFaq = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.2 9a3 3 0 0 1 5.7 1c0 2-3 2.4-3 4" />
    <path d="M12 17h.01" />
  </Svg>
)
const IcChat = () => (
  <Svg>
    <path d="M21 11.5a8.4 8.4 0 0 1-11.7 7.7L3 21l1.8-6.3A8.4 8.4 0 1 1 21 11.5z" />
  </Svg>
)
const IcUser = () => (
  <Svg>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
  </Svg>
)
const IcSignout = () => (
  <Svg>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </Svg>
)
const IcShield = () => (
  <Svg>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </Svg>
)

export default function Nav() {
  const { page, navigate, loggedIn, isAdmin, authReady, logout, openChat } = useStore()
  const t = useT()
  const [scrolled, setScrolled] = useState(page !== 'home')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (page !== 'home') {
      setScrolled(true)
      return
    }
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [page])

  // lock background scroll while the drawer is open + close on Esc
  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const go = (target) => {
    setMenuOpen(false)
    navigate(target)
  }
  const handleLink = (l) => {
    if (l.chat) {
      setMenuOpen(false)
      openChat()
    } else {
      go(l.target)
    }
  }
  const startChat = () => {
    setMenuOpen(false)
    openChat()
  }
  const isActive = (target) => !!target && target.page === page && !target.section

  // grouped sections for the mobile drawer
  const browse = [
    { key: 'nav.fields', icon: <IcFields />, onClick: () => go({ page: 'fields' }), active: page === 'fields' },
    { key: 'nav.method', icon: <IcMethod />, onClick: () => go({ page: 'method' }), active: page === 'method' },
    { key: 'nav.updates', icon: <IcNew />, onClick: () => go({ page: 'updates' }), active: page === 'updates' },
    { key: 'nav.reviews', icon: <IcReviews />, onClick: () => go({ page: 'reviews' }), active: page === 'reviews' },
    { key: 'nav.community', icon: <IcCommunity />, onClick: () => go({ page: 'community' }), active: page === 'community' },
  ]

  return (
    <nav className={`wf-nav${scrolled ? ' scrolled' : ''}`}>
      <div className="wf-nav-inner">
        <button className="wf-brand" onClick={() => go({ page: 'home' })} aria-label="Waslerr Fields home">
          <span className="wf-monogram">W</span>
          <span className="wf-wordmark">WASLERR&nbsp;FIELDS</span>
        </button>

        <div className="wf-nav-desktop">
          <div className="wf-navlinks">
            {NAV_LINKS.map((l) => (
              <button
                key={l.key}
                className={`wf-navlink${isActive(l.target) ? ' active' : ''}`}
                onClick={() => handleLink(l)}
              >
                {t(l.key)}
              </button>
            ))}
          </div>
          <div className="wf-nav-cluster">
            {authReady && !loggedIn && (
              <button className={`wf-navlink${page === 'login' ? ' active' : ''}`} onClick={() => go({ page: 'login' })}>
                {t('nav.signin')}
              </button>
            )}
            {authReady && loggedIn && isAdmin && (
              <button className={`wf-navlink${page === 'admin' ? ' active' : ''}`} onClick={() => go({ page: 'admin' })}>
                {t('nav.admin')}
              </button>
            )}
            {authReady && loggedIn && !isAdmin && (
              <button
                className="wf-navlink"
                onClick={() => {
                  setMenuOpen(false)
                  logout()
                }}
              >
                {t('nav.signout')}
              </button>
            )}
            <NotificationBell />
            <CartButton />
            <button className="wf-nav-cta wf-mag" onClick={() => go({ page: 'fields' })}>
              {t('nav.begin')}
            </button>
          </div>
        </div>

        <div className="wf-notif-mobile">
          <NotificationBell />
          <CartButton />
        </div>
        <button
          className={`wf-burger${menuOpen ? ' open' : ''}`}
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* ---- Mobile drawer ---- */}
      <div
        className={`wf-mobile-menu${menuOpen ? ' open' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setMenuOpen(false)
        }}
      >
        <aside className="wf-mm-drawer" role="dialog" aria-label="Menu">
          <div className="wf-mm-head">
            <span className="wf-monogram">W</span>
            <button className="wf-mm-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
              <CloseIcon size={18} />
            </button>
          </div>

          <div className="wf-mm-scroll">
            <div className="wf-mm-label">{t('menu.browse')}</div>
            {browse.map((r) => (
              <button key={r.key} className={`wf-mlink${r.active ? ' active' : ''}`} onClick={r.onClick}>
                <span className="wf-mlink-ic">{r.icon}</span>
                <span className="wf-mlink-label">{t(r.key)}</span>
              </button>
            ))}

            <div className="wf-mm-label">{t('menu.account')}</div>
            <button className="wf-mlink" onClick={() => go({ page: 'home', section: 'wf-custom' })}>
              <span className="wf-mlink-ic">
                <IcCustom />
              </span>
              <span className="wf-mlink-label">{t('nav.custom')}</span>
            </button>
            {authReady && !loggedIn && (
              <button className={`wf-mlink${page === 'login' ? ' active' : ''}`} onClick={() => go({ page: 'login' })}>
                <span className="wf-mlink-ic">
                  <IcUser />
                </span>
                <span className="wf-mlink-label">{t('nav.signin')}</span>
              </button>
            )}
            {authReady && loggedIn && isAdmin && (
              <button className={`wf-mlink${page === 'admin' ? ' active' : ''}`} onClick={() => go({ page: 'admin' })}>
                <span className="wf-mlink-ic">
                  <IcShield />
                </span>
                <span className="wf-mlink-label">{t('nav.adminPanel')}</span>
              </button>
            )}
            {authReady && loggedIn && (
              <button
                className="wf-mlink"
                onClick={() => {
                  setMenuOpen(false)
                  logout()
                }}
              >
                <span className="wf-mlink-ic">
                  <IcSignout />
                </span>
                <span className="wf-mlink-label">{t('nav.signout')}</span>
              </button>
            )}

            <div className="wf-mm-label">{t('menu.support')}</div>
            <button className="wf-mlink" onClick={startChat}>
              <span className="wf-mlink-ic">
                <IcFaq />
              </span>
              <span className="wf-mlink-label">{t('nav.faq')}</span>
            </button>
            <button className="wf-mlink" onClick={startChat}>
              <span className="wf-mlink-ic">
                <IcChat />
              </span>
              <span className="wf-mlink-label">{t('nav.chat')}</span>
            </button>

            <button className="wf-mlink wf-mlink--cta" onClick={() => go({ page: 'fields' })}>
              {t('nav.begin')}
            </button>
          </div>

          <div className="wf-mm-foot">
            <LanguageSwitcher />
          </div>
        </aside>
      </div>
    </nav>
  )
}
