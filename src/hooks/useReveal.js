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

    // Safety net: [data-reveal]/[data-anim] start at opacity:0 and only become
    // visible once JS adds `.in`. If the IntersectionObserver's initial callback
    // is missed (e.g. a screen swaps in after an auth/data race — the "blank
    // admin panel" bug), content would stay invisible forever. This force-reveals
    // anything still hidden shortly after it mounts, so a page can never be left
    // blank. Debounced so it also covers content mounted later (tab switches).
    let fbTimer
    const forceRevealAll = () => {
      root.querySelectorAll('[data-reveal]:not(.in),[data-anim]:not(.in)').forEach((el) => {
        io?.unobserve(el)
        el.classList.add('in')
      })
    }
    const scheduleFallback = () => {
      clearTimeout(fbTimer)
      fbTimer = setTimeout(forceRevealAll, 1200)
    }

    // initial pass
    Array.from(root.querySelectorAll('[data-reveal]')).forEach(reveal)
    scheduleFallback()

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
        scheduleFallback()
      })
      mo.observe(root, { childList: true, subtree: true })
    }

    return () => {
      io?.disconnect()
      mo?.disconnect()
      cancelAnimationFrame(raf)
      clearTimeout(t)
      clearTimeout(fbTimer)
    }
  }, [ref])
}
