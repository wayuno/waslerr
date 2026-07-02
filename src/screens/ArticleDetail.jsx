import { useRef } from 'react'
import Background from '../components/Background'
import { useStore } from '../store/StoreProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'

export default function ArticleDetail() {
  const { selectedArticle, navigate } = useStore()
  const ref = useRef(null)
  useReveal(ref)
  useMagnetic(ref)

  const a = selectedArticle

  if (!a) {
    navigate('home')
    return null
  }

  // split body into paragraphs on double-newline or single newline
  const paragraphs = (a.body || '').split(/\n\n+|\r\n\r\n+/).map((p) => p.trim()).filter(Boolean)

  return (
    <div className="wf-app" ref={ref}>
      <Background resonanceTop="30%" />

      <section className="wf-art-section">
        <button className="wf-back wf-art-back" onClick={() => navigate('home')} data-reveal>
          ← Back to articles
        </button>

        <div className="wf-art-card" data-reveal>
          {/* medium featured image */}
          <div className="wf-art-image">
            {a.image_url ? (
              <img src={a.image_url} alt={a.title} loading="lazy" />
            ) : (
              <div className="wf-art-image-glyph" aria-hidden="true">
                {(a.title || 'W').charAt(0)}
              </div>
            )}
          </div>

          {/* centered article content */}
          <div className="wf-art-content">
            <span className="wf-arts-badge" style={{ margin: '0 auto 16px' }}>
              Article
            </span>
            <div className="wf-arts-date" style={{ textAlign: 'center', marginBottom: 14 }}>
              {a.date}
            </div>
            <h1 className="wf-art-title">{a.title}</h1>

            {paragraphs.length > 0 ? (
              <div className="wf-art-paragraphs">
                {paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            ) : (
              <p className="wf-art-paragraphs-empty">No content yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
