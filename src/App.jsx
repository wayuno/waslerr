import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioProvider } from './audio/AudioProvider'
import Nav from './components/Nav'
import Home from './pages/Home'
import Fields from './pages/Fields'
import Method from './pages/Method'

export default function App() {
  const [page, setPage] = useState('home')
  const [fieldsCat, setFieldsCat] = useState('all')
  const pendingSection = useRef(null)

  // intro overlay — plays once on first load
  const [introLift, setIntroLift] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  useEffect(() => {
    const t1 = setTimeout(() => setIntroLift(true), 2000)
    const t2 = setTimeout(() => setIntroDone(true), 3050)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  const onNavigate = useCallback(
    (target) => {
      const { page: p = 'home', section, cat } = target || {}
      if (cat) setFieldsCat(cat)
      if (p === page && (!cat || p !== 'fields')) {
        if (section) document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' })
        else window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      pendingSection.current = section || null
      setPage(p)
    },
    [page],
  )

  // on page change: jump to top, or to a requested section once it has rendered
  useEffect(() => {
    const id = pendingSection.current
    if (id) {
      pendingSection.current = null
      requestAnimationFrame(() => {
        const el = document.getElementById(id)
        if (el) el.scrollIntoView({ behavior: 'auto' })
        else window.scrollTo(0, 0)
      })
    } else {
      window.scrollTo(0, 0)
    }
  }, [page, fieldsCat])

  return (
    <AudioProvider>
      {!introDone && (
        <div className={`wf-intro${introLift ? ' lift' : ''}`}>
          <span className="wf-intro-logo">W</span>
          <span className="wf-intro-word">WASLERR&nbsp;FIELDS</span>
          <span className="wf-intro-bar">
            <span />
          </span>
        </div>
      )}

      <Nav page={page} onNavigate={onNavigate} />

      {page === 'home' && <Home onNavigate={onNavigate} />}
      {page === 'fields' && <Fields key={`fields-${fieldsCat}`} onNavigate={onNavigate} initialCat={fieldsCat} />}
      {page === 'method' && <Method onNavigate={onNavigate} />}
    </AudioProvider>
  )
}
