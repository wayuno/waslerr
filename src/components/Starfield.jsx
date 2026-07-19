import { useEffect, useRef, useState } from 'react'

// One global gold "starfield drift" layer behind every page: drifting +
// twinkling gold dust over the dark base, fixed to the viewport. Crisp on
// retina, re-fits on resize, and renders a single static frame under
// prefers-reduced-motion. On phones the continuous rAF canvas is skipped
// entirely (it janks/glitches on mobile GPUs), so the background stays clean.
const GOLD = '233,200,118'
const MAX_R = 2.4
const MIN_R = 0.5
const DRIFT = 16 // base drift speed
const WANDER = 12 // extra sway amplitude
const PEAK_ALPHA = 0.9

export default function Starfield() {
  const ref = useRef(null)
  const [on, setOn] = useState(true)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches
    if (coarse) { setOn(false); return } // no animated canvas on phones
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const COUNT = 190

    let w, h, dpr, stars, raf, glowGrad

    const build = () => {
      stars = Array.from({ length: COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * (MAX_R - MIN_R) + MIN_R,
        a: Math.random() * 0.6 + 0.25,
        sp: Math.random() * 1.5 + 0.5,
        vx: (Math.random() - 0.5) * DRIFT,
        vy: (Math.random() - 0.5) * DRIFT,
        wph: Math.random() * 6.28,
        wsp: Math.random() * 0.8 + 0.3,
        wamp: Math.random() * WANDER + WANDER * 0.5,
      }))
    }
    const fit = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // the ambient glow gradient only depends on w/h — build it once per fit,
      // not every frame (createRadialGradient per frame is needless GC/CPU)
      glowGrad = ctx.createRadialGradient(w / 2, h * -0.1, 0, w / 2, h * -0.1, Math.max(w, h) * 0.7)
      glowGrad.addColorStop(0, `rgba(${GOLD},0.08)`)
      glowGrad.addColorStop(1, `rgba(${GOLD},0)`)
      build()
    }
    const glow = () => {
      ctx.fillStyle = glowGrad
      ctx.fillRect(0, 0, w, h)
    }

    const t0 = performance.now()
    const frame = (now) => {
      const t = (now - t0) / 1000
      ctx.clearRect(0, 0, w, h)
      glow()
      for (const s of stars) {
        s.x += (s.vx + Math.cos(t * s.wsp + s.wph) * s.wamp) * 0.016
        s.y += (s.vy + Math.sin(t * s.wsp + s.wph) * s.wamp) * 0.016
        if (s.x < 0) s.x += w
        if (s.x > w) s.x -= w
        if (s.y < 0) s.y += h
        if (s.y > h) s.y -= h
        const al = Math.min(PEAK_ALPHA, s.a * (0.35 + 0.65 * Math.abs(Math.sin(t * s.sp))))
        ctx.beginPath()
        ctx.fillStyle = `rgba(${GOLD},${al})`
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(frame)
    }
    const still = () => {
      ctx.clearRect(0, 0, w, h)
      glow()
      for (const s of stars) {
        ctx.beginPath()
        ctx.fillStyle = `rgba(${GOLD},${Math.min(PEAK_ALPHA, s.a)})`
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    fit()
    const onResize = () => {
      fit()
      if (reduce) still()
    }
    window.addEventListener('resize', onResize)

    // Pause the loop while the tab is hidden and while the user is actively
    // scrolling. This full-viewport canvas repaints every frame; on low-power
    // laptops that competes with scroll compositing and makes scrolling feel
    // slow/janky. Freezing it during scroll (the last frame stays painted) and
    // resuming ~180ms after scrolling stops keeps scroll smooth.
    let scrollTimer
    const resume = () => {
      if (reduce || raf || document.hidden) return
      raf = requestAnimationFrame(frame)
    }
    const halt = () => {
      cancelAnimationFrame(raf)
      raf = 0
    }
    const onScroll = () => {
      if (reduce) return
      halt() // freeze while scrolling — last frame stays painted
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(resume, 180)
    }
    const onVisibility = () => {
      if (document.hidden) halt()
      else resume()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)

    if (reduce) still()
    else raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(scrollTimer)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return on ? <canvas ref={ref} className="wf-starfield" aria-hidden="true" /> : null
}
