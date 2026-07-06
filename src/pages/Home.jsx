import { useEffect, useRef, useState } from 'react'
import Background from '../components/Background'
import CosmicHero from '../components/CosmicHero'
import ProductCard from '../components/ProductCard'
import ReviewWall from '../components/ReviewWall'
import CustomForm from '../components/CustomForm'
import ArticlesSlideshow from '../components/ArticlesSlideshow'
import Footer from '../components/Footer'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'
import { useStore } from '../store/StoreProvider'
import { tickerItems } from '../data/content'
import { ArrowRight } from '../components/icons'

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

// admin-pinned ids float to the front (in pin order); everything else keeps
// its newest-first order, so fresh uploads still surface automatically
const orderByPicks = (list, pins) => {
  if (!pins?.length) return list
  const pinned = pins.map((id) => list.find((p) => p.id === id)).filter(Boolean)
  return [...pinned, ...list.filter((p) => !pins.includes(p.id))]
}

export default function Home({ onNavigate }) {
  const { products, topPicks: pinned } = useStore()
  const ref = useRef(null)
  useReveal(ref)
  useMagnetic(ref)

  const topPicks = orderByPicks(products.filter((p) => p.priceNum > 0), pinned.paid).slice(0, 3)
  const freeFields = orderByPicks(products.filter((p) => p.priceNum === 0), pinned.free).slice(0, 6)

  return (
    <div className="wf-app" ref={ref}>
      <Background resonanceTop="46%" />

      {/* ===== HERO ===== */}
      <section className="wf-hero" id="wf-hero">
        <CosmicHero />

        <h1 className="wf-hero-h1" data-anim>
          <DecryptText text="Reprogram consciousness" order={0} />
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

      {/* ===== THE ARTICLES (slideshow) ===== */}
      <ArticlesSlideshow />

      <Footer onNavigate={onNavigate} />
    </div>
  )
}
