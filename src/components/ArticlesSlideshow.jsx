import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/StoreProvider'

// Homepage "The Articles" slideshow — admin-published blogs / new-features
// (title, description, photo). Visible to everyone. Auto-rotates with a
// crossfade; pauses on hover; arrow + dot controls. Renders nothing until at
// least one article exists so the homepage never shows an empty stage.
const AUTO_MS = 6500

export default function ArticlesSlideshow() {
  const { articles } = useStore()
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = articles.length
  const timer = useRef(null)

  // clamp index if the list shrinks (e.g. admin deletes the current article)
  useEffect(() => {
    if (idx > count - 1) setIdx(Math.max(0, count - 1))
  }, [count, idx])

  // auto-advance
  useEffect(() => {
    if (paused || count <= 1) return
    timer.current = setInterval(() => setIdx((i) => (i + 1) % count), AUTO_MS)
    return () => clearInterval(timer.current)
  }, [paused, count])

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
              className={`wf-arts-slide${i === idx ? ' active' : ''}${i < idx ? ' past' : ''}`}
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
              </div>
            </article>
          ))}
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
