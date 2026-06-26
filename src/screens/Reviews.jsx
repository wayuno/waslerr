import { useEffect, useRef, useState } from 'react'
import Background from '../components/Background'
import StoryCard, { Stars } from '../components/StoryCard'
import { useStore } from '../store/StoreProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'
import { averageOf } from '../lib/wall'
import { StarIcon } from '../components/icons'

const CAT_CLS = { desire: '', akashic: 'akashic', wealth: 'wealth' }
const FILTERS = [
  { id: 'all', label: 'All stories' },
  { id: 'featured', label: 'Featured' },
  { id: 'desire', label: 'Desire' },
  { id: 'akashic', label: 'Akashic' },
]

export default function Reviews() {
  const { products, wall, addReview, reviewField, reviewShare, clearReviewShare, navigate, openDetail, showToast } = useStore()
  const ref = useRef(null)
  const formRef = useRef(null)
  useReveal(ref)
  useMagnetic(ref)

  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({ name: '', field: reviewField || products[0]?.id || '', rating: 0, text: '' })
  const [hover, setHover] = useState(0)
  const [err, setErr] = useState('')
  const [freshId, setFreshId] = useState(null)

  const prodMap = Object.fromEntries(products.map((p) => [p.id, p]))
  const nameOf = (id) => prodMap[id]?.title || 'a Waslerr field'
  const catOf = (id) => prodMap[id]?.line || 'desire'
  const clsOf = (id) => CAT_CLS[catOf(id)] || ''

  const avg = averageOf(wall)
  const sorted = [...wall].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.ts - a.ts)
  const shown = sorted.filter((r) => {
    if (filter === 'all') return true
    if (filter === 'featured') return r.featured
    return catOf(r.field) === filter
  })

  // deep-link: ?f preselects the field; #share scrolls to the form
  useEffect(() => {
    if (reviewField) setForm((prev) => ({ ...prev, field: reviewField }))
  }, [reviewField])
  useEffect(() => {
    if (reviewShare) {
      const t = setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        clearReviewShare()
      }, 220)
      return () => clearTimeout(t)
    }
  }, [reviewShare, clearReviewShare])

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  const submit = (e) => {
    e.preventDefault()
    setErr('')
    if (!form.name.trim()) return setErr('Add your name.')
    if (!form.rating) return setErr('Pick a star rating.')
    if (form.text.trim().length < 8) return setErr('Tell us a little more about what changed.')
    const item = addReview({
      field: form.field,
      name: form.name.trim(),
      rating: form.rating,
      text: form.text.trim(),
    })
    setFreshId(item.id)
    setForm({ name: '', field: form.field, rating: 0, text: '' })
    setHover(0)
    setFilter('all')
    showToast('Thanks — your story is on the wall')
  }

  return (
    <div className="wf-app" ref={ref}>
      <Background resonanceTop="46%" />

      <section className="wf-subhead" style={{ maxWidth: 760, padding: '96px 28px 8px' }}>
        <div className="wf-eyebrow" data-reveal>
          The wall
        </div>
        <h1 className="wf-page-h1" data-reveal>
          Real stories from the field.
        </h1>
        <p className="wf-page-lead" data-reveal>
          Unfiltered words from listeners who pressed play and kept going. Share yours — the team features standout
          stories.
        </p>
        <div className="wf-wall-stat" data-reveal>
          <span className="wf-wall-avg">{avg || '—'}</span>
          <Stars rating={avg} size={16} />
          <span className="wf-wall-count">{wall.length} stories</span>
          <button className="wf-btn wf-btn-gold wf-mag" onClick={scrollToForm}>
            Share your story
          </button>
        </div>
      </section>

      <section className="wf-section" style={{ maxWidth: 1080, margin: '0 auto', padding: '20px 28px 40px' }}>
        <div className="wf-chips" data-reveal style={{ marginBottom: 34 }}>
          {FILTERS.map((c) => (
            <button key={c.id} className={`wf-chip${filter === c.id ? ' active' : ''}`} onClick={() => setFilter(c.id)}>
              {c.label}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="wf-detail-desc" data-reveal>
            No stories here yet — be the first.
          </p>
        ) : (
          <div className="wf-wall-masonry">
            {shown.map((s) => (
              <StoryCard
                key={s.id}
                story={s}
                fieldName={nameOf(s.field)}
                fieldCls={clsOf(s.field)}
                onField={(id) => openDetail(id)}
                fresh={s.id === freshId}
              />
            ))}
          </div>
        )}
      </section>

      {/* ===== SHARE FORM ===== */}
      <section className="wf-section" style={{ maxWidth: 640, margin: '0 auto', padding: '10px 28px 80px' }} ref={formRef}>
        <form className="wf-form-card wf-share-form" data-reveal onSubmit={submit}>
          <div className="wf-eyebrow" style={{ marginBottom: 4 }}>
            Share your story
          </div>
          <h2 className="wf-detail-title" style={{ fontSize: 'clamp(26px,3vw,34px)', marginBottom: 6 }}>
            Tell the wall what changed.
          </h2>

          <div className="wf-form-row">
            <label className="wf-field">
              <span className="wf-field-label">Your name</span>
              <input
                className="wf-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="First name or initial"
              />
            </label>
            <label className="wf-field">
              <span className="wf-field-label">Which field</span>
              <select className="wf-select" value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="wf-field">
            <span className="wf-field-label">Your rating</span>
            <div className="wf-star-input" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`wf-star-btn${n <= (hover || form.rating) ? ' on' : ''}`}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setForm({ ...form, rating: n })}
                >
                  <StarIcon size={26} filled={n <= (hover || form.rating)} />
                </button>
              ))}
            </div>
          </div>

          <label className="wf-field">
            <span className="wf-field-label">What changed</span>
            <textarea
              className="wf-textarea"
              rows="4"
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              placeholder="The shift you felt, in your own words…"
            />
          </label>

          {err && <p className="wf-auth-error" style={{ margin: 0 }}>{err}</p>}
          <button type="submit" className="wf-form-submit wf-mag">
            Post to the wall
          </button>
          <p className="wf-form-note">Open to everyone. Be honest — real stories help others choose.</p>
        </form>
      </section>

      <footer className="wf-subfoot">
        <div className="wf-subfoot-row">
          <button className="wf-back" onClick={() => navigate('home')}>
            ← Back to home
          </button>
          <span className="wf-subfoot-note">
            Audio supports mindset &amp; self-improvement. Not medical treatment. Individual results vary.
          </span>
        </div>
      </footer>
    </div>
  )
}
