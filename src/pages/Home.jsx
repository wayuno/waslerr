import { useEffect, useRef, useState } from 'react'
import Background from '../components/Background'
import ProductCard from '../components/ProductCard'
import ReviewWall from '../components/ReviewWall'
import CustomForm from '../components/CustomForm'
import JournalAnnouncements from '../components/JournalAnnouncements'
import Footer from '../components/Footer'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'
import { useStore } from '../store/StoreProvider'
import { tickerItems } from '../data/content'
import { ArrowRight } from '../components/icons'

const EMBERS = [
  { dx: '22px', left: '13%', bottom: '16%', size: 3, color: '#e0a93b', dur: '10s', delay: '0s' },
  { dx: '-14px', left: '24%', bottom: '10%', size: 4, color: '#c8412b', dur: '12s', delay: '1.4s' },
  { dx: '18px', left: '33%', bottom: '20%', size: 2, color: '#f6e7b4', dur: '9s', delay: '.6s' },
  { dx: '-20px', left: '44%', bottom: '8%', size: 3, color: '#e0a93b', dur: '11.5s', delay: '2.2s' },
  { dx: '14px', left: '57%', bottom: '14%', size: 4, color: '#c8412b', dur: '10.5s', delay: '.9s' },
  { dx: '-10px', left: '67%', bottom: '18%', size: 2, color: '#f6e7b4', dur: '13s', delay: '1.8s' },
  { dx: '16px', left: '76%', bottom: '11%', size: 3, color: '#e0a93b', dur: '11s', delay: '3s' },
  { dx: '-18px', left: '86%', bottom: '17%', size: 3, color: '#c8412b', dur: '12.5s', delay: '2.6s' },
]

function DecryptText({ text, order = 0, className, style }) {
  const [out, setOut] = useState(text)
  useEffect(() => {
    // On touch / reduced-motion, skip the scramble entirely — show the final
    // text immediately. In-app mobile browsers throttle rAF, which left the
    // headline mid-scramble (or blank); plain static text is reliable there.
    if (typeof window !== 'undefined' && window.matchMedia &&
        (window.matchMedia('(hover: none)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      setOut(text)
      return
    }
    const glyphs = 'abcdefghijklmnopqrstuvwxyz'
    const start = performance.now() + 360 + order * 240
    const dur = 720
    const rand = () => glyphs[Math.floor(Math.random() * glyphs.length)]
    let raf
    const step = (t) => {
      if (t < start) {
        raf = requestAnimationFrame(step)
        return
      }
      const p = Math.min(1, (t - start) / dur)
      const reveal = Math.floor(p * text.length)
      let s = ''
      for (let c = 0; c < text.length; c++) {
        const ch = text[c]
        if (c < reveal || ch === ' ' || ch === '.') s += ch
        else s += rand()
      }
      setOut(s)
      if (p < 1) raf = requestAnimationFrame(step)
      else setOut(text)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [text, order])
  return (
    <span className={className} style={style}>
      {out}
    </span>
  )
}

export default function Home({ onNavigate }) {
  const { products } = useStore()
  const ref = useRef(null)
  const orbitRef = useRef(null)
  const heroRef = useRef(null)
  useReveal(ref)
  useMagnetic(ref)

  const topPicks = products.filter((p) => p.priceNum > 0).slice(0, 3)
  const freeFields = products.filter((p) => p.priceNum === 0).slice(0, 6)

  // hero parallax on the orbit field
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    const wrap = orbitRef.current
    const hero = heroRef.current
    if (!wrap || !hero) return
    let tx = 0
    let ty = 0
    let cx = 0
    let cy = 0
    let raf
    const onMove = (e) => {
      const r = hero.getBoundingClientRect()
      tx = (e.clientX - r.left) / r.width - 0.5
      ty = (e.clientY - r.top) / r.height - 0.5
    }
    const onLeave = () => {
      tx = 0
      ty = 0
    }
    const loop = () => {
      cx += (tx - cx) * 0.06
      cy += (ty - cy) * 0.06
      wrap.style.transform = `translate(${cx * 40}px,${cy * 40}px) rotate(${cx * 2.2}deg)`
      raf = requestAnimationFrame(loop)
    }
    hero.addEventListener('mousemove', onMove)
    hero.addEventListener('mouseleave', onLeave)
    loop()
    return () => {
      hero.removeEventListener('mousemove', onMove)
      hero.removeEventListener('mouseleave', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="wf-app" ref={ref}>
      <Background resonanceTop="46%" />

      {/* ===== HERO ===== */}
      <section className="wf-hero" id="wf-hero" ref={heroRef}>
        <div className="wf-orbit-wrap" aria-hidden="true" ref={orbitRef}>
          <div className="wf-orbit-conic" />
          <div className="wf-orbit-blue" />
          <div className="wf-ripple wf-ripple-1" />
          <div className="wf-ripple wf-ripple-2" />
          <div className="wf-ripple wf-ripple-3" />
          <div className="wf-orbit-dash" />
          <div className="wf-orbit-ring" />
          <div className="wf-orbit-flat" />
          <div className="wf-orbit-spin">
            <span />
          </div>
        </div>
        <div className="wf-hero-glow-warm" aria-hidden="true" />
        <div className="wf-hero-glow-gold" aria-hidden="true" />
        <div className="wf-embers" aria-hidden="true">
          {EMBERS.map((e, i) => (
            <span
              key={i}
              style={{
                '--dx': e.dx,
                left: e.left,
                bottom: e.bottom,
                width: e.size,
                height: e.size,
                background: e.color,
                boxShadow: `0 0 ${e.size * 3}px ${e.color}`,
                animation: `wf-ember ${e.dur} linear ${e.delay} infinite`,
              }}
            />
          ))}
        </div>

        <h1 className="wf-hero-h1" data-anim>
          <DecryptText text="Reprogram your consciousness" order={0} />
          <br />
          <DecryptText text="Reshape your reality" order={1} className="accent" />
        </h1>

        <div className="wf-hero-lines">
          <button className="wf-hero-line" data-anim onClick={() => onNavigate({ page: 'fields', cat: 'akashic' })}>
            <span className="wf-hero-line-dot" aria-hidden="true" />
            <span>
              <span className="wf-hero-line-name">Akashic fields</span> · for shifting consciousness directly
            </span>
          </button>
          <button className="wf-hero-line" data-anim onClick={() => onNavigate({ page: 'fields', cat: 'desire' })}>
            <span className="wf-hero-line-dot" aria-hidden="true" />
            <span>
              <span className="wf-hero-line-name">Desire code</span> · for imprinting new reality on consciousness
            </span>
          </button>
        </div>

        <div className="wf-hero-cta" data-anim>
          <button className="wf-btn wf-btn-gold wf-mag" onClick={() => onNavigate({ page: 'fields' })}>
            Explore catalogue
          </button>
          <button className="wf-btn wf-btn-glass wf-mag" onClick={() => onNavigate({ page: 'home', section: 'wf-free' })}>
            Tune in
          </button>
        </div>
      </section>

      {/* ===== TICKER ===== */}
      <div className="wf-ticker">
        <div className="wf-ticker-track">
          {[...tickerItems, ...tickerItems].map((t, i) => (
            <span className="wf-ticker-item" key={i}>
              <i />
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* ===== TOP PICKS ===== */}
      <section className="wf-section wf-section--rule wf-pad" id="wf-collection">
        <div className="wf-container">
          <div className="wf-head-block wf-center">
            <div className="wf-eyebrow" data-reveal>
              01 · Latest picks
            </div>
            <h2 className="wf-h2" data-reveal>
              Latest picks.
            </h2>
            <p className="wf-lead" data-reveal>
              A glimpse of the library. Pick a line below to browse every field on the dedicated Fields page.
            </p>
          </div>

          <div className="wf-chips" data-reveal style={{ margin: '44px 0 50px' }}>
            <button className="wf-chip active" onClick={() => onNavigate({ page: 'fields', cat: 'all' })}>
              All fields
            </button>
            <button className="wf-chip" onClick={() => onNavigate({ page: 'fields', cat: 'desire' })}>
              Desire
            </button>
            <button className="wf-chip" onClick={() => onNavigate({ page: 'fields', cat: 'akashic' })}>
              Akashic
            </button>
          </div>

          <div className={`wf-grid${topPicks.length < 3 ? ' wf-grid--few' : ''}`}>
            {topPicks.map((f) => (
              <ProductCard key={f.id} field={f} />
            ))}
          </div>

          <div data-reveal style={{ display: 'flex', justifyContent: 'center', marginTop: 46 }}>
            <button className="wf-btn wf-btn-glass wf-mag" onClick={() => onNavigate({ page: 'fields' })}>
              Browse all fields <ArrowRight />
            </button>
          </div>
        </div>
      </section>

      {/* ===== FREE FIELDS ===== */}
      <section
        className="wf-section wf-section--rule"
        id="wf-free"
        style={{ background: 'linear-gradient(180deg,rgba(212,175,55,.04),transparent 60%)' }}
      >
        <div className="wf-container" style={{ paddingTop: 78, paddingBottom: 78 }}>
          <div style={{ maxWidth: 560, marginBottom: 44 }}>
            <div className="wf-eyebrow wf-eyebrow--dot" data-reveal>
              <i />
              On the house
            </div>
            <h2 className="wf-h2" data-reveal style={{ fontSize: 'clamp(32px,4.6vw,52px)' }}>
              Try a few fields for free.
            </h2>
            <p className="wf-lead" data-reveal style={{ margin: '16px 0 0' }}>
              New to Akashic Field? Start here. These fields are free to keep — no card, no catch. Press play and feel the
              shift.
            </p>
          </div>
          <div className={`wf-grid${freeFields.length < 3 ? ' wf-grid--few' : ''}`}>
            {freeFields.map((f) => (
              <ProductCard key={f.id} field={f} variant="free" />
            ))}
          </div>
        </div>
      </section>

      {/* ===== REVIEW WALL ===== */}
      <ReviewWall />

      {/* ===== CUSTOM CODE ===== */}
      <section
        className="wf-section wf-section--rule"
        id="wf-custom"
        style={{ background: 'linear-gradient(180deg,transparent,rgba(10,7,9,.5))' }}
      >
        <div className="wf-container" style={{ maxWidth: 1080, paddingTop: 82, paddingBottom: 82 }}>
          <CustomForm />
        </div>
      </section>

      {/* ===== JOURNAL & ANNOUNCEMENTS ===== */}
      <JournalAnnouncements onNavigate={onNavigate} />

      <Footer onNavigate={onNavigate} />
    </div>
  )
}
