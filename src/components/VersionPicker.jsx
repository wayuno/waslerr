import { useRef, useState } from 'react'
import { useStore } from '../store/StoreProvider'

const normVersions = (raw) =>
  Array.isArray(raw)
    ? raw
        .filter((v) => v && typeof v === 'object')
        .map((v, i) => ({
          id: Number(v.id) || i + 1,
          name: String(v.name || 'Version'),
          price: Math.max(0, Number(v.price) || 0),
          tagline: String(v.tagline || ''),
        }))
    : []

// Per-product version picker: visitors switch "cuts" (price + tagline update
// with animation); admins add/remove/edit versions inline (auto-saved to the
// field's `versions` column). There is no fixed limit on the number of versions.
export default function VersionPicker({ field, isFree }) {
  const { isAdmin, updateProduct } = useStore()
  const [versions, setVersions] = useState(() => normVersions(field.versions))
  const [sel, setSel] = useState(() => normVersions(field.versions)[0]?.id ?? null)
  const [admin, setAdmin] = useState(false)
  const saveTimer = useRef()

  // visitors with no versions configured see nothing
  if (!isAdmin && versions.length === 0) return null

  const selected = versions.find((v) => v.id === sel) || versions[0] || null

  const persist = (next) => {
    setVersions(next)
    if (!isAdmin) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => updateProduct(field.id, isFree, { versions: next }), 700)
  }

  const addVersion = () => {
    const id = versions.reduce((m, v) => Math.max(m, v.id), 0) + 1
    const price = (versions[versions.length - 1]?.price ?? 0) + 33
    persist([...versions, { id, name: 'New version', price, tagline: '' }])
    setSel(id)
  }
  const removeVersion = (id) => {
    if (versions.length <= 1) return
    const next = versions.filter((v) => v.id !== id)
    persist(next)
    if (sel === id) setSel(next[0].id)
  }
  const editSel = (patch) => selected && persist(versions.map((v) => (v.id === selected.id ? { ...v, ...patch } : v)))

  return (
    <div className={`wf-vp${admin ? ' admin' : ''}`} data-reveal>
      <div className="wf-vp-head">
        <span className="wf-vp-label">Version · choose your cut</span>
        {isAdmin && (
          <button className={`wf-vp-admin${admin ? ' on' : ''}`} onClick={() => setAdmin((a) => !a)}>
            {admin ? 'Done' : 'Admin'}
          </button>
        )}
      </div>

      <div className="wf-vp-chips">
        {versions.map((v) => (
          <span key={v.id} className={`wf-vp-chip${v.id === (selected && selected.id) ? ' active' : ''}`}>
            <button className="wf-vp-chip-btn" onClick={() => setSel(v.id)}>
              {v.name || 'Untitled'}
            </button>
            {admin && versions.length > 1 && (
              <button className="wf-vp-chip-x" onClick={() => removeVersion(v.id)} aria-label={`Remove ${v.name}`}>
                ✕
              </button>
            )}
          </span>
        ))}
        {admin && (
          <button className="wf-vp-add" onClick={addVersion} aria-label="Add version">
            +
          </button>
        )}
      </div>

      {selected && (
        <div className="wf-vp-detail" key={selected.id}>
          <span className="wf-vp-price">${selected.price}</span>
          {selected.tagline && <span className="wf-vp-tagline">{selected.tagline}</span>}
        </div>
      )}

      {admin && selected && (
        <div className="wf-vp-edit">
          <label className="wf-field">
            <span className="wf-field-label">Version name</span>
            <input className="wf-input" value={selected.name} onChange={(e) => editSel({ name: e.target.value })} />
          </label>
          <div className="wf-form-row">
            <label className="wf-field">
              <span className="wf-field-label">Price ($)</span>
              <input className="wf-input" type="number" min="0" value={selected.price} onChange={(e) => editSel({ price: Math.max(0, Number(e.target.value) || 0) })} />
            </label>
            <label className="wf-field">
              <span className="wf-field-label">Tagline</span>
              <input className="wf-input" value={selected.tagline} onChange={(e) => editSel({ tagline: e.target.value })} />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
