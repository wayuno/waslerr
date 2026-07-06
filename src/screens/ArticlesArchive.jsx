import { useEffect, useMemo, useRef, useState } from 'react'
import Background from '../components/Background'
import { useStore } from '../store/StoreProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'

const PAGE_SIZE = 9

// deterministic star field (stable across re-renders)
const TWINKLES = Array.from({ length: 26 }, (_, i) => {
  const h = (i * 2246822519) % 4294967296
  return {
    left: ((h % 997) / 997) * 100,
    top: (((h >> 8) % 991) / 991) * 100,
    size: 2 + (i % 2),
    delay: ((h >> 16) % 70) / 10,
    dur: 3.4 + ((h >> 20) % 30) / 10,
  }
})

const readMins = (body = '') => Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 200))
const excerptOf = (body = '') => {
  const flat = body.replace(/^##\s+.*$/gm, '').replace(/^>\s?/gm, '').replace(/\s+/g, ' ').trim()
  return flat.length > 150 ? flat.slice(0, 150).replace(/\s+\S*$/, '') + '…' : flat
}

function Cover({ article, height, className }) {
  return (
    <div className={className}>
      {article.image_url ? (
        <img src={article.image_url} alt={article.title} loading="lazy" style={height ? { height } : undefined} />
      ) : (
        <div className="wf-arch-cover-fallback" aria-hidden="true">
          <img src="/logo-w-blade.svg" alt="" width="64" height="64" loading="lazy" />
        </div>
      )}
    </div>
  )
}

export default function ArticlesArchive() {
  const { articles, openArticle, navigate } = useStore()
  const ref = useRef(null)
  useReveal(ref)
  useMagnetic(ref)
  const [visible, setVisible] = useState(PAGE_SIZE)

  useEffect(() => {
    const prev = document.title
    document.title = 'Articles — Waslerr Fields'
    return () => { document.title = prev }
  }, [])

  // store already sorts newest-first; guard anyway so featured is the latest
  const sorted = useMemo(() => [...articles].sort((x, y) => (y.ts || 0) - (x.ts || 0)), [articles])
  const featured = sorted[0] || null
  const rest = sorted.slice(1)
  const shown = rest.slice(0, visible)

  return (
    <div className="wf-app" ref={ref}>
      <Background resonanceTop="30%" />
      <div className="wf-artd-haze" aria-hidden="true" />
      <div className="wf-artd-stars" aria-hidden="true">
        {TWINKLES.map((t, i) => (
          <span
            key={i}
            style={{ left: `${t.left}%`, top: `${t.top}%`, width: t.size, height: t.size, animationDelay: `${t.delay}s`, animationDuration: `${t.dur}s` }}
          />
        ))}
      </div>

      <section className="wf-artd-section">
        <div className="wf-artd-topbar wf-artd-rise" style={{ '--rise': 0 }}>
          <button className="wf-artd-back" onClick={() => navigate('home')}>
            ← Home
          </button>
        </div>

        {/* ===== HEADER ===== */}
        <header className="wf-artd-head">
          <div className="wf-artd-meta wf-artd-rise" style={{ '--rise': 1 }}>
            <span className="wf-artd-hairline" />
            <span className="wf-artd-meta-text">The Archive</span>
            <span className="wf-artd-hairline flip" />
          </div>
          <h1 className="wf-arch-title wf-artd-rise" style={{ '--rise': 2 }}>
            Every transmission,
            <br />
            <span className="wf-artd-title-accent">in one place</span>
          </h1>
          <p className="wf-arch-subline wf-artd-rise" style={{ '--rise': 3 }}>
            Notes from the lab on fields, frequencies, and the architecture of the mind.
          </p>
        </header>

        {articles.length === 0 && (
          <p className="wf-arch-empty">No transmissions published yet. Return soon.</p>
        )}

        {/* ===== FEATURED (latest) ===== */}
        {featured && (
          <article
            className="wf-arch-featured wf-artd-rise"
            style={{ '--rise': 4 }}
            onClick={() => openArticle(featured)}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') openArticle(featured) }}
          >
            <Cover article={featured} className="wf-arch-featured-media" />
            <span className="wf-arch-featured-veil" aria-hidden="true" />
            <div className="wf-arch-featured-info">
              <div className="wf-arch-featured-meta">
                <span className="wf-arch-pill">Featured</span>
                <span className="wf-arch-date">{featured.date}</span>
              </div>
              <h2 className="wf-arch-featured-title">{featured.title}</h2>
              {featured.body && <p className="wf-arch-featured-excerpt">{excerptOf(featured.body)}</p>}
              <span className="wf-arts-cta">
                Read article
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </article>
        )}

        {/* ===== GRID ===== */}
        {shown.length > 0 && (
          <div className="wf-arch-grid">
            {shown.map((a) => (
              <article
                key={a.id}
                className="wf-arch-card"
                onClick={() => openArticle(a)}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') openArticle(a) }}
              >
                <div className="wf-arch-card-media">
                  <Cover article={a} className="wf-arch-card-cover" />
                  <span className="wf-arch-card-fade" aria-hidden="true" />
                  <span className="wf-arch-pill wf-arch-card-tag">Article</span>
                </div>
                <div className="wf-arch-card-body">
                  <div className="wf-arch-card-meta">
                    {a.date} · {readMins(a.body)} min read
                  </div>
                  <h3 className="wf-arch-card-title">{a.title}</h3>
                  {a.body && <p className="wf-arch-card-excerpt">{excerptOf(a.body)}</p>}
                  <span className="wf-arch-card-read">Read article →</span>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* ===== LOAD MORE ===== */}
        {rest.length > visible && (
          <div className="wf-arch-more">
            <button className="wf-artd-back" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              Load more transmissions
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
