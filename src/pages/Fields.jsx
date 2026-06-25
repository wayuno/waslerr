import { useEffect, useRef, useState } from 'react'
import Background from '../components/Background'
import ProductCard from '../components/ProductCard'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'
import { useStore } from '../store/StoreProvider'
import { community } from '../data/content'
import { YouTubeIcon, DiscordIcon, ChatIcon } from '../components/icons'

const CHIPS = [
  { cat: 'all', label: 'All fields' },
  { cat: 'desire', label: 'Desire Code' },
  { cat: 'akashic', label: 'Akashic Field' },
]
const LABELS = { all: 'All fields', desire: 'Desire Code', akashic: 'Akashic Field' }

export default function Fields({ onNavigate, initialCat = 'all' }) {
  const { products } = useStore()
  const ref = useRef(null)
  const gridRef = useRef(null)
  const tokRef = useRef(0)
  const [cat, setCat] = useState(['desire', 'akashic'].includes(initialCat) ? initialCat : 'all')
  const [count, setCount] = useState(products.length)
  useReveal(ref)
  useMagnetic(ref)

  // faithful filter: fade + scale out, then hide; reveal shown cards
  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const tok = ++tokRef.current
    const cards = Array.from(grid.querySelectorAll('.wf-card'))
    let shown = 0
    cards.forEach((card) => {
      const show = cat === 'all' || card.dataset.cat === cat
      if (show) {
        shown++
        card.style.display = ''
        requestAnimationFrame(() => {
          if (tokRef.current === tok) {
            card.style.opacity = ''
            card.style.transform = ''
          }
        })
      } else {
        card.style.opacity = '0'
        card.style.transform = 'scale(.96)'
        setTimeout(() => {
          if (tokRef.current === tok && cat !== 'all' && card.dataset.cat !== cat) card.style.display = 'none'
        }, 300)
      }
    })
    setCount(shown)
  }, [cat, products])

  return (
    <div className="wf-app" ref={ref}>
      <Background resonanceTop="48%" />

      <section className="wf-section" style={{ maxWidth: 1180, margin: '0 auto', padding: '80px 28px 0' }}>
        <div className="wf-head-block wf-center">
          <div className="wf-eyebrow" data-reveal>
            The fields
          </div>
          <h1 className="wf-page-h1" data-reveal>
            Every field, one place.
          </h1>
          <p className="wf-page-lead" data-reveal>
            Browse the full library. Filter by line, preview any field, and take what moves you.
          </p>
        </div>

        <div className="wf-chips" data-reveal style={{ margin: '42px 0 16px' }}>
          {CHIPS.map((c) => (
            <button
              key={c.cat}
              className={`wf-chip${cat === c.cat ? ' active' : ''}`}
              onClick={() => setCat(c.cat)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="wf-count" data-reveal style={{ marginBottom: 8 }}>
          {count} {LABELS[cat]}
          {cat === 'all' ? '' : ' fields'}
        </div>
      </section>

      <section className="wf-section" style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 28px 100px' }}>
        <div className="wf-grid" ref={gridRef}>
          {products.map((f) => (
            <ProductCard key={f.id} field={f} />
          ))}
        </div>
      </section>

      <footer className="wf-subfoot">
        <div
          style={{
            maxWidth: 1180,
            margin: '0 auto',
            padding: '56px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h3 className="wf-line-title" style={{ fontSize: 26, marginBottom: 6 }}>
              Can&apos;t find your exact field?
            </h3>
            <p style={{ fontSize: 14.5, color: 'var(--wf-mute)', fontWeight: 300, margin: 0 }}>
              Have a Custom Code written, voiced and tuned to your intention.
            </p>
          </div>
          <button
            className="wf-btn wf-btn-gold wf-mag"
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => onNavigate({ page: 'home', section: 'wf-custom' })}
          >
            Request a Custom Code
          </button>
        </div>

        <div className="wf-join-strip">
          <span className="wf-join-strip-label">Join the party</span>
          <a href={community.youtube} target="_blank" rel="noopener">
            <YouTubeIcon size={16} /> YouTube
          </a>
          <a href={community.discord} target="_blank" rel="noopener">
            <DiscordIcon size={16} /> Discord
          </a>
          <a href={community.email}>
            <ChatIcon size={16} /> 1:1 with the creator
          </a>
        </div>

        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px 40px' }}>
          <div
            style={{
              borderTop: '1px solid var(--wf-rule)',
              paddingTop: 24,
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 14,
            }}
          >
            <button className="wf-back" onClick={() => onNavigate({ page: 'home' })}>
              ← Back to home
            </button>
            <span className="wf-subfoot-note">© 2026 Waslerr Fields. Individual results vary.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
