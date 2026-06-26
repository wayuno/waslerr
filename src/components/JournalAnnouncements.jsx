import { useStore } from '../store/StoreProvider'
import { BookmarkIcon } from './icons'

const TAG_COLORS = { 'NEW FIELD': '#d4af37', ENGINE: '#6ba8c9', COMMUNITY: '#7fb98a' }
const hexToRgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
const tagMeta = (t) => {
  const c = TAG_COLORS[(t || '').toUpperCase()] || '#d4af37'
  return { color: c, bg: hexToRgba(c, 0.16), border: hexToRgba(c, 0.4) }
}
const readTime = (body) => {
  const words = (body || '').trim().split(/\s+/).filter(Boolean).length
  return Math.max(2, Math.round(words / 180)) + ' min read'
}

// Homepage Journal (editorial) + Announcements (changelog rail) — split by tag.
export default function JournalAnnouncements({ onNavigate }) {
  const { announcements } = useStore()
  const isBlog = (p) => (p.tag || '').toUpperCase() === 'BLOG'
  const blogs = announcements.filter(isBlog)
  const feat = blogs[0]
  const rest = blogs.slice(1, 3)
  const announce = announcements.filter((p) => !isBlog(p)).slice(0, 4)
  const toUpdates = () => onNavigate({ page: 'updates' })

  return (
    <section className="wf-section wf-section--rule wf-pad" id="journal">
      <div className="wf-container">
        <div className="wf-ja-grid">
          {/* ---- LEFT: The Journal (editorial) ---- */}
          <div data-reveal>
            <div className="wf-jr-head">
              <div>
                <div className="wf-eyebrow" style={{ marginBottom: 10 }}>
                  The Journal
                </div>
                <h2 className="wf-jr-title">Long reads from the lab.</h2>
              </div>
              <button className="wf-jr-all" onClick={toUpdates}>
                All articles →
              </button>
            </div>

            {feat ? (
              <article className="wf-feat" onClick={toUpdates}>
                <div className="wf-feat-cover">
                  <span className="wf-feat-glyph" aria-hidden="true">
                    {(feat.title || 'W').charAt(0)}
                  </span>
                  <span className="wf-feat-pill">
                    <BookmarkIcon /> FEATURED READ · {feat.readTime || readTime(feat.body)}
                  </span>
                </div>
                <div className="wf-feat-body">
                  <div className="wf-feat-date">{feat.date}</div>
                  <h3 className="wf-feat-title">{feat.title}</h3>
                  <p className="wf-feat-excerpt">{feat.body}</p>
                  <span className="wf-feat-read">Read article →</span>
                </div>
              </article>
            ) : (
              <article className="wf-feat" onClick={toUpdates}>
                <div className="wf-feat-cover">
                  <span className="wf-feat-glyph" aria-hidden="true">
                    W
                  </span>
                  <span className="wf-feat-pill">
                    <BookmarkIcon /> FEATURED READ
                  </span>
                </div>
                <div className="wf-feat-body">
                  <div className="wf-feat-date">Coming soon</div>
                  <h3 className="wf-feat-title">The first Waslerr long-read is on its way.</h3>
                  <p className="wf-feat-excerpt">
                    Deep dives on subliminal design, the Akashic engine and field-craft — publishing soon. Publish a post
                    tagged BLOG from the admin to feature it here.
                  </p>
                  <span className="wf-feat-read">All articles →</span>
                </div>
              </article>
            )}

            {rest.length > 0 && (
              <div className="wf-more">
                {rest.map((b, i) => (
                  <button className="wf-more-row" key={b.id} onClick={toUpdates}>
                    <span className="wf-more-idx">{String(i + 2).padStart(2, '0')}</span>
                    <span className="wf-more-mid">
                      <span className="wf-more-title">{b.title}</span>
                      <span className="wf-more-meta">
                        {b.readTime || readTime(b.body)} · {b.date}
                      </span>
                    </span>
                    <span className="wf-more-arrow">→</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ---- RIGHT: Announcements (changelog rail) ---- */}
          <aside className="wf-rail" data-reveal>
            <div className="wf-rail-head">
              <span className="wf-rail-live">
                <span className="wf-live-dot" aria-hidden="true" />
                Announcements
              </span>
              <button className="wf-rail-see" onClick={toUpdates}>
                See all
              </button>
            </div>
            <div className="wf-timeline">
              <span className="wf-tl-line" aria-hidden="true" />
              {announce.length === 0 && <p className="wf-detail-desc" style={{ margin: 0 }}>No announcements yet.</p>}
              {announce.map((a) => {
                const m = tagMeta(a.tag)
                return (
                  <div className="wf-tl-item" data-reveal key={a.id}>
                    <span className="wf-tl-dot" style={{ background: m.color, boxShadow: `0 0 10px ${m.color}` }} />
                    <div className="wf-tl-meta">
                      <span className="wf-tl-tag" style={{ color: m.color, background: m.bg, borderColor: m.border }}>
                        {a.tag}
                      </span>
                      <span className="wf-tl-date">{a.date}</span>
                    </div>
                    <div className="wf-tl-title">{a.title}</div>
                  </div>
                )
              })}
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
