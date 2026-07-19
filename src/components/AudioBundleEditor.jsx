// Admin: attach MANY deliverables to a field (or a version) — uploaded files
// (audio, zips, PDFs…) AND/OR external links (Google Drive, etc.). Shows
// already-saved items (with remove), newly-picked files waiting to upload, a
// multi-select file input, and a "paste a link" box. `existing` =
// [{ path, name, size } | { url, name, isLink }] already on the record;
// `pending` = File[] chosen now. Buyers get every item in the bundle.
import { useState } from 'react'

// compact display of a delivery link so a saved link is unmistakable in the chip
const shortUrl = (url = '') => {
  try {
    const u = new URL(url)
    const tail = (u.pathname + u.search).replace(/\/$/, '')
    const s = u.hostname.replace(/^www\./, '') + tail
    return s.length > 42 ? s.slice(0, 41) + '…' : s
  } catch {
    return url.length > 42 ? url.slice(0, 41) + '…' : url
  }
}

const fileIcon = (item) => {
  if (item && (item.isLink || item.url)) return '🔗'
  const name = (item && item.name) || (typeof item === 'string' ? item : '') || ''
  return /\.(mp3|wav|m4a|aac|flac|ogg|opus|aiff?)$/i.test(name) ? '♪'
    : /\.(zip|rar|7z|tar|gz)$/i.test(name) ? '🗜'
    : '📄'
}

export default function AudioBundleEditor({ label = 'Files', hint, existing = [], setExisting, pending = [], setPending }) {
  const [linkUrl, setLinkUrl] = useState('')
  const [linkName, setLinkName] = useState('')
  const addFiles = (e) => {
    const picked = Array.from(e.target.files || [])
    setPending((prev) => {
      const seen = new Set(prev.map((f) => f.name + f.size))
      return [...prev, ...picked.filter((f) => !seen.has(f.name + f.size))]
    })
    e.target.value = '' // allow re-picking the same file
  }
  const addLink = () => {
    let url = linkUrl.trim()
    if (!url || !setExisting) return
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    setExisting([...(existing || []), { url, name: linkName.trim() || 'Delivery link', isLink: true }])
    setLinkUrl('')
    setLinkName('')
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
            <span className="wf-audio-chip" key={'e' + i} title={a.isLink ? a.url : undefined}>
              {fileIcon(a)} {a.name || (a.isLink ? 'Delivery link' : 'File')}
              {a.isLink && a.url && <span className="wf-audio-url">{shortUrl(a.url)}</span>}
              <span className="wf-audio-mini set">{a.isLink ? 'link ✓' : 'set'}</span>
              {setExisting && (
                <button type="button" aria-label="Remove" onClick={() => setExisting(existing.filter((_, j) => j !== i))}>✕</button>
              )}
            </span>
          ))}
          {pending.map((f, i) => (
            <span className="wf-audio-chip new" key={'p' + i}>
              {fileIcon(f)} {f.name}
              <span className="wf-audio-mini new">new</span>
              <button type="button" aria-label="Remove" onClick={() => setPending(pending.filter((_, j) => j !== i))}>✕</button>
            </span>
          ))}
        </div>
      )}
      {/* no `accept` — audio, zips, PDFs, anything goes; big files upload straight to storage */}
      <input className="wf-input wf-file" type="file" multiple onChange={addFiles} />
      {setExisting && (
        <div className="wf-offer-inc-row" style={{ marginTop: 8 }}>
          <input
            className="wf-input"
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            placeholder="Link label (e.g. Google Drive)"
            style={{ maxWidth: 200 }}
          />
          <input
            className="wf-input"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }}
            placeholder="Paste a delivery link — Drive, Dropbox…"
          />
          <button type="button" className="wf-coupon-apply" onClick={addLink}>Add link</button>
        </div>
      )}
    </label>
  )
}
