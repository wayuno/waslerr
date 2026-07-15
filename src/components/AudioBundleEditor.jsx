// Admin: attach MANY files to a field (or a version) — audio, zips, PDFs,
// anything the buyer should receive. Shows already-saved files (with remove)
// plus newly-picked files waiting to upload (with remove), and a multi-select
// file input. `existing` = [{ path, name, size }] already on the record;
// `pending` = File[] chosen now. Buyers get every file in the bundle.
const fileIcon = (name = '') =>
  /\.(mp3|wav|m4a|aac|flac|ogg|opus|aiff?)$/i.test(name) ? '♪'
    : /\.(zip|rar|7z|tar|gz)$/i.test(name) ? '🗜'
    : '📄'

export default function AudioBundleEditor({ label = 'Files', hint, existing = [], setExisting, pending = [], setPending }) {
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
              {fileIcon(a.name)} {a.name || 'File'}
              <span className="wf-audio-mini set">set</span>
              {setExisting && (
                <button type="button" aria-label="Remove" onClick={() => setExisting(existing.filter((_, j) => j !== i))}>✕</button>
              )}
            </span>
          ))}
          {pending.map((f, i) => (
            <span className="wf-audio-chip new" key={'p' + i}>
              {fileIcon(f.name)} {f.name}
              <span className="wf-audio-mini new">new</span>
              <button type="button" aria-label="Remove" onClick={() => setPending(pending.filter((_, j) => j !== i))}>✕</button>
            </span>
          ))}
        </div>
      )}
      {/* no `accept` — audio, zips, PDFs, anything goes; big files upload straight to storage */}
      <input className="wf-input wf-file" type="file" multiple onChange={addFiles} />
    </label>
  )
}
