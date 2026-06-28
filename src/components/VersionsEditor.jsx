import { useState } from 'react'
import { CloseIcon, ChevronRight } from './icons'
import { useStore } from '../store/StoreProvider'

// Collapsible versions editor for the admin field form (paid fields). Each
// version has its own name, price, tagline and gated audio file — the buyer of a
// version is charged that price and receives that version's audio. Collapsed by
// default so the field form stays compact.
export default function VersionsEditor({ value, onChange }) {
  const { uploadAudio } = useStore()
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const versions = Array.isArray(value) ? value : []

  const add = () => {
    const id = versions.reduce((m, v) => Math.max(m, Number(v.id) || 0), 0) + 1
    const price = (versions[versions.length - 1]?.price ?? 0) + 33
    onChange([...versions, { id, name: 'New version', price, tagline: '', audio: '' }])
  }
  const set = (id, patch) => onChange(versions.map((v) => (v.id === id ? { ...v, ...patch } : v)))
  const del = (id) => onChange(versions.filter((v) => v.id !== id))
  const pickAudio = async (id, file) => {
    if (!file) return
    setBusyId(id)
    const r = await uploadAudio(file)
    setBusyId(null)
    if (r?.path) set(id, { audio: r.path })
  }

  return (
    <div className={`wf-me-wrap${open ? ' open' : ''}`}>
      <button type="button" className="wf-me-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>Versions · {versions.length} (per-cut price &amp; audio)</span>
        <ChevronRight size={16} />
      </button>
      {open && (
        <div className="wf-ve">
          {versions.map((v) => (
            <div className="wf-ve-card" key={v.id}>
              <div className="wf-ve-row">
                <input className="wf-input wf-ve-name" value={v.name} onChange={(e) => set(v.id, { name: e.target.value })} placeholder="Version name" />
                <input
                  className="wf-input wf-ve-price"
                  type="number"
                  min="0"
                  value={v.price}
                  onChange={(e) => set(v.id, { price: Math.max(0, Number(e.target.value) || 0) })}
                  placeholder="$"
                />
                <button type="button" className="wf-ve-del" onClick={() => del(v.id)} aria-label="Remove version">
                  <CloseIcon size={13} />
                </button>
              </div>
              <input className="wf-input" value={v.tagline} onChange={(e) => set(v.id, { tagline: e.target.value })} placeholder="Tagline / description" />
              <label className="wf-field" style={{ width: '100%' }}>
                <span className="wf-field-label">
                  Version audio {busyId === v.id ? '· uploading…' : v.audio ? '· set (replace)' : '(none — buyers of this version get it)'}
                </span>
                <input className="wf-input wf-file" type="file" accept="audio/*" onChange={(e) => pickAudio(v.id, e.target.files?.[0])} />
              </label>
            </div>
          ))}
          <button type="button" className="wf-me-add" onClick={add}>+ Add version</button>
        </div>
      )}
    </div>
  )
}
