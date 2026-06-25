import { useEffect, useRef } from 'react'

// Fixed ambient layers shared across pages: particle constellation (home only),
// resonance rings, and cursor glow + dot + trail.
export default function Background({ particles = false, resonanceTop = '46%' }) {
  const canvasRef = useRef(null)
  const glowRef = useRef(null)
  const dotRef = useRef(null)
  const trailRef = useRef(null)

  // particle constellation
  useEffect(() => {
    if (!particles) return
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    let w, h, dots, raf
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      w = cv.clientWidth
      h = cv.clientHeight
      cv.width = w * dpr
      cv.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.round(Math.min(w, 1400) / 16)
      dots = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.5 + 0.4,
        a: Math.random() * 0.5 + 0.2,
      }))
    }
    resize()
    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      for (let i = 0; i < dots.length; i++) {
        const p = dots[i]
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = w
        if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h
        if (p.y > h) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, 6.283)
        ctx.fillStyle = `rgba(212,175,55,${p.a * 0.55})`
        ctx.fill()
        for (let j = i + 1; j < dots.length; j++) {
          const q = dots[j]
          const dx = p.x - q.x
          const dy = p.y - q.y
          const d = Math.hypot(dx, dy)
          if (d < 130) {
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(q.x, q.y)
            ctx.strokeStyle = `rgba(150,170,210,${(1 - d / 130) * 0.06})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [particles])

  // cursor glow / dot / trail (desktop only)
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    const glow = glowRef.current
    const dot = dotRef.current
    const trail = trailRef.current
    if (!glow) return
    let tx = window.innerWidth / 2
    let ty = window.innerHeight / 2
    let cx = tx
    let cy = ty
    let raf
    let last = 0
    const onMove = (e) => {
      tx = e.clientX
      ty = e.clientY
      if (dot) dot.style.transform = `translate(${tx}px,${ty}px)`
      const now = performance.now()
      if (trail && now - last > 42) {
        last = now
        const s = document.createElement('span')
        s.style.cssText = `position:absolute;left:${tx}px;top:${ty}px;width:6px;height:6px;border-radius:50%;background:radial-gradient(circle,rgba(246,231,180,.85),rgba(212,175,55,.4) 60%,transparent 72%);transform:translate(-50%,-50%);animation:wf-trail .72s ease-out forwards;`
        trail.appendChild(s)
        setTimeout(() => s.remove(), 740)
      }
    }
    const loop = () => {
      cx += (tx - cx) * 0.08
      cy += (ty - cy) * 0.08
      glow.style.transform = `translate(${cx}px,${cy}px)`
      raf = requestAnimationFrame(loop)
    }
    window.addEventListener('mousemove', onMove)
    loop()
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      {particles && <canvas ref={canvasRef} className="wf-particles" />}
      <div className="wf-resonance" aria-hidden="true" style={{ top: resonanceTop }}>
        <span className="r1" />
        <span className="r2" />
        <span className="r3" />
        <span className="core" />
      </div>
      <div ref={glowRef} className="wf-glow" />
      <div ref={trailRef} className="wf-trail" />
      <div ref={dotRef} className="wf-cursor" />
    </>
  )
}
