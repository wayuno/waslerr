import { useRef, useState } from 'react'
import { useAudio } from '../audio/AudioProvider'
import { useStore } from '../store/StoreProvider'
import { PlayIcon, PauseIcon, ChevronRight, ArrowDown } from './icons'

const CATS = {
  desire: { label: 'Desire', cls: '' },
  akashic: { label: 'Akashic', cls: 'akashic' },
  wealth: { label: 'Wealth', cls: 'wealth' },
}
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

export default function ProductCard({ field, variant = 'default' }) {
  const { activeId, toggle } = useAudio()
  const { openDetail } = useStore()
  const [open, setOpen] = useState(false)
  const cardRef = useRef(null)
  const glowRef = useRef(null)
  const free = variant === 'free' || !field.price
  const img = field.image_url || field.img
  const playing = activeId === field.id
  const cat = CATS[field.line] || { label: cap(field.line), cls: '' }
  const phClass = field.line === 'akashic' ? 'wf-card-ph-akashic' : field.line === 'wealth' ? 'wf-card-ph-wealth' : 'wf-card-ph-desire'

  const stop = (fn) => (e) => {
    e.stopPropagation()
    fn?.(e)
  }

  const onMove = (e) => {
    const card = cardRef.current
    if (!card) return
    const r = card.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    const rx = (0.5 - py) * 7
    const ry = (px - 0.5) * 7
    card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px)`
    card.style.boxShadow = '0 30px 70px rgba(0,0,0,.5), 0 0 0 1px rgba(212,175,55,.25)'
    card.style.borderColor = 'rgba(212,175,55,.35)'
    if (glowRef.current) {
      glowRef.current.style.opacity = '1'
      glowRef.current.style.left = px * 100 + '%'
      glowRef.current.style.top = py * 100 + '%'
      glowRef.current.style.transform = 'translate(-50%,-50%)'
    }
  }
  const onLeave = () => {
    const card = cardRef.current
    if (!card) return
    card.style.transform = ''
    card.style.boxShadow = ''
    card.style.borderColor = ''
    if (glowRef.current) glowRef.current.style.opacity = '0'
  }

  return (
    <article
      ref={cardRef}
      className="wf-card"
      data-cat={field.line}
      data-reveal
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={() => openDetail(field.id)}
    >
      <div ref={glowRef} className="wf-card-glow" />
      <div className="wf-card-mediawrap">
        {img ? (
          <img className={`wf-card-media${free ? ' free' : ''}`} src={img} alt={field.title} />
        ) : (
          <div className={`wf-card-media${free ? ' free' : ''} wf-card-media-ph ${phClass}`} aria-hidden="true">
            W
          </div>
        )}
        <div className="wf-card-scrim" />
        <span className={`wf-badge${free ? ' wf-badge--free' : ''}`}>{free ? 'Free' : 'New release'}</span>
        <button
          className={`wf-play${playing ? ' playing' : ''}`}
          aria-label={playing ? 'Pause preview' : 'Preview audio'}
          onClick={stop(() => toggle(field.id, field.freq))}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>

      <div className="wf-card-body">
        <h3 className="wf-card-title">{field.title}</h3>
        <span className="wf-card-sub">Waslerr</span>
        <span className={`wf-card-cat ${cat.cls}`}>{cat.label}</span>
        <p className={`wf-desc${!free && !open ? ' clamp' : ''}`}>{field.desc}</p>
        <div className="wf-card-foot">
          {free ? (
            <>
              <span className="wf-price free">Free</span>
              <button className="wf-getfree wf-mag" onClick={stop(() => openDetail(field.id))}>
                Get it free <ArrowDown />
              </button>
            </>
          ) : (
            <>
              <span className="wf-price">{field.price}</span>
              <button className="wf-readmore" onClick={stop(() => setOpen((o) => !o))}>
                {open ? 'Read less' : 'Read more'} <ChevronRight />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
