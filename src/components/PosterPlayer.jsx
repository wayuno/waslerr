import { useEffect, useRef, useState } from 'react'
import { useAudio } from '../audio/AudioProvider'
import { PlayIcon, PauseIcon, DownloadIcon, CheckIcon } from './icons'

const BARS = 48

const fmt = (s) => {
  if (!isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

// The cover art IS the player: tap to play the real field audio, with a live
// waveform (real AnalyserNode, synthetic-sine fallback when the storage URL is
// cross-origin), a scrubbable progress rail, time and a download button —
// without ever leaving the photo. Used for free fields on the detail page.
export default function PosterPlayer({ field, saved, onDownload }) {
  const { stop } = useAudio()
  const hasAudio = !!field.hasAudio
  const img = field.image_url || field.img

  const [playing, setPlaying] = useState(false)
  const [dur, setDur] = useState(0)
  const audioRef = useRef(null)
  const waveRef = useRef(null)
  const fillRef = useRef(null)
  const curRef = useRef(null)
  const rafRef = useRef(0)
  const graph = useRef({ ctx: null, analyser: null, source: null, data: null, ok: false })

  // Build the Web Audio analyser graph lazily, on the first user gesture.
  // createMediaElementSource can only run once per element and may throw on a
  // cross-origin / redirected storage URL — in which case we fall back to a
  // synthetic waveform so the bars still move.
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
      b.style.transform = 'scaleY(0.18)'
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
          // synthetic sine-driven fallback (cross-origin / silent analyser)
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

  return (
    <div className={`wf-poster-player${playing ? ' playing' : ''}`}>
      <div className="wf-ppl-art-wrap">
        {img ? (
          <img className="wf-ppl-art" src={img} alt={field.title} />
        ) : (
          <div className="wf-ppl-ph" aria-hidden="true">
            {(field.title || 'W').charAt(0)}
          </div>
        )}
        <div className="wf-ppl-scrim" aria-hidden="true" />

        <span className="wf-ppl-badge">
          <span className="wf-ppl-eq" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          {hasAudio ? (playing ? 'Now playing' : 'Listen free') : 'Soon'}
        </span>

        <div className="wf-ppl-center">
          {playing && (
            <span className="wf-ppl-rings" aria-hidden="true">
              <i />
              <i />
            </span>
          )}
          <span className="wf-ppl-rays" aria-hidden="true" />
          <button
            className="wf-ppl-btn"
            onClick={toggle}
            disabled={!hasAudio}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
        </div>

        <div className="wf-ppl-rail">
          <div className="wf-ppl-wave" ref={waveRef} aria-hidden="true">
            {Array.from({ length: BARS }).map((_, i) => (
              <span key={i} />
            ))}
          </div>
          <div className="wf-ppl-bar" onClick={seek}>
            <span className="wf-ppl-fill" ref={fillRef} style={{ width: '0%' }} />
          </div>
          <div className="wf-ppl-foot">
            <span className="wf-ppl-time">
              <span ref={curRef}>0:00</span> / {fmt(dur)}
            </span>
            <button className="wf-ppl-dl" onClick={onDownload} disabled={!hasAudio}>
              {saved ? <CheckIcon size={14} /> : <DownloadIcon size={14} />}
              {saved ? 'Saved' : 'Download'}
            </button>
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={hasAudio ? `/api/fields/${field.id}/audio` : undefined}
        preload="metadata"
        crossOrigin="anonymous"
      />
    </div>
  )
}
