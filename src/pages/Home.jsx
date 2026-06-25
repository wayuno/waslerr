import { useEffect, useRef, useState } from 'react'
import Background from '../components/Background'
import ProductCard from '../components/ProductCard'
import CustomForm from '../components/CustomForm'
import JoinCards from '../components/JoinCards'
import Footer from '../components/Footer'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'
import { topPicks, freeFields, lines, reviews, faqs, tickerItems } from '../data/content'
import { ArrowRight, ArrowDown } from '../components/icons'

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

function FaqItem({ q, a, open, onToggle }) {
  const aRef = useRef(null)
  return (
    <div className={`wf-faq${open ? ' open' : ''}`} data-reveal>
      <button className="wf-faq-q" onClick={onToggle} aria-expanded={open}>
        {q}
        <span className="wf-faq-ic">+</span>
      </button>
      <div
        className="wf-faq-a"
        ref={aRef}
        style={{ maxHeight: open ? (aRef.current ? aRef.current.scrollHeight + 40 : 600) + 'px' : '0px' }}
      >
        <p>{a}</p>
      </div>
    </div>
  )
}

export default function Home({ onNavigate }) {
  const ref = useRef(null)
  const orbitRef = useRef(null)
  const heroRef = useRef(null)
  const [faqOpen, setFaqOpen] = useState(-1)
  useReveal(ref)
  useMagnetic(ref)

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
      <Background particles resonanceTop="46%" />

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

        <div data-anim>
          <span className="wf-pill">
            <i />
            Subliminal audio · engineered for the subconscious
          </span>
        </div>

        <h1 className="wf-hero-h1" data-anim>
          <DecryptText text="Reprogram the mind." order={0} />
          <br />
          <DecryptText text="Reshape your reality." order={1} className="accent" />
        </h1>

        <p className="wf-hero-sub" data-anim>
          Cinematic frequency fields that encode confidence, wealth and magnetism directly into the subconscious — while
          the conscious mind simply listens.
        </p>

        <div className="wf-hero-cta" data-anim>
          <button className="wf-btn wf-btn-gold wf-mag" onClick={() => onNavigate({ page: 'fields' })}>
            Start your transformation
          </button>
          <button className="wf-btn wf-btn-glass wf-mag" onClick={() => onNavigate({ page: 'home', section: 'wf-free' })}>
            Try a field free
          </button>
        </div>

        <div className="wf-trust" data-anim>
          <span className="stars">★★★★★</span>
          <span className="sep" />
          <span>50,000+ listeners across 60 countries</span>
        </div>

        <div className="wf-scrollcue">
          <label>Scroll</label>
          <span className="line">
            <span />
          </span>
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
              01 · Top picks
            </div>
            <h2 className="wf-h2" data-reveal>
              Top picks.
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

          <div className="wf-grid">
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
              Try a few fields, free.
            </h2>
            <p className="wf-lead" data-reveal style={{ margin: '16px 0 0' }}>
              New to subliminals? Start here. These fields are free to keep — no card, no catch. Press play and feel the
              shift.
            </p>
          </div>
          <div className="wf-grid">
            {freeFields.map((f) => (
              <ProductCard key={f.id} field={f} variant="free" />
            ))}
          </div>
        </div>
      </section>

      {/* ===== THREE WAYS + CUSTOM ===== */}
      <section
        className="wf-section wf-section--rule"
        id="wf-custom"
        style={{ background: 'linear-gradient(180deg,transparent,rgba(10,7,9,.5))' }}
      >
        <div className="wf-container" style={{ maxWidth: 1080, paddingTop: 82, paddingBottom: 82 }}>
          <div className="wf-head-block wf-center" style={{ marginBottom: 52 }}>
            <div className="wf-eyebrow" data-reveal>
              02 · The three fields
            </div>
            <h2 className="wf-h2" data-reveal>
              Three ways into the subconscious.
            </h2>
            <p className="wf-lead" data-reveal>
              Every Waslerr field belongs to one of three lines — and the third is written from scratch, for you alone.
            </p>
          </div>

          <div className="wf-lines-grid">
            {lines.map((l) => (
              <div className={`wf-line-card${l.featured ? ' featured' : ''}`} data-reveal key={l.title}>
                <div className="wf-line-idx">{l.idx}</div>
                <h3 className="wf-line-title">{l.title}</h3>
                <p className="wf-line-body" style={l.featured ? { color: '#b6bcc8' } : undefined}>
                  {l.body}
                </p>
                {l.featured ? (
                  <a
                    href="#wf-custom-form-anchor"
                    className="wf-line-meta"
                    onClick={(e) => {
                      e.preventDefault()
                      document.getElementById('wf-custom-form-anchor')?.scrollIntoView({ behavior: 'smooth' })
                    }}
                  >
                    {l.meta} <ArrowDown size={13} />
                  </a>
                ) : (
                  <span className="wf-line-meta">{l.meta}</span>
                )}
              </div>
            ))}
          </div>

          <CustomForm />
        </div>
      </section>

      {/* ===== REVIEWS ===== */}
      <section className="wf-reviews" id="wf-reviews">
        <div style={{ maxWidth: 640, margin: '0 auto 56px', textAlign: 'center', padding: '0 28px' }}>
          <div className="wf-eyebrow" data-reveal>
            03 · Reviews
          </div>
          <h2 className="wf-h2" data-reveal>
            The quiet difference, felt loudly.
          </h2>
        </div>
        <div className="wf-reviews-mask">
          <div className="wf-reviews-track">
            {[...reviews, ...reviews].map((r, i) => (
              <figure className="wf-review" key={i}>
                <div className="stars">★★★★★</div>
                <blockquote>{r.quote}</blockquote>
                <figcaption>
                  <span className="wf-avatar">{r.initial}</span>
                  <span>
                    <span className="name">{r.name}</span>
                    <span className="role">{r.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="wf-section wf-section--rule" id="wf-faq" style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ padding: '82px 28px' }}>
          <div className="wf-center" style={{ marginBottom: 54 }}>
            <div className="wf-eyebrow" data-reveal>
              04 · Questions
            </div>
            <h2 className="wf-h2" data-reveal>
              Everything you wondered.
            </h2>
          </div>
          <div className="wf-faq-list">
            {faqs.map((f, i) => (
              <FaqItem key={f.q} q={f.q} a={f.a} open={faqOpen === i} onToggle={() => setFaqOpen(faqOpen === i ? -1 : i)} />
            ))}
          </div>
        </div>
      </section>

      {/* ===== JOIN ===== */}
      <section className="wf-section wf-section--rule" id="wf-join" style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ padding: '90px 28px' }}>
          <div className="wf-head-block wf-center" style={{ maxWidth: 600, marginBottom: 50 }}>
            <div className="wf-eyebrow" data-reveal>
              Join the party
            </div>
            <h2 className="wf-h2" data-reveal>
              Step inside the Waslerr circle.
            </h2>
            <p className="wf-lead" data-reveal style={{ maxWidth: 480 }}>
              Weekly drops, free fields, and direct access to the creator. Come build with us.
            </p>
          </div>
          <JoinCards />
        </div>
      </section>

      <Footer onNavigate={onNavigate} />
    </div>
  )
}
