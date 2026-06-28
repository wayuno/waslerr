import { useState } from 'react'
import { CloseIcon, ChevronRight } from './icons'
import { ICON_KEYS, Glyph, uid } from './methodShared'

// Inline Listening Method editor for the admin field form. Collapsed by default
// (the form is long) — click the header to expand. Controlled: `value` is a
// MethodData object, `onChange(next)` fires on every edit.
export default function MethodEditor({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const data = value
  const setStep = (id, patch) =>
    onChange({ ...data, steps: data.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
  const cycleIcon = (id) => {
    const s = data.steps.find((x) => x.id === id)
    const next = ICON_KEYS[(ICON_KEYS.indexOf(s.icon) + 1) % ICON_KEYS.length]
    setStep(id, { icon: next })
  }
  const addStep = () =>
    onChange({ ...data, steps: [...data.steps, { id: uid(), icon: 'sparkle', title: 'New block', body: 'Describe this step…' }] })
  const delStep = (id) => onChange({ ...data, steps: data.steps.filter((s) => s.id !== id) })
  const setPill = (i, v) => onChange({ ...data, pills: data.pills.map((p, j) => (j === i ? v : p)) })
  const addPill = () => onChange({ ...data, pills: [...data.pills, 'New tag'] })
  const delPill = (i) => onChange({ ...data, pills: data.pills.filter((_, j) => j !== i) })

  return (
    <div className={`wf-me-wrap${open ? ' open' : ''}`}>
      <button type="button" className="wf-me-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>Listening method · {data.steps.length} {data.steps.length === 1 ? 'block' : 'blocks'}</span>
        <ChevronRight size={16} />
      </button>
      {!open ? null : (
    <div className="wf-me">
      <label className="wf-field">
        <span className="wf-field-label">Listening method · headline</span>
        <input className="wf-input" value={data.headline} onChange={(e) => onChange({ ...data, headline: e.target.value })} />
      </label>
      <label className="wf-field">
        <span className="wf-field-label">Intro</span>
        <textarea className="wf-textarea" rows="2" value={data.intro} onChange={(e) => onChange({ ...data, intro: e.target.value })} />
      </label>

      <span className="wf-field-label" style={{ marginTop: 2 }}>Ritual blocks · {data.steps.length}</span>
      <div className="wf-me-blocks">
        {data.steps.map((s, i) => (
          <div className="wf-me-block" key={s.id}>
            <div className="wf-me-block-top">
              <button type="button" className="wf-me-ic" onClick={() => cycleIcon(s.id)} title="Click to change icon">
                <Glyph k={s.icon} size={18} />
              </button>
              <span className="wf-me-num">{String(i + 1).padStart(2, '0')}</span>
              <button type="button" className="wf-me-del" onClick={() => delStep(s.id)} aria-label="Delete block">
                <CloseIcon size={13} />
              </button>
            </div>
            <input className="wf-input" value={s.title} onChange={(e) => setStep(s.id, { title: e.target.value })} placeholder="Block title" />
            <textarea className="wf-textarea" rows="2" value={s.body} onChange={(e) => setStep(s.id, { body: e.target.value })} placeholder="Describe this step…" />
          </div>
        ))}
      </div>
      <button type="button" className="wf-me-add" onClick={addStep}>+ Add block</button>

      <span className="wf-field-label" style={{ marginTop: 12 }}>Rhythm tags · {data.pills.length}</span>
      <div className="wf-me-pills">
        {data.pills.map((p, i) => (
          <span className="wf-me-pill" key={i}>
            <input value={p} onChange={(e) => setPill(i, e.target.value)} />
            <button type="button" onClick={() => delPill(i)} aria-label="Delete tag">✕</button>
          </span>
        ))}
        <button type="button" className="wf-me-pill wf-me-pill-add" onClick={addPill}>+ Add tag</button>
      </div>
    </div>
      )}
    </div>
  )
}
