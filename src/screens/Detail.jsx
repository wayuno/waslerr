import { useEffect, useRef, useState } from 'react'
import Background from '../components/Background'
import PreviewPlayer from '../components/PreviewPlayer'
import { useStore } from '../store/StoreProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'
import StoryCard, { Stars } from '../components/StoryCard'
import { benefitsById, genericBenefits, freeBenefits } from '../data/content'
import { averageOf } from '../lib/wall'
import { ChatIconBubble, DownloadIcon, CartIcon, ArrowRight } from '../components/icons'

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
  const { selectedProduct, goCheckout, openChat, navigate, addToCart, openReviews, openDetail, products, wall } = useStore()
  const [saved, setSaved] = useState(false)
  const ref = useRef(null)
  useReveal(ref)
  useMagnetic(ref)

  useEffect(() => {
    if (!selectedProduct) navigate('fields')
  }, [selectedProduct, navigate])
  useEffect(() => setSaved(false), [selectedProduct])

  if (!selectedProduct) return null

  const f = selectedProduct
  const cat = CATS[f.line] || { label: cap(f.line), cls: '', ph: 'wf-card-ph-desire' }
  const total = priceOf(f)
  const free = total === 0
  const img = f.image_url || f.img
  const benefits = benefitsById[f.id] || (free ? freeBenefits : genericBenefits)
  const sold = Number(f.sold) || 0
  const soldStr = sold.toLocaleString('en-US')

  // has this visitor purchased this field? (localStorage flag + order reference)
  let purchaseRef = ''
  let isPurchased = false
  try {
    isPurchased = localStorage.getItem(`wf_purchased_${f.id}`) === '1'
    const orders = JSON.parse(localStorage.getItem('wf_orders') || '[]')
    purchaseRef = (orders.find((o) => o.id === f.id || o.fieldId === f.id || o.name === f.title)?.ref) || ''
  } catch {
    /* ignore */
  }
  const downloadAudio = () => {
    const base = `/api/fields/${f.id}/audio`
    window.open(free ? base : `${base}?ref=${encodeURIComponent(purchaseRef)}`, '_blank')
  }

  const fieldStories = wall.filter((r) => r.field === f.id)
  const featured = [...fieldStories].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.ts - a.ts).slice(0, 3)
  const avg = fieldStories.length ? averageOf(fieldStories) : 4.9
  const rating = avg
  const prodMap = Object.fromEntries(products.map((p) => [p.id, p]))
  const nameOf = (id) => prodMap[id]?.title || 'a Waslerr field'
  const clsOf = (id) => CATS[prodMap[id]?.line]?.cls || ''

  return (
    <div className="wf-app" ref={ref}>
      <Background resonanceTop="48%" />

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
            {img ? (
              <figure className="wf-poster-frame">
                <img src={img} alt={f.title} />
              </figure>
            ) : (
              <PreviewPlayer field={f} />
            )}
          </div>

          <div className="wf-detail-info">
            <span className={`wf-card-cat ${cat.cls}`} data-reveal>
              {cat.label}
            </span>
            <h1 className="wf-detail-title" data-reveal>
              {f.title}
            </h1>
            <span className="wf-card-sub" data-reveal style={{ marginBottom: 18 }}>
              by Waslerr
            </span>

            {free ? (
              <div className="wf-free-priceline" data-reveal>
                <span className="wf-free-pill">Free field</span>
                <span className="wf-free-price">$0</span>
              </div>
            ) : (
              <div className="wf-detail-price" data-reveal>
                {f.price || `$${total}`}
              </div>
            )}

            <div className="wf-detail-metaline" data-reveal>
              {free ? (
                <>
                  {sold > 0 && <>{soldStr} downloads · </>}
                  <Stars rating={rating} /> <span className="wf-gold">{rating}</span>
                </>
              ) : (
                <>
                  <Stars rating={rating} /> <span className="wf-gold">{rating}</span>
                  {sold > 0 && <> · {soldStr} sold</>} · lifetime access
                </>
              )}
            </div>

            <p className="wf-detail-desc" data-reveal>
              {f.desc}
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
                  <button className="wf-btn wf-btn-gold wf-mag" onClick={() => goCheckout(f.id)}>
                    Buy now — {f.price || `$${total}`}
                  </button>
                  <button className="wf-btn wf-btn-glass wf-mag" onClick={() => addToCart(f)}>
                    <CartIcon size={16} /> Add to cart
                  </button>
                </>
              )}
              <button className="wf-btn wf-btn-glass wf-mag" onClick={openChat}>
                <ChatIconBubble size={16} /> Ask a guide
              </button>
            </div>

            <div className="wf-spec-chips" data-reveal>
              {(free ? SPEC_FREE : SPEC_PAID).map((s) => (
                <span className="wf-spec-chip" key={s}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== BENEFITS ===== */}
      <section className="wf-benefits">
        <div className="wf-container" style={{ maxWidth: 820 }}>
          <div className="wf-head-block wf-center" style={{ marginBottom: 38 }}>
            <div className="wf-eyebrow" data-reveal>
              What this field rewires
            </div>
            <h2 className="wf-h2" data-reveal>
              {free ? 'What you wake up to.' : 'The benefits, in full.'}
            </h2>
          </div>
          <div className="wf-benefits-panel">
            {benefits.map((b) => (
              <div className="wf-benefit-row" data-reveal key={b}>
                <span className="wf-benefit-dot" aria-hidden="true" />
                <span className="wf-benefit-text">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== REVIEWS SUMMARY ===== */}
      <section className="wf-rsum">
        <div className="wf-container" style={{ maxWidth: 1080 }}>
          <div className="wf-rsum-head" data-reveal>
            <div className="wf-rsum-score">
              <div className="wf-eyebrow">From the wall</div>
              <div className="wf-rsum-avg">{rating}</div>
              <Stars rating={rating} size={16} />
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
  )
}
