import { useEffect, useRef } from 'react'

// One global gold "starfield drift" layer behind every page: drifting +
// twinkling gold dust over the dark base, fixed to the viewport. Crisp on
// retina, re-fits on resize, and renders a single static frame under
// prefers-reduced-motion.
const GOLD = '233,200,118'
const MAX_R = 2.4
const MIN_R = 0.5
const DRIFT = 16 // base drift speed
const WANDER = 12 // extra sway amplitude
const PEAK_ALPHA = 0.9

export default function Starfield() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const COUNT = coarse ? 120 : 190 // lighter on phones

    let w, h, dpr, stars, raf

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
      build()
    }
    const glow = () => {
      const g = ctx.createRadialGradient(w / 2, h * -0.1, 0, w / 2, h * -0.1, Math.max(w, h) * 0.7)
      g.addColorStop(0, `rgba(${GOLD},0.08)`)
      g.addColorStop(1, `rgba(${GOLD},0)`)
      ctx.fillStyle = g
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
    if (reduce) still()
    else raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas ref={ref} className="wf-starfield" aria-hidden="true" />
}
