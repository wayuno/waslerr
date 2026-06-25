import { useEffect } from 'react'

// Magnetic pull on `.wf-mag` buttons within `ref` — the element drifts toward the
// cursor while hovered, springing back on leave. Desktop only.
export function useMagnetic(ref) {
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    const root = (ref && ref.current) || document
    const els = Array.from(root.querySelectorAll('.wf-mag'))
    const cleanups = els.map((btn) => {
      const onMove = (e) => {
        const r = btn.getBoundingClientRect()
        const mx = e.clientX - (r.left + r.width / 2)
        const my = e.clientY - (r.top + r.height / 2)
        btn.style.transform = `translate(${mx * 0.28}px,${my * 0.4}px)`
      }
      const onLeave = () => {
        btn.style.transform = ''
      }
      btn.addEventListener('mousemove', onMove)
      btn.addEventListener('mouseleave', onLeave)
      return () => {
        btn.removeEventListener('mousemove', onMove)
        btn.removeEventListener('mouseleave', onLeave)
      }
    })
    return () => cleanups.forEach((fn) => fn())
  }, [ref])
}
