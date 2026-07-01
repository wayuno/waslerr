import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/StoreProvider'
import StoryCard from './StoryCard'
import { ArrowRight, CloseIcon } from './icons'

const CAT = { desire: 'Desire', akashic: 'Akashic', wealth: 'Wealth' }
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

// Homepage "Review Wall": a teaser of real reviews across every field, with a
// full-screen overlay to read them all. Reviews + sharing use the real
// Supabase-backed wall (no per-section mock data, no star ratings).
export default function ReviewWall() {
  const { wall, products, openReviews, openDetail } = useStore()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('all')

  const prodMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products])
  const lineOf = (id) => prodMap[id]?.line || 'desire'
  const titleOf = (id) => prodMap[id]?.title || 'a Waslerr field'
  const clsOf = (id) => {
    const l = lineOf(id)
    return l === 'akashic' || l === 'wealth' ? l : ''
  }

  const sorted = useMemo(
    () => [...wall].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.ts - a.ts),
    [wall],
  )
  const cats = useMemo(() => {
    const seen = []
    for (const r of sorted) {
      const l = lineOf(r.field)
      if (!seen.includes(l)) seen.push(l)
    }
    return seen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, products])

  const shown = filter === 'all' ? sorted : sorted.filter((r) => lineOf(r.field) === filter)

  // two marquee rows for the teaser (duplicated so the loop is seamless)
  const teaser = sorted.slice(0, 12)
  const rowA = teaser.filter((_, i) => i % 2 === 0)
  const rowB = teaser.filter((_, i) => i % 2 === 1)

  // lock scroll + close on Esc while the overlay is open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const hasReviews = wall.length > 0

  const onField = (id) => {
    setOpen(false)
    openDetail?.(id)
  }

  const mini = (r, i) => (
    <article className="wf-rw-mini" key={`${r.id}-${i}`} onClick={() => setOpen(true)}>
      <div className="wf-rw-mini-head">
        <span className="wf-rw-av">{(r.name || '?').charAt(0).toUpperCase()}</span>
        <span className="wf-rw-mini-meta">
          <span className="wf-rw-mini-name">{r.name}</span>
          <span className="wf-rw-mini-cat">
            {CAT[lineOf(r.field)] || cap(lineOf(r.field))} · {titleOf(r.field)}
          </span>
        </span>
      </div>
      <p className="wf-rw-mini-text">{r.text}</p>
    </article>
  )

  return (
    <section className="wf-section wf-section--rule wf-rw" id="wf-reviews">
      <div className="wf-container" style={{ maxWidth: 1080, paddingTop: 82, paddingBottom: 82 }}>
        <div style={{ maxWidth: 620 }}>
          <div className="wf-eyebrow wf-eyebrow--dot" data-reveal>
            <i />
            The review wall
          </div>
          <h2 className="wf-h2" data-reveal style={{ fontSize: 'clamp(32px,4.6vw,52px)' }}>
            Voices from
            <br />
            the field.
          </h2>
          <p className="wf-lead" data-reveal style={{ margin: '16px 0 0' }}>
            Every audio from Waslerr leaves an impact. Read what the listening left behind.
          </p>
          {hasReviews && (
            <div className="wf-rw-stat" data-reveal>
              {wall.length.toLocaleString('en-US')} voices · every field
            </div>
          )}
        </div>

        {teaser.length > 0 && (
          <div className="wf-rw-teaser" data-reveal aria-hidden="true">
            <div className="wf-rw-row">
              <div className="wf-rw-track">{[...rowA, ...rowA].map(mini)}</div>
            </div>
            {rowB.length > 0 && (
              <div className="wf-rw-row">
                <div className="wf-rw-track wf-rw-track--rev">{[...rowB, ...rowB].map(mini)}</div>
              </div>
            )}
          </div>
        )}

        <div className="wf-rw-cta" data-reveal>
          {hasReviews && (
            <button className="wf-btn wf-btn-gold wf-mag wf-rw-open" onClick={() => setOpen(true)}>
              Open the review wall <ArrowRight size={15} />
            </button>
          )}
          <button
            className={`wf-btn wf-mag ${hasReviews ? 'wf-btn-glass' : 'wf-btn-gold wf-rw-open'}`}
            onClick={() => openReviews(null, true)}
          >
            Share your review
          </button>
        </div>
      </div>

      {open && (
        <div className="wf-rw-overlay" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="wf-rw-panel" role="dialog" aria-label="The review wall">
            <div className="wf-rw-topbar">
              <div className="wf-rw-topbar-text">
                <div className="wf-eyebrow">The review wall</div>
                <div className="wf-rw-stat">{wall.length.toLocaleString('en-US')} reviews across all fields</div>
              </div>
              <div className="wf-rw-topbar-actions">
                <button className="wf-btn wf-btn-gold wf-mag" onClick={() => openReviews(null, true)}>
                  + Share your review
                </button>
                <button className="wf-rw-close" onClick={() => setOpen(false)} aria-label="Close">
                  <CloseIcon size={18} />
                </button>
              </div>
            </div>

            <div className="wf-rw-chips">
              <button className={`wf-chip${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
                All fields
              </button>
              {cats.map((c) => (
                <button key={c} className={`wf-chip${filter === c ? ' active' : ''}`} onClick={() => setFilter(c)}>
                  {CAT[c] || cap(c)}
                </button>
              ))}
            </div>

            {shown.length === 0 ? (
              <p className="wf-rw-empty">No reviews under this filter yet.</p>
            ) : (
              <div className="wf-rw-masonry">
                {shown.map((s, i) => (
                  <div className="wf-rw-cell" key={s.id} style={{ '--d': i }}>
                    <StoryCard story={s} fieldName={titleOf(s.field)} fieldCls={clsOf(s.field)} onField={onField} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
