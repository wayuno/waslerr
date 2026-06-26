import { useEffect, useState } from 'react'
import { useStore } from '../store/StoreProvider'

// primary nav links (existing sections preserved, "What's new" added)
const NAV_LINKS = [
  { label: 'Fields', target: { page: 'fields' } },
  { label: 'Method', target: { page: 'method' } },
  { label: "What's new", target: { page: 'updates' } },
  { label: 'Reviews', target: { page: 'home', section: 'wf-reviews' } },
  { label: 'Custom', target: { page: 'home', section: 'wf-custom' } },
  { label: 'Community', target: { page: 'home', section: 'wf-join' } },
  { label: 'FAQ', chat: true },
]

export default function Nav() {
  const { page, navigate, loggedIn, isAdmin, authReady, logout, openChat } = useStore()
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
  const isActive = (target) => !!target && target.page === page && !target.section

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
                key={l.label}
                className={`wf-navlink${isActive(l.target) ? ' active' : ''}`}
                onClick={() => handleLink(l)}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="wf-nav-cluster">
            {authReady && !loggedIn && (
              <button className={`wf-navlink${page === 'login' ? ' active' : ''}`} onClick={() => go({ page: 'login' })}>
                Sign in
              </button>
            )}
            {authReady && loggedIn && isAdmin && (
              <button className={`wf-navlink${page === 'admin' ? ' active' : ''}`} onClick={() => go({ page: 'admin' })}>
                Admin
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
                Sign out
              </button>
            )}
            <button className="wf-nav-cta wf-mag" onClick={() => go({ page: 'fields' })}>
              Begin
            </button>
          </div>
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

      <div className={`wf-mobile-menu${menuOpen ? ' open' : ''}`}>
        {NAV_LINKS.map((l, i) => (
          <button
            key={l.label}
            className="wf-mlink"
            style={{ animation: menuOpen ? `wf-fadeup .4s ease ${0.04 + i * 0.05}s both` : undefined }}
            onClick={() => handleLink(l)}
          >
            {l.label}
          </button>
        ))}
        <button
          className="wf-mlink"
          onClick={() => {
            setMenuOpen(false)
            openChat()
          }}
        >
          Chat with support
        </button>
        {authReady && !loggedIn && (
          <button className="wf-mlink" onClick={() => go({ page: 'login' })}>
            Sign in
          </button>
        )}
        {authReady && loggedIn && isAdmin && (
          <button className="wf-mlink" onClick={() => go({ page: 'admin' })}>
            Admin panel
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
            Sign out
          </button>
        )}
        <button className="wf-mlink wf-mlink--cta" onClick={() => go({ page: 'fields' })}>
          Begin
        </button>
      </div>
    </nav>
  )
}
