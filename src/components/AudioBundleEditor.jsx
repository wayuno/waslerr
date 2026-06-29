// Admin: attach MANY audio files to a field (or a version). Shows already-saved
// files (with remove) plus newly-picked files waiting to upload (with remove),
// and a multi-select file input. `existing` = [{ path, name, size }] already on
// the record; `pending` = File[] chosen now. Buyers get every file in the bundle.
export default function AudioBundleEditor({ label = 'Audio files', hint, existing = [], setExisting, pending = [], setPending }) {
  const addFiles = (e) => {
    const picked = Array.from(e.target.files || [])
    setPending((prev) => {
      const seen = new Set(prev.map((f) => f.name + f.size))
      return [...prev, ...picked.filter((f) => !seen.has(f.name + f.size))]
    })
    e.target.value = '' // allow re-picking the same file
  }
  const total = existing.length + pending.length
  return (
    <label className="wf-field">
      <span className="wf-field-label">
        {label}{total ? ` · ${total}` : ''}{hint ? ` — ${hint}` : ''}
      </span>
      {total > 0 && (
        <div className="wf-audio-list">
          {existing.map((a, i) => (
            <span className="wf-audio-chip" key={'e' + i}>
              ♪ {a.name || 'Audio'}
              <span className="wf-audio-mini set">set</span>
              {setExisting && (
                <button type="button" aria-label="Remove" onClick={() => setExisting(existing.filter((_, j) => j !== i))}>✕</button>
              )}
            </span>
          ))}
          {pending.map((f, i) => (
            <span className="wf-audio-chip new" key={'p' + i}>
              ♪ {f.name}
              <span className="wf-audio-mini new">new</span>
              <button type="button" aria-label="Remove" onClick={() => setPending(pending.filter((_, j) => j !== i))}>✕</button>
            </span>
          ))}
        </div>
      )}
      <input className="wf-input wf-file" type="file" accept="audio/*" multiple onChange={addFiles} />
    </label>
  )
}
