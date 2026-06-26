import { useEffect, useRef, useState } from 'react'
import Background from '../components/Background'
import Starfield from '../components/Starfield'
import { useStore } from '../store/StoreProvider'
import { useAudio } from '../audio/AudioProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'
import { fieldBenefits } from '../data/content'
import {
  PlayIcon,
  PauseIcon,
  CheckIcon,
  ChatIconBubble,
  DownloadIcon,
  ShareIcon,
  LinkIcon,
  XIcon,
  WhatsAppIcon,
  TelegramIcon,
} from '../components/icons'

const CATS = {
  desire: { label: 'Desire', cls: '', ph: 'wf-card-ph-desire' },
  akashic: { label: 'Akashic', cls: 'akashic', ph: 'wf-card-ph-akashic' },
  wealth: { label: 'Wealth', cls: 'wealth', ph: 'wf-card-ph-wealth' },
}
const LAYERS = [
  { n: '01', title: 'Desire Code', body: 'Present-tense affirmations that encode the outcome, written to slip past the critical mind.' },
  { n: '02', title: 'Akashic Field', body: 'A calm delta-state carrier that opens the subconscious and holds the suggestions.' },
  { n: '03', title: 'Frequency Carrier', body: 'Studio-mastered sub-bass and silent layers tuned for nightly headphone looping.' },
]
const META_CHIPS = ['22 min loop', '3 engineered layers', 'FLAC', 'MP3', 'Lifetime']
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')
const TRUST = ['100% free · no card required', 'Instant download', 'FLAC + MP3 included', 'Loved by 50,000+ listeners']

const hashStr = (s) => {
  let h = 0
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) >>> 0
  return h
}

const VIZ_BARS = 42

export default function Detail() {
  const { selectedProduct, goCheckout, openChat, navigate } = useStore()
  const { activeId, toggle } = useAudio()
  const [saved, setSaved] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef(null)
  const coverRef = useRef(null)
  const vizRef = useRef(null)
  const fillRef = useRef(null)
  const timeRef = useRef(null)
  const elapsedRef = useRef(0)
  useReveal(ref)
  useMagnetic(ref)

  const playingNow = selectedProduct && activeId === selectedProduct.id

  useEffect(() => {
    if (!selectedProduct) navigate('fields')
  }, [selectedProduct, navigate])
  useEffect(() => {
    setSaved(false)
    setShareOpen(false)
    elapsedRef.current = 0
    if (fillRef.current) fillRef.current.style.width = '4%'
    if (timeRef.current) timeRef.current.textContent = '0:00'
  }, [selectedProduct])

  // Shared "energy" signal drives the cover wash, the bars and the progress in
  // sync while playing; everything settles to rest on pause.
  useEffect(() => {
    const cover = coverRef.current
    const bars = vizRef.current ? Array.from(vizRef.current.children) : []
    const fill = fillRef.current
    const timeEl = timeRef.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const rest = () => {
      // clear inline so the CSS base + transition smoothly settle to rest
      if (cover) {
        cover.style.transform = ''
        cover.style.opacity = ''
        cover.style.filter = ''
      }
      bars.forEach((b) => {
        b.style.height = ''
        b.style.opacity = ''
      })
    }
    if (!playingNow) {
      rest()
      return
    }
    if (reduce) {
      if (cover) cover.style.opacity = '0.6'
      return
    }
    let raf
    let t = 0
    let last = performance.now()
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      t += dt
      const energy = Math.min(1, 0.45 + 0.32 * Math.abs(Math.sin(t * 1.7)) + 0.18 * Math.abs(Math.sin(t * 4.2)))
      const beat = Math.max(0, Math.sin(t * 3.1))
      if (cover) {
        cover.style.transform = `scale(${(1.2 + energy * 0.09 + beat * 0.03).toFixed(3)})`
        cover.style.opacity = (0.42 + energy * 0.28).toFixed(3)
        cover.style.filter = `blur(36px) saturate(${(1.3 + energy * 0.6).toFixed(2)}) brightness(${(0.55 + energy * 0.3).toFixed(2)})`
      }
      for (let i = 0; i < bars.length; i++) {
        const v = Math.abs(Math.sin(t * 4 + i * 0.45)) * energy
        bars[i].style.height = 12 + v * 86 + '%'
        bars[i].style.opacity = (0.5 + v * 0.5).toFixed(2)
      }
      elapsedRef.current += dt
      const s = Math.floor(elapsedRef.current)
      if (fill) fill.style.width = Math.min(96, elapsedRef.current * 3) + '%'
      if (timeEl) timeEl.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playingNow, selectedProduct])

  if (!selectedProduct) return null

  const f = selectedProduct
  const cat = CATS[f.line] || { label: cap(f.line), cls: '', ph: 'wf-card-ph-desire' }
  const free = !f.price
  const img = f.image_url || f.img
  const playing = activeId === f.id

  const shareUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const shareText = `Listen to ${f.title} on Waslerr Fields`
  const copyLink = () => {
    try {
      navigator.clipboard?.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* ignore */
    }
  }

  // -------- PAID layout (unchanged) --------
  if (!free) {
    return (
      <div className="wf-app" ref={ref}>
        <Background resonanceTop="50%" />
        <section className="wf-section" style={{ maxWidth: 1180, margin: '0 auto', padding: '110px 28px 90px' }}>
          <button className="wf-back" data-reveal onClick={() => navigate('fields')} style={{ marginBottom: 28 }}>
            ← All fields
          </button>
          <div className="wf-detail-grid">
            <div className="wf-detail-media" data-reveal>
              {img ? (
                <img src={img} alt={f.title} className="wf-detail-img" />
              ) : (
                <div className={`wf-detail-ph ${cat.ph}`} aria-hidden="true">
                  W
                </div>
              )}
              <button
                className={`wf-detail-play${playing ? ' playing' : ''}`}
                aria-label={playing ? 'Pause preview' : 'Play preview'}
                onClick={() => toggle(f.id, f.freq)}
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </button>
              <div className={`wf-wave${playing ? ' playing' : ''}`} aria-hidden="true">
                {Array.from({ length: 8 }).map((_, i) => (
                  <span key={i} style={{ animationDelay: `${i * 0.11}s` }} />
                ))}
              </div>
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
              <div className="wf-detail-price" data-reveal>
                {f.price}
              </div>
              <p className="wf-detail-desc" data-reveal>
                {f.desc}
              </p>
              <ul className="wf-check-list" data-reveal style={{ marginBottom: 30 }}>
                {fieldBenefits.map((b) => (
                  <li key={b}>
                    <CheckIcon />
                    {b}
                  </li>
                ))}
              </ul>
              <div className="wf-detail-cta" data-reveal>
                <button className="wf-btn wf-btn-gold wf-mag" onClick={() => goCheckout(f.id)}>
                  Checkout — {f.price}
                </button>
                <button className="wf-btn wf-btn-glass wf-mag" onClick={openChat}>
                  <ChatIconBubble size={16} /> Ask a guide
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }

  // -------- FREE layout (reactive player + Free/Download/Share) --------
  const downloads = (8000 + (hashStr(f.id) % 18000)).toLocaleString('en-US')
  return (
    <div className="wf-app" ref={ref}>
      <Starfield />
      <section className="wf-section wf-free-detail" style={{ maxWidth: 1180, margin: '0 auto' }}>
        <nav className="wf-breadcrumb" data-reveal>
          <button onClick={() => navigate('fields')}>All fields</button>
          <span>›</span>
          <span>{cat.label}</span>
          <span>›</span>
          <span className="wf-bc-title">{f.title}</span>
        </nav>

        <div className="wf-free-grid">
          <div className="wf-player-box">
              <div
                ref={coverRef}
                className="wf-cover-layer"
                style={img ? { backgroundImage: `url(${img})` } : undefined}
                aria-hidden="true"
              />
              <div className="wf-cover-scrim" aria-hidden="true" />
              <div className="wf-grooves" aria-hidden="true" />
              <div className="wf-player-inner">
                <div className={`wf-disc${playing ? ' playing' : ''}`}>
                  {img ? (
                    <img src={img} alt={f.title} />
                  ) : (
                    <div className={`wf-disc-ph ${cat.ph}`} aria-hidden="true">
                      W
                    </div>
                  )}
                  <span className="wf-disc-hole" aria-hidden="true" />
                  <button
                    className={`wf-disc-play${playing ? ' playing' : ''}`}
                    aria-label={playing ? 'Pause' : 'Play'}
                    onClick={() => toggle(f.id, f.freq)}
                  >
                    {playing ? <PauseIcon /> : <PlayIcon />}
                  </button>
                </div>

                <div className="wf-now">
                  <span className={`wf-now-dot${playing ? ' on' : ''}`} />
                  {playing ? 'Now playing' : 'Paused · tap to play'}
                </div>
                <div className="wf-viz" ref={vizRef} aria-hidden="true">
                  {Array.from({ length: VIZ_BARS }).map((_, i) => (
                    <span key={i} />
                  ))}
                </div>
                <div className="wf-progress-row">
                  <span className="wf-progress-track">
                    <span className="wf-progress-fill" ref={fillRef} style={{ width: '4%' }} />
                  </span>
                </div>
                <div className="wf-time-row">
                  <span ref={timeRef}>0:00</span>
                  <span>Sample preview · 22:00</span>
                </div>
              </div>
            </div>

            <div className="wf-layers" data-reveal>
              <div className="wf-eyebrow" style={{ marginBottom: 18 }}>
                Engineered in three layers
              </div>
              <div className="wf-layers-grid">
                {LAYERS.map((l) => (
                  <div className="wf-layer-card" key={l.n}>
                    <span className="wf-layer-n">{l.n}</span>
                    <h4>{l.title}</h4>
                    <p>{l.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="wf-meta-chips" data-reveal>
              {META_CHIPS.map((m) => (
                <span className="wf-meta-chip" key={m}>
                  {m}
                </span>
              ))}
            </div>

          <aside className="wf-buy" data-reveal>
            <div className="wf-buy-card">
              <span className={`wf-card-cat ${cat.cls}`} style={{ marginBottom: 14, display: 'block' }}>
                {cat.label}
              </span>
              <h1 className="wf-detail-title" style={{ fontSize: 'clamp(28px,3.4vw,40px)', marginBottom: 16 }}>
                {f.title}
              </h1>
              <div className="wf-free-priceline">
                <span className="wf-free-pill">Free field</span>
                <span className="wf-free-price">$0</span>
              </div>
              <div className="wf-buy-stats">
                {downloads} downloads · <span className="wf-gold">★ 4.9</span>
              </div>

              <button
                className={`wf-download-btn wf-mag${saved ? ' saved' : ''}`}
                onClick={() => setSaved(true)}
                disabled={saved}
              >
                {saved ? (
                  <>
                    <CheckIcon size={16} /> Saved to your library
                  </>
                ) : (
                  <>
                    <DownloadIcon /> Download free audio
                  </>
                )}
              </button>

              <div className="wf-buy-row">
                <button className="wf-btn wf-btn-glass wf-mag" onClick={() => setShareOpen((o) => !o)}>
                  <ShareIcon /> Share
                </button>
                <button className="wf-btn wf-btn-glass wf-mag" onClick={openChat}>
                  <ChatIconBubble size={16} /> Ask a guide
                </button>
              </div>

              {shareOpen && (
                <div className="wf-share-pop">
                  <button className="wf-share-tile" onClick={copyLink}>
                    <LinkIcon />
                    <span>{copied ? 'Copied!' : 'Copy link'}</span>
                  </button>
                  <a
                    className="wf-share-tile"
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener"
                  >
                    <XIcon size={16} />
                    <span>X</span>
                  </a>
                  <a
                    className="wf-share-tile"
                    href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`}
                    target="_blank"
                    rel="noopener"
                  >
                    <WhatsAppIcon />
                    <span>WhatsApp</span>
                  </a>
                  <a
                    className="wf-share-tile"
                    href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
                    target="_blank"
                    rel="noopener"
                  >
                    <TelegramIcon />
                    <span>Telegram</span>
                  </a>
                </div>
              )}

              <ul className="wf-trust">
                {TRUST.map((t) => (
                  <li key={t}>
                    <CheckIcon size={14} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}
