import { CloseIcon } from './icons'

// Inline versions editor for the admin field form (paid + free). Controlled:
// `value` is the versions array, `onChange(next)` fires on every edit. Each
// version has its own name, price and tagline.
export default function VersionsEditor({ value, onChange }) {
  const versions = Array.isArray(value) ? value : []

  const add = () => {
    const id = versions.reduce((m, v) => Math.max(m, Number(v.id) || 0), 0) + 1
    const price = (versions[versions.length - 1]?.price ?? 0) + 33
    onChange([...versions, { id, name: 'New version', price, tagline: '' }])
  }
  const set = (id, patch) => onChange(versions.map((v) => (v.id === id ? { ...v, ...patch } : v)))
  const del = (id) => onChange(versions.filter((v) => v.id !== id))

  return (
    <div className="wf-field">
      <span className="wf-field-label">Versions · {versions.length} — name, price &amp; tagline per cut (optional)</span>
      {versions.length > 0 && (
        <div className="wf-ve">
          {versions.map((v) => (
            <div className="wf-ve-row" key={v.id}>
              <input className="wf-input wf-ve-name" value={v.name} onChange={(e) => set(v.id, { name: e.target.value })} placeholder="Version name" />
              <input
                className="wf-input wf-ve-price"
                type="number"
                min="0"
                value={v.price}
                onChange={(e) => set(v.id, { price: Math.max(0, Number(e.target.value) || 0) })}
                placeholder="$"
              />
              <input className="wf-input wf-ve-tag" value={v.tagline} onChange={(e) => set(v.id, { tagline: e.target.value })} placeholder="Tagline / description" />
              <button type="button" className="wf-ve-del" onClick={() => del(v.id)} aria-label="Remove version">
                <CloseIcon size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="wf-me-add" onClick={add}>+ Add version</button>
    </div>
  )
}
