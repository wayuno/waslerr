import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/StoreProvider'

// Homepage "The Articles" — premium hero-banner carousel.
// Text-left / image-right split inside a single floating rounded card.
// Auto-rotates every 5 s with a crossfade + Ken Burns zoom. Bottom-center
// pill dots only (gray inactive, white active). Swipe support on mobile.
const AUTO_MS = 5000

export default function ArticlesSlideshow() {
  const { articles } = useStore()
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const count = articles.length
  const rafRef = useRef(null)
  const startRef = useRef(0)
  const touchX = useRef(0)

  useEffect(() => {
    if (idx > count - 1) setIdx(Math.max(0, count - 1))
  }, [count, idx])

  // auto-advance with rAF progress
  useEffect(() => {
    if (paused || count <= 1) return
    startRef.current = performance.now()
    const tick = (now) => {
      const elapsed = now - startRef.current
      const p = Math.min(1, elapsed / AUTO_MS)
      setProgress(p)
      if (p >= 1) {
        setIdx((i) => (i + 1) % count)
        startRef.current = now
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [paused, count, idx])

  useEffect(() => {
    setProgress(0)
    startRef.current = performance.now()
  }, [idx])

  if (count === 0) return null

  const go = (n) => setIdx(((n % count) + count) % count)

  const onTouchStart = (e) => {
    touchX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchX.current
    if (Math.abs(dx) > 40) go(dx < 0 ? idx + 1 : idx - 1)
  }

  return (
    <section className="wf-section wf-section--rule wf-pad" id="articles">
      <div className="wf-container">
        <div className="wf-arts-head" data-reveal>
          <div>
            <div className="wf-eyebrow" style={{ marginBottom: 10 }}>
              The Articles
            </div>
            <h2 className="wf-jr-title">Fresh from the lab.</h2>
          </div>
        </div>

        <div
          className="wf-arts-card"
          data-reveal
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {articles.map((a, i) => (
            <article
              className={`wf-arts-slide${i === idx ? ' active' : ''}`}
              key={a.id}
              aria-hidden={i !== idx}
            >
              {/* LEFT — text */}
              <div className="wf-arts-text">
                <span className="wf-arts-badge">Article</span>
                <div className="wf-arts-date">{a.date}</div>
                <h3 className="wf-arts-title">{a.title}</h3>
                {a.body && <p className="wf-arts-excerpt">{a.body}</p>}
                <button className="wf-arts-cta">
                  View article
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              {/* RIGHT — image */}
              <div className="wf-arts-media">
                {a.image_url ? (
                  <img src={a.image_url} alt={a.title} loading="lazy" />
                ) : (
                  <span className="wf-arts-glyph" aria-hidden="true">
                    {(a.title || 'W').charAt(0)}
                  </span>
                )}
                <span className="wf-arts-media-veil" aria-hidden="true" />
              </div>
            </article>
          ))}

          {/* progress bar */}
          {count > 1 && (
            <div className="wf-arts-progress" aria-hidden="true">
              <span style={{ width: `${paused ? 0 : progress * 100}%` }} />
            </div>
          )}
        </div>

        {count > 1 && (
          <div className="wf-arts-dots" role="tablist" aria-label="Article slides">
            {articles.map((a, i) => (
              <button
                key={a.id}
                className={`wf-arts-dot${i === idx ? ' active' : ''}`}
                aria-label={`Go to article ${i + 1}`}
                aria-selected={i === idx}
                onClick={() => go(i)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
