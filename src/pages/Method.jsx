import { useRef } from 'react'
import Background from '../components/Background'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'
import { methodSteps } from '../data/content'
import { ArrowRight } from '../components/icons'

export default function Method({ onNavigate }) {
  const ref = useRef(null)
  useReveal(ref)
  useMagnetic(ref)

  return (
    <div className="wf-app" ref={ref}>
      <Background resonanceTop="48%" />

      <section className="wf-subhead" style={{ maxWidth: 760, padding: '90px 28px 40px' }}>
        <div className="wf-eyebrow" data-reveal>
          The method
        </div>
        <h1 className="wf-page-h1" data-reveal>
          How subliminals rewire the mind.
        </h1>
        <p className="wf-page-lead" data-reveal>
          Four quiet steps from first listen to a changed default. No effort, no forcing — just repetition beneath the
          conscious filter.
        </p>
      </section>

      <section className="wf-section" style={{ maxWidth: 760, margin: '0 auto', padding: '30px 28px 90px' }}>
        <div className="wf-timeline">
          <div className="wf-timeline-spine" />
          {methodSteps.map((s, i) => (
            <div className="wf-step" data-reveal key={s.num}>
              <span className={`wf-step-num${i === methodSteps.length - 1 ? ' lit' : ''}`}>{s.num}</span>
              <div className="wf-step-body">
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div data-reveal style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 60, flexWrap: 'wrap' }}>
          <button className="wf-btn wf-btn-gold wf-mag" onClick={() => onNavigate({ page: 'fields' })}>
            Explore the fields <ArrowRight />
          </button>
          <button className="wf-btn wf-btn-glass wf-mag" onClick={() => onNavigate({ page: 'home', section: 'wf-free' })}>
            Try a field free
          </button>
        </div>
      </section>

      <footer className="wf-subfoot">
        <div className="wf-subfoot-row">
          <button className="wf-back" onClick={() => onNavigate({ page: 'home' })}>
            ← Back to home
          </button>
          <span className="wf-subfoot-note">
            Audio supports mindset &amp; self-improvement. Not medical treatment. Individual results vary.
          </span>
        </div>
      </footer>
    </div>
  )
}
