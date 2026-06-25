import { useEffect, useState } from 'react'

const LINKS = [
  { label: 'Fields', target: { page: 'fields' } },
  { label: 'Method', target: { page: 'method' } },
  { label: 'Reviews', target: { page: 'home', section: 'wf-reviews' } },
  { label: 'Custom', target: { page: 'home', section: 'wf-custom' } },
  { label: 'Community', target: { page: 'home', section: 'wf-join' } },
  { label: 'FAQ', target: { page: 'home', section: 'wf-faq' } },
]

export default function Nav({ page, onNavigate }) {
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
    onNavigate(target)
  }

  const isActive = (target) => target.page === page && !target.section

  return (
    <nav className={`wf-nav${scrolled ? ' scrolled' : ''}`}>
      <div className="wf-nav-inner">
        <button className="wf-brand" onClick={() => go({ page: 'home' })} aria-label="Waslerr Fields home">
          <span className="wf-monogram">W</span>
          <span className="wf-wordmark">WASLERR&nbsp;FIELDS</span>
        </button>

        <div className="wf-nav-desktop">
          <div className="wf-navlinks">
            {LINKS.map((l) => (
              <button
                key={l.label}
                className={`wf-navlink${isActive(l.target) ? ' active' : ''}`}
                onClick={() => go(l.target)}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button className="wf-nav-cta wf-mag" onClick={() => go({ page: 'fields' })}>
            Begin
          </button>
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
        {LINKS.map((l, i) => (
          <button
            key={l.label}
            className="wf-mlink"
            style={{ animation: menuOpen ? `wf-fadeup .4s ease ${0.04 + i * 0.05}s both` : undefined }}
            onClick={() => go(l.target)}
          >
            {l.label}
          </button>
        ))}
        <button className="wf-mlink wf-mlink--cta" onClick={() => go({ page: 'fields' })}>
          Begin
        </button>
      </div>
    </nav>
  )
}
