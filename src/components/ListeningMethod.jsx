import { useEffect, useRef, useState } from 'react'
import { CloseIcon } from './icons'
import { useStore } from '../store/StoreProvider'
import { ICON_KEYS, Glyph, uid, normalizeMethod } from './methodShared'

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
