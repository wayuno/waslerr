import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// Web Audio preview: two detuned sine oscillators through a lowpass, gain ramp,
// auto-stop after 30s, only one source at a time. Faithful to the prototype.
const AudioCtx = createContext(null)

export function AudioProvider({ children }) {
  const [activeId, setActiveId] = useState(null)
  const ps = useRef({ ctx: null, osc: null, gain: null, timer: null })

  const stop = useCallback(() => {
    const s = ps.current
    if (s.timer) {
      clearTimeout(s.timer)
      s.timer = null
    }
    if (s.gain && s.ctx) {
      try {
        s.gain.gain.linearRampToValueAtTime(0, s.ctx.currentTime + 0.25)
      } catch {
        /* noop */
      }
    }
    if (s.osc) {
      const o = s.osc
      setTimeout(() => {
        try {
          o[0].stop()
          o[1].stop()
        } catch {
          /* noop */
        }
      }, 300)
      s.osc = null
    }
    setActiveId(null)
  }, [])

  const toggle = useCallback(
    (id, freq) => {
      const s = ps.current
      if (activeId === id) {
        stop()
        return
      }
      // stop any current source before starting a new one
      if (s.timer) clearTimeout(s.timer)
      if (s.gain && s.ctx) {
        try {
          s.gain.gain.linearRampToValueAtTime(0, s.ctx.currentTime + 0.2)
        } catch {
          /* noop */
        }
      }
      if (s.osc) {
        const o = s.osc
        setTimeout(() => {
          try {
            o[0].stop()
            o[1].stop()
          } catch {
            /* noop */
          }
        }, 260)
        s.osc = null
      }
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext
        s.ctx = s.ctx || new Ctx()
        if (s.ctx.state === 'suspended') s.ctx.resume()
        const ctx = s.ctx
        const g = ctx.createGain()
        g.gain.value = 0
        g.connect(ctx.destination)
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 540
        lp.Q.value = 0.6
        lp.connect(g)
        const base = parseFloat(freq) || 210
        const o1 = ctx.createOscillator()
        o1.type = 'sine'
        o1.frequency.value = base
        o1.connect(lp)
        const o2 = ctx.createOscillator()
        o2.type = 'sine'
        o2.frequency.value = base + 4.5
        o2.connect(lp)
        o1.start()
        o2.start()
        g.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 0.7)
        s.osc = [o1, o2]
        s.gain = g
      } catch {
        /* audio unavailable — still toggle visual state */
      }
      setActiveId(id)
      s.timer = setTimeout(() => stop(), 30000)
    },
    [activeId, stop],
  )

  useEffect(() => () => stop(), [stop])

  return <AudioCtx.Provider value={{ activeId, toggle, stop }}>{children}</AudioCtx.Provider>
}

export function useAudio() {
  return useContext(AudioCtx)
}
