import { useEffect, useMemo, useState } from 'react'

const normVersions = (raw) =>
  Array.isArray(raw)
    ? raw
        .filter((v) => v && typeof v === 'object')
        .map((v, i) => ({
          id: Number(v.id) || i + 1,
          name: String(v.name || 'Version'),
          price: Math.max(0, Number(v.price) || 0),
          tagline: String(v.tagline || ''),
          method: v.method && typeof v.method === 'object' ? v.method : null,
        }))
    : []

// Visitor version picker: switch "cuts" — price + tagline update with animation.
// The chosen version flows up via onSelect so the buy button charges that price
// (or offers a free listen) and the buyer receives that version's audio. Works
// for paid fields AND free fields that carry versions (free base + paid cuts).
// Admins manage versions from the Field control panel, not here.
export default function VersionPicker({ field, onSelect }) {
  const versions = useMemo(() => normVersions(field.versions), [field.versions])
  const [sel, setSel] = useState('main') // 'main' = the base field, else a version id

  const selectedVersion = sel === 'main' ? null : versions.find((v) => v.id === sel) || null

  useEffect(() => {
    // 'main' → the base field's price/desc/audio; else the chosen cut
    onSelect?.(selectedVersion)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, versions])

  if (versions.length === 0) return null

  return (
    <div className="wf-vp" data-reveal>
      <div className="wf-vp-head">
        <span className="wf-vp-label">Version · choose your cut</span>
      </div>

      <div className="wf-vp-chips">
        <span className={`wf-vp-chip${sel === 'main' ? ' active' : ''}`}>
          <button className="wf-vp-chip-btn" onClick={() => setSel('main')}>
            {field.title || 'Main'}
          </button>
        </span>
        {versions.map((v) => (
          <span key={v.id} className={`wf-vp-chip${v.id === sel ? ' active' : ''}`}>
            <button className="wf-vp-chip-btn" onClick={() => setSel(v.id)}>
              {v.name || 'Untitled'}
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}
