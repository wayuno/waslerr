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

// composed empty state for the wall
function WallEmpty({ isAll, onShare }) {
  return (
    <div className="wf-wall-empty" data-reveal>
      <div className="wf-wall-empty-card">
        <div className="wf-wall-empty-icon" aria-hidden="true">
          <span className="wf-wall-empty-blob" />
          <span className="wf-wall-empty-tile">
            <StarIcon size={26} filled={false} />
          </span>
        </div>
        <h2 className="wf-wall-empty-title">No stories here yet.</h2>
        <p className="wf-wall-empty-sub">
          {isAll
            ? 'Be the first to share what shifted — your story opens the wall for everyone after you.'
            : 'Nothing under this filter yet. Try another, or be the first to post here.'}
        </p>
        <button className="wf-btn wf-btn-gold wf-mag wf-wall-empty-cta" onClick={onShare}>
          Share your story
        </button>
      </div>
    </div>
  )
}

export default function Reviews() {
  const { products, wall, addReview, reviewField, reviewShare, clearReviewShare, navigate, openDetail, showToast, loggedIn, authReady } = useStore()
  const ref = useRef(null)
  const formRef = useRef(null)
  useReveal(ref)
  useMagnetic(ref)

  // The wall is members-only — guests can't read or post reviews.
  useEffect(() => {
    if (authReady && !loggedIn) navigate('login')
  }, [authReady, loggedIn, navigate])

  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({ name: '', field: reviewField || products[0]?.id || '', rating: 0, text: '' })
  const [hover, setHover] = useState(0)
  const [popped, setPopped] = useState(false)
  const [err, setErr] = useState('')
  const [freshId, setFreshId] = useState(null)
  const [photos, setPhotos] = useState([]) // up to 2 uploaded image URLs
  const [uploading, setUploading] = useState(false)
  const photoInputRef = useRef(null)
  const MAX_PHOTOS = 2

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

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result).split(',')[1])
      r.onerror = reject
      r.readAsDataURL(file)
    })

  const onPickPhotos = async (e) => {
    setErr('')
    const files = Array.from(e.target.files || [])
    if (photoInputRef.current) photoInputRef.current.value = ''
    if (!files.length) return
    const room = MAX_PHOTOS - photos.length
    if (room <= 0) return setErr(`You can add at most ${MAX_PHOTOS} photos.`)
    const take = files.slice(0, room)
    if (files.length > room) setErr(`Only ${MAX_PHOTOS} photos allowed — extra ones were skipped.`)
    setUploading(true)
    for (const file of take) {
      if (!file.type.startsWith('image/')) { setErr('Only image files are allowed.'); continue }
      if (file.size > 8 * 1024 * 1024) { setErr('Each photo must be under 8MB.'); continue }
      try {
        const dataBase64 = await fileToBase64(file)
        const r = await fetch('/api/reviews/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, contentType: file.type, dataBase64 }),
        })
        const d = await r.json().catch(() => ({}))
        if (r.ok && d.url) setPhotos((prev) => (prev.length < MAX_PHOTOS ? [...prev, d.url] : prev))
        else setErr(`Photo upload failed${d.detail ? ': ' + d.detail : ''}`)
      } catch {
        setErr('Photo upload failed — network error. Try a smaller image.')
      }
    }
    setUploading(false)
  }

  const removePhoto = (url) => setPhotos((prev) => prev.filter((u) => u !== url))

  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!form.name.trim()) return setErr('Add your name.')
    if (!form.rating) return setErr('Pick a star rating.')
    if (form.text.trim().length < 8) return setErr('Tell us a little more about what changed.')
    setBusy(true)
    const item = await addReview({
      field: form.field,
      name: form.name.trim(),
      rating: form.rating,
      text: form.text.trim(),
      images: photos,
    })
    setBusy(false)
    if (item?.id) setFreshId(item.id)
    setForm({ name: '', field: form.field, rating: 0, text: '' })
    setPhotos([])
    setHover(0)
    setFilter('all')
    showToast('Thanks — your story is on the wall')
  }

  if (!loggedIn) return null

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
          <WallEmpty isAll={filter === 'all'} onShare={scrollToForm} />
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
                  className={`wf-star-btn${n <= (hover || form.rating) ? ' on' : ''}${popped && n <= form.rating ? ' pop' : ''}`}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => {
                    setForm({ ...form, rating: n })
                    setPopped(false)
                    requestAnimationFrame(() => setPopped(true))
                    setTimeout(() => setPopped(false), 360)
                  }}
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

          <div className="wf-field">
            <span className="wf-field-label">Photos (optional · up to {MAX_PHOTOS})</span>
            <div className="wf-review-photos">
              {photos.map((url) => (
                <div className="wf-review-thumb" key={url}>
                  <img src={url} alt="Your review" />
                  <button type="button" className="wf-review-thumb-x" aria-label="Remove photo" onClick={() => removePhoto(url)}>
                    ✕
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  className="wf-review-add-photo"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? '…' : '+ Add photo'}
                </button>
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={onPickPhotos}
            />
          </div>

          {err && <p className="wf-auth-error" style={{ margin: 0 }}>{err}</p>}
          <button type="submit" className="wf-form-submit wf-mag" disabled={busy || uploading}>
            {busy ? 'Posting…' : uploading ? 'Uploading photo…' : 'Post to the wall'}
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
