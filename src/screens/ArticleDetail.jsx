import { useEffect, useMemo, useRef } from 'react'
import Background from '../components/Background'
import { useStore } from '../store/StoreProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'

// Deterministic tiny-star field (no Math.random in render — stable across
// re-renders, and positions don't jump when the store updates).
const TWINKLES = Array.from({ length: 26 }, (_, i) => {
  const h = (i * 2654435761) % 4294967296
  return {
    left: ((h % 997) / 997) * 100,
    top: (((h >> 8) % 991) / 991) * 100,
    size: 2 + (i % 2),
    delay: ((h >> 16) % 70) / 10,
    dur: 3.4 + ((h >> 20) % 30) / 10,
  }
})

// Split "Heading: second clause" / "Heading — second clause" so the second
// clause renders as the italic gradient accent. Titles without a clause
// separator stay plain.
function splitTitle(title = '') {
  const m = title.match(/^(.+?)([:—])\s*(.+)$/)
  if (!m) return { main: title, accent: '' }
  return { main: m[1] + (m[2] === ':' ? ':' : ' —'), accent: m[3] }
}

// Light markdown: "## " → h2, "> " → pull-quote, else paragraph.
function parseBody(body = '') {
  return body
    .split(/\n\n+|\r\n\r\n+/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block) => {
      if (/^##\s+/.test(block)) return { type: 'h2', text: block.replace(/^##\s+/, '') }
      if (/^>\s?/.test(block)) return { type: 'quote', text: block.replace(/^>\s?/gm, '').replace(/\n/g, ' ') }
      return { type: 'p', text: block.replace(/\n/g, ' ') }
    })
}

const Ornament = () => (
  <div className="wf-artd-ornament" aria-hidden="true">
    <span className="wf-artd-hairline" />
    <span className="wf-artd-dot" />
    <span className="wf-artd-hairline flip" />
  </div>
)

export default function ArticleDetail() {
  const { selectedArticle, navigate } = useStore()
  const ref = useRef(null)
  useReveal(ref)
  useMagnetic(ref)

  const a = selectedArticle

  // SEO: page title while reading, restored on leave
  useEffect(() => {
    if (!a) return undefined
    const prev = document.title
    document.title = `${a.title} — Waslerr Fields`
    return () => { document.title = prev }
  }, [a])

  const blocks = useMemo(() => parseBody(a?.body), [a])
  const title = useMemo(() => splitTitle(a?.title), [a])
  const readMins = useMemo(() => {
    const words = (a?.body || '').split(/\s+/).filter(Boolean).length
    return Math.max(1, Math.round(words / 200))
  }, [a])

  if (!a) {
    navigate('home')
    return null
  }

  let paraIdx = -1 // first paragraph gets the drop cap

  return (
    <div className="wf-app" ref={ref}>
      <Background resonanceTop="30%" />

      {/* warm radial haze + fixed gold twinkles behind everything */}
      <div className="wf-artd-haze" aria-hidden="true" />
      <div className="wf-artd-stars" aria-hidden="true">
        {TWINKLES.map((t, i) => (
          <span
            key={i}
            style={{
              left: `${t.left}%`,
              top: `${t.top}%`,
              width: t.size,
              height: t.size,
              animationDelay: `${t.delay}s`,
              animationDuration: `${t.dur}s`,
            }}
          />
        ))}
      </div>

      <section className="wf-artd-section">
        <div className="wf-artd-topbar wf-artd-rise" style={{ '--rise': 0 }}>
          <button className="wf-artd-back" onClick={() => navigate('home')}>
            ← Back to articles
          </button>
        </div>

        {/* ===== HERO HEADER ===== */}
        <header className="wf-artd-head">
          <div className="wf-artd-meta wf-artd-rise" style={{ '--rise': 1 }}>
            <span className="wf-artd-hairline" />
            <span className="wf-artd-meta-text">Article · {a.date}</span>
            <span className="wf-artd-hairline flip" />
          </div>

          <h1 className="wf-artd-title wf-artd-rise" style={{ '--rise': 2 }}>
            {title.main}
            {title.accent && <> <span className="wf-artd-title-accent">{title.accent}</span></>}
          </h1>

          <div className="wf-artd-byline wf-artd-rise" style={{ '--rise': 3 }}>
            <span>{readMins} min read</span>
            <i aria-hidden="true" />
            <span>By Waslerr</span>
          </div>
        </header>

        {/* ===== COVER ===== */}
        <figure className="wf-artd-cover wf-artd-rise" style={{ '--rise': 4 }}>
          {a.image_url ? (
            <>
              <img src={a.image_url} alt={a.title} />
              <span className="wf-artd-cover-veil" aria-hidden="true" />
            </>
          ) : (
            <div className="wf-artd-cover-fallback" aria-hidden="true">
              <img src="/logo-w-blade.svg" alt="" width="88" height="88" />
            </div>
          )}
        </figure>

        {/* ===== BODY ===== */}
        <article className="wf-artd-body wf-artd-rise" style={{ '--rise': 5 }}>
          {blocks.length > 0 ? (
            blocks.map((b, i) => {
              if (b.type === 'h2') return <h2 key={i}>{b.text}</h2>
              if (b.type === 'quote')
                return (
                  <blockquote key={i}>
                    <Ornament />
                    <p>{b.text}</p>
                  </blockquote>
                )
              paraIdx += 1
              return (
                <p key={i} className={paraIdx === 0 ? 'wf-artd-lead' : undefined}>
                  {b.text}
                </p>
              )
            })
          ) : (
            <div className="wf-artd-empty">
              <Ornament />
              <p>This transmission is being written.</p>
            </div>
          )}
        </article>

        {/* ===== FOOTER CTA ===== */}
        <footer className="wf-artd-foot">
          <div className="wf-artd-ornament" aria-hidden="true">
            <span className="wf-artd-hairline" />
            <img src="/logo-w-blade.svg" alt="" width="22" height="22" style={{ opacity: 0.75 }} />
            <span className="wf-artd-hairline flip" />
          </div>
          <p className="wf-artd-foot-line">Ready to go deeper than reading?</p>
          <button className="wf-arts-cta wf-mag" onClick={() => navigate('fields')}>
            Explore the fields
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </footer>
      </section>
    </div>
  )
}
