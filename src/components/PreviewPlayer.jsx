import { useEffect, useRef } from 'react'
import { useAudio } from '../audio/AudioProvider'
import { PlayIcon, PauseIcon } from './icons'

const BARS = 40

// Square (1:1) glass card holding a circular audio preview: rotating gold
// sunburst rays, a large play/pause button, a live 40-bar waveform and a
// time/status row. Audio (two detuned sines, 30s auto-stop) comes from the
// shared AudioProvider; the bars + button glow are driven by a local energy
// loop that settles to rest on pause.
export default function PreviewPlayer({ field }) {
  const { activeId, toggle } = useAudio()
  const vizRef = useRef(null)
  const fillRef = useRef(null)
  const timeRef = useRef(null)
  const elapsedRef = useRef(0)
  const playing = activeId === field.id

  // reset the clock whenever the field changes
  useEffect(() => {
    elapsedRef.current = 0
    if (fillRef.current) fillRef.current.style.width = '3%'
    if (timeRef.current) timeRef.current.textContent = '0:00'
  }, [field.id])

  useEffect(() => {
    const bars = vizRef.current ? Array.from(vizRef.current.children) : []
    const fill = fillRef.current
    const timeEl = timeRef.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const rest = () =>
      bars.forEach((b) => {
        b.style.height = ''
        b.style.opacity = ''
      })
    if (!playing || reduce) {
      rest()
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
      for (let i = 0; i < bars.length; i++) {
        const v = Math.abs(Math.sin(t * 4 + i * 0.4)) * energy
        bars[i].style.height = 10 + v * 88 + '%'
        bars[i].style.opacity = (0.5 + v * 0.5).toFixed(2)
      }
      elapsedRef.current += dt
      const s = Math.floor(elapsedRef.current)
      if (fill) fill.style.width = Math.min(98, (elapsedRef.current / 30) * 100) + '%'
      if (timeEl) timeEl.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playing, field.id])

  return (
    <div className={`wf-pp${playing ? ' playing' : ''}`}>
      <div className="wf-pp-rays" aria-hidden="true" />
      <div className="wf-pp-core">
        <button
          className={`wf-pp-btn${playing ? ' playing' : ''}`}
          aria-label={playing ? 'Pause preview' : 'Play preview'}
          onClick={() => toggle(field.id, field.freq)}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>

      <div className="wf-pp-viz" ref={vizRef} aria-hidden="true">
        {Array.from({ length: BARS }).map((_, i) => (
          <span key={i} />
        ))}
      </div>

      <div className="wf-pp-status">
        <span className={`wf-now-dot${playing ? ' on' : ''}`} />
        {playing ? 'Now playing' : 'Paused · tap to play'}
      </div>

      <div className="wf-pp-progress">
        <span className="wf-progress-fill" ref={fillRef} style={{ width: '3%' }} />
      </div>
      <div className="wf-pp-time">
        <span ref={timeRef}>0:00</span>
        <span>Sample preview · 0:30</span>
      </div>
    </div>
  )
}
