import { useEffect } from 'react'

// Scroll-reveal + hero-entrance, faithful to the prototype's IntersectionObserver.
// Observes [data-reveal] within `ref` (or document) and adds `.in`; staggers by
// sibling index. [data-anim] elements (hero) reveal immediately on mount.
export function useReveal(ref) {
  useEffect(() => {
    const root = (ref && ref.current) || document
    const items = Array.from(root.querySelectorAll('[data-reveal]'))
    const anim = Array.from(root.querySelectorAll('[data-anim]'))

    // hero entrance — staggered, transition-based so it persists
    anim.forEach((el, i) => {
      el.style.transitionDelay = 0.12 + i * 0.13 + 's'
    })
    const showHero = () => anim.forEach((el) => el.classList.add('in'))
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(showHero)
    })
    const t = setTimeout(showHero, 80)

    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('in'))
      return () => {
        cancelAnimationFrame(raf)
        clearTimeout(t)
      }
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          const el = e.target
          const sibs = Array.from(el.parentElement ? el.parentElement.children : [el]).filter(
            (c) => c.hasAttribute('data-reveal'),
          )
          const idx = Math.max(0, sibs.indexOf(el))
          el.style.transitionDelay = idx * 0.07 + 's'
          el.classList.add('in')
          io.unobserve(el)
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    items.forEach((el) => io.observe(el))

    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
      clearTimeout(t)
    }
  }, [ref])
}
