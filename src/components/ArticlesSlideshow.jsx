import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/StoreProvider'

// Homepage "The Articles" — immersive auto-rotating visual carousel.
// Full-bleed image with Ken Burns zoom, crossfade transitions, a floating
// "view" icon, progress bar, and dot navigation. 8 s auto-advance.
const AUTO_MS = 8000

export default function ArticlesSlideshow() {
  const { articles } = useStore()
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const count = articles.length
  const timer = useRef(null)
  const rafRef = useRef(null)
  const startRef = useRef(0)

  // clamp index if the list shrinks
  useEffect(() => {
    if (idx > count - 1) setIdx(Math.max(0, count - 1))
  }, [count, idx])

  // auto-advance with rAF progress bar
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

  // reset progress when slide changes manually
  useEffect(() => {
    setProgress(0)
    startRef.current = performance.now()
  }, [idx])

  if (count === 0) return null

  const go = (n) => setIdx(((n % count) + count) % count)
  const prev = () => go(idx - 1)
  const next = () => go(idx + 1)

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
          {count > 1 && (
            <div className="wf-arts-controls">
              <button className="wf-arts-nav" aria-label="Previous article" onClick={prev}>
                ‹
              </button>
              <span className="wf-arts-count">
                {idx + 1} / {count}
              </span>
              <button className="wf-arts-nav" aria-label="Next article" onClick={next}>
                ›
              </button>
            </div>
          )}
        </div>

        <div
          className="wf-arts-stage"
          data-reveal
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {articles.map((a, i) => (
            <article
              className={`wf-arts-slide${i === idx ? ' active' : ''}`}
              key={a.id}
              aria-hidden={i !== idx}
            >
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
              <div className="wf-arts-body">
                <div className="wf-arts-date">{a.date}</div>
                <h3 className="wf-arts-title">{a.title}</h3>
                {a.body && <p className="wf-arts-excerpt">{a.body}</p>}
                <div className="wf-arts-view" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                  <span>View</span>
                </div>
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
