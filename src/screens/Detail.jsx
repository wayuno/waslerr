import { useEffect, useRef, useState } from 'react'
import Background from '../components/Background'
import PosterPlayer from '../components/PosterPlayer'
import { useStore } from '../store/StoreProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'
import StoryCard from '../components/StoryCard'
import ListeningMethod from '../components/ListeningMethod'
import VersionPicker from '../components/VersionPicker'
import Disclaimer from '../components/Disclaimer'
import { benefitsById, genericBenefits, freeBenefits } from '../data/content'
import { DownloadIcon, CartIcon, ArrowRight, ChevronRight } from '../components/icons'

const CATS = {
  desire: { label: 'Desire', cls: '', ph: 'wf-card-ph-desire' },
  akashic: { label: 'Akashic', cls: 'akashic', ph: 'wf-card-ph-akashic' },
  wealth: { label: 'Wealth', cls: 'wealth', ph: 'wf-card-ph-wealth' },
}
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')
const SPEC_PAID = ['Slightly audible', 'Desire Code', 'Akashic Field', 'Lifetime access', '30-day guarantee']
const SPEC_FREE = ['Free forever', 'Instant download', 'FLAC + MP3', 'No card required']

const priceOf = (f) =>
  f.priceNum != null ? Number(f.priceNum) : f.price ? parseFloat(String(f.price).replace(/[^0-9.]/g, '')) || 0 : 0

export default function Detail() {
  const { selectedProduct, goCheckout, navigate, addToCart, openReviews, openDetail, products, wall, showToast } = useStore()
  const [saved, setSaved] = useState(false)
  const [benefitsOpen, setBenefitsOpen] = useState(false)
  const [methodOpen, setMethodOpen] = useState(false)
  const [selVersion, setSelVersion] = useState(null)
  const [tracks, setTracks] = useState([]) // entitled audio files (bundle) for download
  const ref = useRef(null)
  useReveal(ref)
  useMagnetic(ref)

  useEffect(() => {
    if (!selectedProduct) navigate('fields')
  }, [selectedProduct, navigate])
  useEffect(() => {
    setSaved(false)
    setBenefitsOpen(false)
    setMethodOpen(false)
    setSelVersion(null)
  }, [selectedProduct])
  // load the buyer's (or free) entitled audio bundle so we can offer every file
  useEffect(() => {
    setTracks([])
    const fld = selectedProduct
    if (!fld) return
    const selId = selVersion?.id ?? null
    // per-cut: a 0-priced version (or free base) lists freely; a paid cut needs proof
    const isFree = selVersion ? Number(selVersion.price) === 0 : priceOf(fld) === 0
    let purchaseRef = ''
    let purchased = false
    try {
      const orders = JSON.parse(localStorage.getItem('wf_orders') || '[]')
      const mine = orders.filter((o) => o.id === fld.id || o.fieldId === fld.id || o.name === fld.title)
      const match = mine.find((o) => (o.versionId ?? null) === selId)
      purchased = !!match || (selId === null && localStorage.getItem(`wf_purchased_${fld.id}`) === '1')
      purchaseRef = match?.ref || (selId === null ? mine[0]?.ref || '' : '')
    } catch { /* ignore */ }
    if (!((isFree && fld.hasAudio) || purchased)) return
    const u = `/api/fields/${fld.id}/audio?list=1${isFree ? (selId != null ? `&v=${selId}` : '') : `&ref=${encodeURIComponent(purchaseRef)}`}`
    let cancel = false
    fetch(u)
      .then((r) => (r.ok ? r.json() : { files: [] }))
      .then((d) => { if (!cancel) setTracks(Array.isArray(d.files) ? d.files : []) })
      .catch(() => {})
    return () => { cancel = true }
  }, [selectedProduct, selVersion])

  if (!selectedProduct) return null

  const f = selectedProduct
  const cat = CATS[f.line] || { label: cap(f.line), cls: '', ph: 'wf-card-ph-desire' }
  const total = priceOf(f)
  const baseFree = total === 0
  // free/paid is per selected cut: a 0-priced version listens free; a paid cut
  // (even on a free base field) shows a photo + Buy now.
  const free = selVersion ? Number(selVersion.price) === 0 : baseFree
  const img = f.image_url || f.img
  // per-field benefits set in admin win; otherwise fall back to the static lists
  const benefits = f.benefits?.length
    ? f.benefits
    : benefitsById[f.id]?.length
      ? benefitsById[f.id]
      : free
        ? freeBenefits
        : genericBenefits
  const sold = Number(f.sold) || 0
  const soldStr = sold.toLocaleString('en-US')

  // has this visitor purchased the CURRENTLY SELECTED version? (per-version, via order history)
  // buying one cut must not unlock the others — each version keeps its own "Buy now".
  const selId = selVersion?.id ?? null
  let purchaseRef = ''
  let isPurchased = false
  try {
    const orders = JSON.parse(localStorage.getItem('wf_orders') || '[]')
    const mine = orders.filter((o) => o.id === f.id || o.fieldId === f.id || o.name === f.title)
    const match = mine.find((o) => (o.versionId ?? null) === selId)
    // legacy per-field flag only counts toward the base ("main") selection
    isPurchased = !!match || (selId === null && localStorage.getItem(`wf_purchased_${f.id}`) === '1')
    purchaseRef = match?.ref || (selId === null ? mine[0]?.ref || '' : '')
  } catch {
    /* ignore */
  }
  const downloadTrack = (i) => {
    const base = `/api/fields/${f.id}/audio`
    const q = []
    if (!free) q.push(`ref=${encodeURIComponent(purchaseRef)}`)
    else if (selVersion) q.push(`v=${selVersion.id}`) // a free (0-priced) cut
    if (i != null) q.push(`i=${i}`)
    window.open(q.length ? `${base}?${q.join('&')}` : base, '_blank')
  }
  const downloadAudio = () => downloadTrack(0)

  // share this field — native Web Share when available, else copy the link
  const shareField = async () => {
    const url = window.location.href
    const data = { title: f.title || 'Waslerr field', text: f.desc || 'A Waslerr field', url }
    if (navigator.share) {
      try { await navigator.share(data) } catch { /* cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(url); showToast?.('Link copied') } catch { /* ignore */ }
    }
  }

  const fieldStories = wall.filter((r) => r.field === f.id)
  const featured = [...fieldStories].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.ts - a.ts).slice(0, 3)
  const prodMap = Object.fromEntries(products.map((p) => [p.id, p]))
  const nameOf = (id) => prodMap[id]?.title || 'a Waslerr field'
  const clsOf = (id) => CATS[prodMap[id]?.line]?.cls || ''

  return (
    <div className="wf-app" ref={ref}>
      <Background resonanceTop="48%" />

      {img && (
        <div className="wf-detail-cinema" aria-hidden="true">
          <img src={img} alt="" />
          <div className="wf-detail-cinema-scrim" />
        </div>
      )}

      <div className="wf-detail-body">
      <section className="wf-section" style={{ maxWidth: 1180, margin: '0 auto', padding: '104px 28px 0' }}>
        <nav className="wf-breadcrumb" data-reveal>
          <button onClick={() => navigate('fields')}>All fields</button>
          <span>›</span>
          <span>{cat.label}</span>
          <span>›</span>
          <span className="wf-bc-title">{f.title}</span>
        </nav>

        {/* ===== HERO ===== */}
        <div className="wf-detail-grid">
          <div data-reveal>
            {free && !selVersion && (img || f.hasAudio) ? (
              <PosterPlayer field={f} saved={saved} onDownload={() => { setSaved(true); downloadAudio() }} />
            ) : img ? (
              <figure className="wf-poster-frame">
                <img src={img} alt={f.title} />
              </figure>
            ) : (
              <figure className="wf-poster-frame">
                <div className={`wf-card-media-ph ${cat.ph}`} style={{ aspectRatio: '1 / 1', borderRadius: 12 }} aria-hidden="true">
                  W
                </div>
              </figure>
            )}
          </div>

          <div className="wf-detail-info">
            <span className={`wf-card-cat ${cat.cls}`} data-reveal>
              {cat.label}
            </span>
            <h1 className="wf-detail-title" data-reveal>
              {f.title}
            </h1>
            <div className="wf-detail-by" data-reveal>
              <span>by Waslerr</span>
              {free
                ? sold > 0 && <span>{soldStr} downloads</span>
                : (
                  <>
                    {sold > 0 && <span>{soldStr} sold</span>}
                    <span>lifetime access</span>
                  </>
                )}
            </div>

            {/* one stable data-reveal node so switching free↔paid cuts never
                remounts a fresh (invisible) element that misses the reveal */}
            <div className="wf-detail-priceline" data-reveal>
              {free ? (
                <div className="wf-free-priceline">
                  <span className="wf-free-pill">Free field</span>
                  <span className="wf-free-price">$0</span>
                </div>
              ) : (
                <div className="wf-detail-price">
                  {selVersion ? `$${selVersion.price}` : f.price || `$${total}`}
                </div>
              )}
            </div>

            <VersionPicker field={f} onSelect={setSelVersion} />

            <p className="wf-detail-desc" data-reveal>
              {selVersion?.tagline || f.desc}
            </p>

            <div className="wf-detail-cta" data-reveal>
              {free ? (
                <button
                  className="wf-btn wf-btn-gold wf-mag"
                  onClick={() => { setSaved(true); downloadAudio() }}
                  disabled={!f.hasAudio}
                >
                  <DownloadIcon /> {f.hasAudio ? (saved ? 'Download again' : 'Download free audio') : 'Audio coming soon'}
                </button>
              ) : isPurchased ? (
                <button className="wf-btn wf-btn-gold wf-mag" onClick={downloadAudio} disabled={!f.hasAudio}>
                  <DownloadIcon /> {f.hasAudio ? 'Download your audio' : 'Audio coming soon'}
                </button>
              ) : (
                <>
                  <button className="wf-btn wf-btn-gold wf-mag" onClick={() => goCheckout(f.id, selVersion?.id ?? null)}>
                    Buy now — {selVersion ? `$${selVersion.price}` : f.price || `$${total}`}
                  </button>
                  <button className="wf-btn wf-btn-glass wf-mag" onClick={() => addToCart(f)}>
                    <CartIcon size={16} /> Add to cart
                  </button>
                </>
              )}
              <button className="wf-btn wf-btn-glass wf-mag" onClick={shareField} aria-label="Share this field">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <path d="M8.6 13.5l6.8 4" />
                  <path d="M15.4 6.5l-6.8 4" />
                </svg>{' '}
                Share
              </button>
              <button className="wf-btn wf-btn-glass wf-mag" onClick={() => setMethodOpen(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
                  <rect x="3" y="14" width="4" height="6" rx="1.5" />
                  <rect x="17" y="14" width="4" height="6" rx="1.5" />
                </svg>{' '}
                Listen method
              </button>
            </div>

            {tracks.length > 1 && (
              <div className="wf-tracklist" data-reveal>
                <span className="wf-tracklist-label">{free ? 'All' : 'Your'} {tracks.length} tracks</span>
                {tracks.map((t) => (
                  <button key={t.i} className="wf-track" onClick={() => { setSaved(true); downloadTrack(t.i) }}>
                    <DownloadIcon size={14} /> {t.name}
                  </button>
                ))}
              </div>
            )}

            <div className="wf-spec-chips" data-reveal>
              {(free ? SPEC_FREE : SPEC_PAID).map((s) => (
                <span className="wf-spec-chip" key={s}>
                  {s}
                </span>
              ))}
            </div>

            <div className={`wf-benefits-x${benefitsOpen ? ' open' : ''}`}>
              <button
                className="wf-benefits-trigger"
                aria-expanded={benefitsOpen}
                onClick={() => setBenefitsOpen((o) => !o)}
              >
                <span className="wf-bx-lead">
                  <span className="wf-bx-spark" aria-hidden="true" />
                  <span className="wf-bx-label">
                    {benefitsOpen ? (free ? 'What you wake up to' : 'The benefits') : 'See the benefits'}
                    <span className="wf-bx-count">{benefits.length}</span>
                  </span>
                </span>
                <span className="wf-bx-chev" aria-hidden="true">
                  <ChevronRight size={16} />
                </span>
              </button>
              <div className="wf-benefits-reveal" hidden={!benefitsOpen}>
                <ol className="wf-benefits-list">
                  {benefits.map((b, i) => (
                    <li className="wf-benefit-item" key={b} style={{ '--bi': i }}>
                      <span className="wf-benefit-no">{String(i + 1).padStart(2, '0')}</span>
                      <span className="wf-benefit-text">{b}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== REVIEWS SUMMARY ===== */}
      <section className="wf-rsum">
        <div className="wf-container" style={{ maxWidth: 1080 }}>
          <div className="wf-rsum-head" data-reveal>
            <div className="wf-rsum-score">
              <div className="wf-eyebrow">From the wall</div>
              <div className="wf-rsum-count">
                {fieldStories.length ? `${fieldStories.length} ${fieldStories.length === 1 ? 'story' : 'stories'} for this field` : 'Be the first to share your story'}
              </div>
            </div>
            <div className="wf-rsum-actions">
              <button className="wf-btn wf-btn-gold wf-mag" onClick={() => openReviews(f.id, true)}>
                Share your story
              </button>
              <button className="wf-btn wf-btn-glass wf-mag" onClick={() => openReviews(f.id, false)}>
                Read the wall <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {featured.length > 0 && (
            <div className="wf-story-grid">
              {featured.map((s) => (
                <div data-reveal key={s.id}>
                  <StoryCard story={s} fieldName={nameOf(s.field)} fieldCls={clsOf(s.field)} onField={(id) => openDetail(id)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="wf-disclaimer-wrap" data-reveal>
        <Disclaimer />
      </section>

      <footer className="wf-subfoot">
        <div className="wf-subfoot-row">
          <button className="wf-back" onClick={() => navigate('fields')}>
            ← All fields
          </button>
          <span className="wf-subfoot-note">
            Audio supports mindset &amp; self-improvement. Not medical treatment. Individual results vary.
          </span>
        </div>
      </footer>
      </div>

      {methodOpen && <ListeningMethod field={f} isFree={free} method={selVersion?.method} editable={!selVersion} onClose={() => setMethodOpen(false)} />}
    </div>
  )
}
