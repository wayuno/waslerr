import { useEffect, useRef } from 'react'
import Background from '../components/Background'
import { useStore } from '../store/StoreProvider'
import { useAudio } from '../audio/AudioProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'
import { fieldBenefits } from '../data/content'
import { PlayIcon, PauseIcon, CheckIcon, ChatIconBubble, ArrowDown } from '../components/icons'

const CATS = {
  desire: { label: 'Desire', cls: '', ph: 'wf-card-ph-desire' },
  akashic: { label: 'Akashic', cls: 'akashic', ph: 'wf-card-ph-akashic' },
  wealth: { label: 'Wealth', cls: 'wealth', ph: 'wf-card-ph-wealth' },
}

export default function Detail() {
  const { selectedProduct, goCheckout, openChat, navigate } = useStore()
  const { activeId, toggle } = useAudio()
  const ref = useRef(null)
  useReveal(ref)
  useMagnetic(ref)

  useEffect(() => {
    if (!selectedProduct) navigate('fields')
  }, [selectedProduct, navigate])
  if (!selectedProduct) return null

  const f = selectedProduct
  const cat = CATS[f.line] || CATS.desire
  const free = !f.price
  const img = f.image_url || f.img
  const playing = activeId === f.id

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
              {f.price || 'Free'}
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
                {free ? (
                  <>
                    Get it free <ArrowDown />
                  </>
                ) : (
                  `Checkout — ${f.price}`
                )}
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
