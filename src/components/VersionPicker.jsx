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
        }))
    : []

// Visitor version picker (paid fields): switch "cuts" — price + tagline update
// with animation. The chosen version flows up via onSelect so the buy button
// charges that price and the buyer receives that version's audio. Admins manage
// versions from the Field control panel, not here.
export default function VersionPicker({ field, isFree, onSelect }) {
  const versions = useMemo(() => normVersions(field.versions), [field.versions])
  const [sel, setSel] = useState(() => versions[0]?.id ?? null)

  const selected = versions.find((v) => v.id === sel) || versions[0] || null

  useEffect(() => {
    // free fields aren't priced per version — don't push a version up
    onSelect?.(isFree ? null : selected || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, versions, isFree])

  if (isFree || versions.length === 0) return null

  return (
    <div className="wf-vp" data-reveal>
      <div className="wf-vp-head">
        <span className="wf-vp-label">Version · choose your cut</span>
      </div>

      <div className="wf-vp-chips">
        {versions.map((v) => (
          <span key={v.id} className={`wf-vp-chip${v.id === (selected && selected.id) ? ' active' : ''}`}>
            <button className="wf-vp-chip-btn" onClick={() => setSel(v.id)}>
              {v.name || 'Untitled'}
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}
