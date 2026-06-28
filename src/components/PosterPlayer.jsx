import { useEffect, useRef, useState } from 'react'
import { useAudio } from '../audio/AudioProvider'
import { PlayIcon, PauseIcon, DownloadIcon } from './icons'

const BARS = 48
const GOLD_TINT = '212,175,55'

const fmt = (s) => {
  if (!isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

// Free-field hero: the cover art is a vinyl record you play right here, sitting
// in a frosted glass box that glows in the artwork's own dominant colour. Real
// <audio> + Web Audio analyser drive a live waveform (synthetic-sine fallback
// when the storage URL is cross-origin), with scrubbable progress and download.
export default function PosterPlayer({ field, saved, onDownload }) {
  const { stop } = useAudio()
  const hasAudio = !!field.hasAudio
  const img = field.image_url || field.img

  const [playing, setPlaying] = useState(false)
  const [dur, setDur] = useState(0)
  const [tint, setTint] = useState(GOLD_TINT)
  const audioRef = useRef(null)
  const waveRef = useRef(null)
  const fillRef = useRef(null)
  const curRef = useRef(null)
  const rafRef = useRef(0)
  const graph = useRef({ ctx: null, analyser: null, source: null, data: null, ok: false })

  // ---- dominant vivid colour of the artwork -> --ppl-tint ----
  useEffect(() => {
    if (!img) {
      setTint(GOLD_TINT)
      return
    }
    let cancelled = false
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.onload = () => {
      if (cancelled) return
      try {
        const c = document.createElement('canvas')
        c.width = 24
        c.height = 24
        const cx = c.getContext('2d')
        cx.drawImage(im, 0, 0, 24, 24)
        const { data } = cx.getImageData(0, 0, 24, 24)
        let r = 0
        let g = 0
        let b = 0
        let wsum = 0
        for (let i = 0; i < data.length; i += 4) {
          const R = data[i]
          const G = data[i + 1]
          const B = data[i + 2]
          const mx = Math.max(R, G, B)
          const mn = Math.min(R, G, B)
          const sat = mx === 0 ? 0 : (mx - mn) / mx
          const w = sat * sat + 0.06 // vivid hues outweigh greys
          r += R * w
          g += G * w
          b += B * w
          wsum += w
        }
        if (wsum > 0) setTint(`${Math.round(r / wsum)},${Math.round(g / wsum)},${Math.round(b / wsum)}`)
      } catch {
        setTint(GOLD_TINT) // tainted canvas (cross-origin) — fall back to gold
      }
    }
    im.onerror = () => !cancelled && setTint(GOLD_TINT)
    im.src = img
    return () => {
      cancelled = true
    }
  }, [img])

  // ---- analyser graph (lazy, after a user gesture) ----
  const ensureGraph = () => {
    const g = graph.current
    if (g.ctx) return g
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      g.ctx = new Ctx()
      g.source = g.ctx.createMediaElementSource(audioRef.current)
      g.analyser = g.ctx.createAnalyser()
      g.analyser.fftSize = 128
      g.data = new Uint8Array(g.analyser.frequencyBinCount)
      g.source.connect(g.analyser)
      g.analyser.connect(g.ctx.destination)
      g.ok = true
    } catch {
      g.ok = false
    }
    return g
  }

  const rest = () => {
    const bars = waveRef.current ? Array.from(waveRef.current.children) : []
    bars.forEach((b) => {
      b.style.transform = 'scaleY(0.16)'
      b.style.opacity = '0.4'
    })
  }

  const toggle = () => {
    const a = audioRef.current
    if (!hasAudio || !a) return
    if (playing) {
      a.pause()
      return
    }
    stop() // silence any oscillator preview playing elsewhere
    const g = ensureGraph()
    if (g.ctx && g.ctx.state === 'suspended') g.ctx.resume()
    a.play().catch(() => {})
  }

  // audio element state wiring
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      setPlaying(false)
      a.currentTime = 0
    }
    const onMeta = () => setDur(a.duration || 0)
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    a.addEventListener('ended', onEnded)
    a.addEventListener('loadedmetadata', onMeta)
    return () => {
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('ended', onEnded)
      a.removeEventListener('loadedmetadata', onMeta)
    }
  }, [])

  // pause + reset the clock whenever the field changes
  useEffect(() => {
    const a = audioRef.current
    if (a) a.pause()
    setDur(0)
    if (fillRef.current) fillRef.current.style.width = '0%'
    if (curRef.current) curRef.current.textContent = '0:00'
    rest()
  }, [field.id])

  // visual loop: waveform + progress while playing
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const bars = waveRef.current ? Array.from(waveRef.current.children) : []
    const a = audioRef.current
    if (!playing) {
      rest()
      if (a && fillRef.current) fillRef.current.style.width = (a.duration ? (a.currentTime / a.duration) * 100 : 0) + '%'
      return
    }
    let t = 0
    let last = performance.now()
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      t += dt
      if (a) {
        const d = a.duration || 0
        const ratio = d ? a.currentTime / d : 0
        if (fillRef.current) fillRef.current.style.width = Math.min(100, ratio * 100) + '%'
        if (curRef.current) curRef.current.textContent = fmt(a.currentTime)
      }
      if (!reduce && bars.length) {
        const g = graph.current
        let real = false
        if (g.ok && g.analyser) {
          g.analyser.getByteFrequencyData(g.data)
          let sum = 0
          for (let i = 0; i < g.data.length; i++) sum += g.data[i]
          real = sum > 0
          if (real) {
            for (let i = 0; i < bars.length; i++) {
              const v = (g.data[i % g.data.length] || 0) / 255
              bars[i].style.transform = `scaleY(${Math.max(0.12, v)})`
              bars[i].style.opacity = (0.45 + v * 0.55).toFixed(2)
            }
          }
        }
        if (!real) {
          const e = 0.5 + 0.3 * Math.abs(Math.sin(t * 1.7)) + 0.2 * Math.abs(Math.sin(t * 4.2))
          for (let i = 0; i < bars.length; i++) {
            const v = Math.abs(Math.sin(t * 4 + i * 0.38)) * e
            bars[i].style.transform = `scaleY(${Math.max(0.12, v)})`
            bars[i].style.opacity = (0.45 + v * 0.55).toFixed(2)
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing])

  // pause on unmount
  useEffect(() => () => audioRef.current?.pause(), [])

  const seek = (e) => {
    const a = audioRef.current
    if (!a || !a.duration) return
    const r = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    a.currentTime = ratio * a.duration
    if (fillRef.current) fillRef.current.style.width = ratio * 100 + '%'
    if (curRef.current) curRef.current.textContent = fmt(a.currentTime)
  }

  const badgeLabel = !hasAudio ? 'Audio soon' : saved ? 'Your audio' : 'Free release'

  return (
    <div className={`wf-poster-player${playing ? ' playing' : ''}`} style={{ '--ppl-tint': tint }}>
      {/* colour fill from the artwork — pure CSS background, CORS-proof */}
      {img && <span className="wf-ppl-reflect" style={{ backgroundImage: `url("${img}")` }} aria-hidden="true" />}

      <span className="wf-ppl-badge">
        <span className="wf-ppl-badge-in">
          <span className="wf-ppl-eq" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          {badgeLabel}
        </span>
      </span>

      <div className="wf-ppl-stage">
        <span className="wf-ppl-bloom" aria-hidden="true" />
        {playing && (
          <span className="wf-ppl-rings" aria-hidden="true">
            <i />
            <i />
          </span>
        )}
        <div className="wf-ppl-disc">
          <div className="wf-ppl-disc-spin">
            {img ? (
              <img className="wf-ppl-disc-art" src={img} alt={field.title} />
            ) : (
              <div className="wf-ppl-disc-art wf-ppl-ph" aria-hidden="true">
                {(field.title || 'W').charAt(0)}
              </div>
            )}
            <span className="wf-ppl-grooves" aria-hidden="true" />
          </div>
          <span className="wf-ppl-hub" aria-hidden="true" />
          <button
            className="wf-ppl-btn"
            onClick={toggle}
            disabled={!hasAudio}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
        </div>
      </div>

      <div className="wf-ppl-wave" ref={waveRef} aria-hidden="true">
        {Array.from({ length: BARS }).map((_, i) => (
          <span key={i} />
        ))}
      </div>

      <div className="wf-ppl-bar" onClick={seek}>
        <span className="wf-ppl-fill" ref={fillRef} style={{ width: '0%' }} />
      </div>

      <div className="wf-ppl-status">
        <span className={`wf-ppl-dot${playing ? ' on' : ''}`} aria-hidden="true" />
        <span className="wf-ppl-status-txt">{playing ? 'Now playing' : 'Paused · tap to play'}</span>
        <span className="wf-ppl-time">
          <span ref={curRef}>0:00</span> · {fmt(dur)}
        </span>
      </div>

      <button className="wf-ppl-dl" onClick={onDownload} disabled={!hasAudio}>
        <span className="wf-ppl-dl-in">
          <DownloadIcon size={16} />
          {hasAudio ? (saved ? 'Saved · download again' : 'Download free audio') : 'Audio coming soon'}
        </span>
      </button>

      <audio
        ref={audioRef}
        src={hasAudio ? `/api/fields/${field.id}/audio` : undefined}
        preload="metadata"
        crossOrigin="anonymous"
      />
    </div>
  )
}
