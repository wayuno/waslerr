import { useEffect } from 'react'

// Scroll-reveal + hero-entrance. Observes [data-reveal] within `ref` and adds
// `.in` when in view (staggered by sibling index). A MutationObserver also
// catches elements added later (tab switches, success states, filtered grids)
// so dynamically-mounted content never stays stuck invisible.
export function useReveal(ref) {
  useEffect(() => {
    const root = (ref && ref.current) || document
    const hasIO = 'IntersectionObserver' in window

    const io = hasIO
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              if (!e.isIntersecting) return
              const el = e.target
              const sibs = Array.from(el.parentElement ? el.parentElement.children : [el]).filter((c) =>
                c.hasAttribute('data-reveal'),
              )
              const idx = Math.max(0, sibs.indexOf(el))
              el.style.transitionDelay = idx * 0.07 + 's'
              el.classList.add('in')
              io.unobserve(el)
            })
          },
          { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
        )
      : null

    const reveal = (el) => {
      if (el.classList.contains('in')) return
      if (!io) {
        el.classList.add('in')
        return
      }
      io.observe(el)
    }
    const scan = (node) => {
      if (!node || node.nodeType !== 1) return
      if (node.matches?.('[data-reveal]')) reveal(node)
      node.querySelectorAll?.('[data-reveal]').forEach(reveal)
    }

    // initial pass
    Array.from(root.querySelectorAll('[data-reveal]')).forEach(reveal)

    // hero entrance ([data-anim]) — reveal immediately, staggered
    const anim = Array.from(root.querySelectorAll('[data-anim]'))
    anim.forEach((el, i) => {
      el.style.transitionDelay = 0.12 + i * 0.13 + 's'
    })
    const showHero = () => anim.forEach((el) => el.classList.add('in'))
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(showHero)
    })
    const t = setTimeout(showHero, 80)

    // watch for content mounted after this effect ran
    let mo
    if ('MutationObserver' in window && root !== document) {
      mo = new MutationObserver((muts) => {
        muts.forEach((m) => m.addedNodes.forEach(scan))
      })
      mo.observe(root, { childList: true, subtree: true })
    }

    return () => {
      io?.disconnect()
      mo?.disconnect()
      cancelAnimationFrame(raf)
      clearTimeout(t)
    }
  }, [ref])
}
