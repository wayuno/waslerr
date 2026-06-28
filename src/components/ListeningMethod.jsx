import { useEffect, useRef, useState } from 'react'
import { CloseIcon } from './icons'
import { useStore } from '../store/StoreProvider'

// Lucide-style outline glyphs (1.5px stroke, currentColor)
const ICONS = {
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  volume: (
    <>
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
    </>
  ),
  sunrise: (
    <>
      <path d="M12 2v4M4.9 8.9 6.3 10.3M2 15h2M20 15h2M17.7 10.3l1.4-1.4" />
      <path d="M8 15a4 4 0 0 1 8 0" />
      <path d="M2 19h20" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  headphones: (
    <>
      <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
      <rect x="3" y="14" width="4" height="6" rx="1.5" />
      <rect x="17" y="14" width="4" height="6" rx="1.5" />
    </>
  ),
  sparkle: <path d="M12 3l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  heart: <path d="M12 20s-7-4.6-9.2-9A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 9.2 5C19 15.4 12 20 12 20z" />,
  flame: <path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c0-1 .5-1.5 1-2 1 2 2 3 2 5a5 5 0 0 1-10 0c0-3 3-4 3-7z" />,
}
const ICON_KEYS = Object.keys(ICONS)
const Glyph = ({ k }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {ICONS[k] || ICONS.sparkle}
  </svg>
)

const uid = () => 'b-' + Math.random().toString(36).slice(2, 9)

const defaultMethod = (title) => ({
  headline: 'Listen low. Let it land.',
  intro: `${title || 'This field'} is slightly audible by design — the code sits beneath the music. You don't strain to hear it. You let it work.`,
  steps: [
    { id: uid(), icon: 'moon', title: 'Settle', body: 'Headphones on, lights low. No scrolling, no multitasking — just be received.' },
    { id: uid(), icon: 'volume', title: 'Play it low', body: 'Slightly audible is enough. The code lives under the music — you don’t need to hear words.' },
    { id: uid(), icon: 'sunrise', title: 'Twice a day', body: 'Once in the morning, once as you fall asleep. Consistency is the whole method.' },
    { id: uid(), icon: 'calendar', title: 'Stay 21 days', body: 'The field rewrites slowly. Give it three weeks before you judge what moved.' },
  ],
  pills: ['Headphones recommended', '2× daily', '21-day field', 'Lifetime access'],
})

// Accept a stored method object, fall back to defaults when missing/invalid.
const normalizeMethod = (raw, title) => {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.steps) || !raw.steps.length) return defaultMethod(title)
  return {
    headline: raw.headline || 'Listen low. Let it land.',
    intro: raw.intro || '',
    steps: raw.steps.map((s) => ({
      id: s.id || uid(),
      icon: ICON_KEYS.includes(s.icon) ? s.icon : 'sparkle',
      title: s.title || '',
      body: s.body || '',
    })),
    pills: Array.isArray(raw.pills) ? raw.pills.filter(Boolean) : [],
  }
}

// The Listening Method modal: the written ritual for a field, with an
// admin-only block editor (add / edit / delete) that auto-saves per product.
export default function ListeningMethod({ field, isFree, onClose }) {
  const { isAdmin, updateProduct } = useStore()
  const [edit, setEdit] = useState(false)
  const [data, setData] = useState(() => normalizeMethod(field.method, field.title))
  const saveTimer = useRef()

  // lock scroll + close on Esc
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
      clearTimeout(saveTimer.current)
    }
  }, [onClose])

  // edit + debounce-save to the product's `method` column
  const update = (next) => {
    setData(next)
    if (!isAdmin) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateProduct(field.id, isFree, { method: next })
    }, 700)
  }

  const setStep = (id, patch) => update({ ...data, steps: data.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
  const cycleIcon = (id) => {
    const s = data.steps.find((x) => x.id === id)
    const next = ICON_KEYS[(ICON_KEYS.indexOf(s.icon) + 1) % ICON_KEYS.length]
    setStep(id, { icon: next })
  }
  const addStep = () => update({ ...data, steps: [...data.steps, { id: uid(), icon: 'sparkle', title: 'New block', body: 'Describe this step…' }] })
  const delStep = (id) => update({ ...data, steps: data.steps.filter((s) => s.id !== id) })
  const setPill = (i, v) => update({ ...data, pills: data.pills.map((p, j) => (j === i ? v : p)) })
  const addPill = () => update({ ...data, pills: [...data.pills, 'New tag'] })
  const delPill = (i) => update({ ...data, pills: data.pills.filter((_, j) => j !== i) })

  const num = (i) => String(i + 1).padStart(2, '0')

  return (
    <div className="wf-lm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`wf-lm-panel${edit ? ' editing' : ''}`} role="dialog" aria-label="The listening method">
        <div className="wf-lm-bar">
          {isAdmin ? (
            <button className={`wf-lm-admin${edit ? ' on' : ''}`} onClick={() => setEdit((e) => !e)}>
              {edit ? 'Done editing' : 'Admin · edit blocks'}
            </button>
          ) : (
            <span />
          )}
          <div className="wf-lm-bar-right">
            {edit && <span className="wf-lm-saved">● Auto-saved</span>}
            <button className="wf-lm-close" onClick={onClose} aria-label="Close">
              <CloseIcon size={18} />
            </button>
          </div>
        </div>

        <div className="wf-lm-eyebrow">The listening method</div>
        {edit ? (
          <input className="wf-input wf-lm-h-input" value={data.headline} onChange={(e) => update({ ...data, headline: e.target.value })} />
        ) : (
          <h2 className="wf-lm-headline">{data.headline}</h2>
        )}
        {edit ? (
          <textarea className="wf-textarea wf-lm-intro-input" rows="3" value={data.intro} onChange={(e) => update({ ...data, intro: e.target.value })} />
        ) : (
          data.intro && <p className="wf-lm-intro">{data.intro}</p>
        )}

        <div className="wf-lm-ritual-label">
          The ritual · {data.steps.length} {data.steps.length === 1 ? 'step' : 'steps'}
        </div>
        <div className="wf-lm-grid">
          {data.steps.map((s, i) => (
            <div className="wf-lm-card" key={s.id} style={{ '--d': i }}>
              {edit && (
                <button className="wf-lm-del" onClick={() => delStep(s.id)} aria-label="Delete block">
                  <CloseIcon size={13} />
                </button>
              )}
              <button
                className="wf-lm-ic"
                onClick={() => edit && cycleIcon(s.id)}
                title={edit ? 'Click to change icon' : undefined}
                style={{ cursor: edit ? 'pointer' : 'default' }}
                tabIndex={edit ? 0 : -1}
              >
                <Glyph k={s.icon} />
              </button>
              <span className="wf-lm-num">{num(i)}</span>
              {edit ? (
                <>
                  <input className="wf-input wf-lm-card-title" value={s.title} onChange={(e) => setStep(s.id, { title: e.target.value })} />
                  <textarea className="wf-textarea wf-lm-card-body" rows="3" value={s.body} onChange={(e) => setStep(s.id, { body: e.target.value })} />
                </>
              ) : (
                <>
                  <h3 className="wf-lm-card-h">{s.title}</h3>
                  <p className="wf-lm-card-p">{s.body}</p>
                </>
              )}
            </div>
          ))}
          {edit && (
            <button className="wf-lm-add" onClick={addStep}>
              + Add block
            </button>
          )}
        </div>

        <div className="wf-lm-pills">
          {data.pills.map((p, i) =>
            edit ? (
              <span className="wf-lm-pill editing" key={i}>
                <input value={p} onChange={(e) => setPill(i, e.target.value)} />
                <button onClick={() => delPill(i)} aria-label="Delete tag">
                  ✕
                </button>
              </span>
            ) : (
              <span className="wf-lm-pill" key={i}>
                {p}
              </span>
            ),
          )}
          {edit && (
            <button className="wf-lm-pill wf-lm-pill-add" onClick={addPill}>
              + Add tag
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
