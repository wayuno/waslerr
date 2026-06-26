import { useEffect, useRef } from 'react'

// Gentle ambient background for the free field page: ~150 warm-gold specks that
// drift slowly upward and twinkle (sine-driven opacity). DPR-aware, re-seeds on
// resize, honors reduced-motion.
export default function Starfield() {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w, h, stars, raf

    const resize = () => {
      w = cv.clientWidth
      h = cv.clientHeight
      cv.width = w * dpr
      cv.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const n = Math.round(Math.min(w, 1400) / 9)
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.4 + 0.3,
        vy: -(Math.random() * 0.24 + 0.05),
        tw: Math.random() * 6.28,
        ts: Math.random() * 0.035 + 0.008,
        a: Math.random() * 0.5 + 0.3,
      }))
    }
    resize()

    const paint = (animate) => {
      ctx.clearRect(0, 0, w, h)
      for (const s of stars) {
        if (animate) {
          s.y += s.vy
          if (s.y < -2) {
            s.y = h + 2
            s.x = Math.random() * w
          }
          s.tw += s.ts
        }
        const a = s.a * (animate ? 0.5 + 0.5 * Math.sin(s.tw) : 1)
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, 6.283)
        ctx.fillStyle = `rgba(228,198,120,${a})`
        ctx.fill()
      }
    }

    if (reduce) {
      paint(false)
    } else {
      const loop = () => {
        paint(true)
        raf = requestAnimationFrame(loop)
      }
      loop()
    }
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])
  return <canvas ref={ref} className="wf-starfield" aria-hidden="true" />
}
