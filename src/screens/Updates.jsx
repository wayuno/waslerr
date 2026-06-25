import { useRef } from 'react'
import Background from '../components/Background'
import { useStore } from '../store/StoreProvider'
import { useReveal } from '../hooks/useReveal'
import { updates } from '../data/content'

export default function Updates() {
  const { navigate } = useStore()
  const ref = useRef(null)
  useReveal(ref)

  return (
    <div className="wf-app" ref={ref}>
      <Background resonanceTop="50%" />

      <section className="wf-section" style={{ maxWidth: 820, margin: '0 auto', padding: '96px 28px 100px' }}>
        <div className="wf-updates-cover" data-reveal />
        <div className="wf-updates-head">
          <span className="wf-updates-ico">W</span>
          <h1 className="wf-detail-title" data-reveal style={{ marginTop: 14 }}>
            What&apos;s new
          </h1>
          <p className="wf-detail-desc" data-reveal style={{ margin: '10px 0 0' }}>
            New fields, engine updates and notes from the Waslerr lab.
          </p>
        </div>

        <div className="wf-updates-divider" />

        <div className="wf-updates-list">
          {updates.map((u) => (
            <article className="wf-update" data-reveal key={u.title}>
              <div className="wf-update-date">{u.date}</div>
              <div className="wf-update-body">
                <span className={`wf-tag wf-tag--${u.tag.split(' ')[0].toLowerCase()}`}>{u.tag}</span>
                <h3 className="wf-update-title">{u.title}</h3>
                <p className="wf-update-text">{u.body}</p>
              </div>
            </article>
          ))}
        </div>

        <button className="wf-back" data-reveal style={{ marginTop: 48 }} onClick={() => navigate('home')}>
          ← Back to home
        </button>
      </section>
    </div>
  )
}
