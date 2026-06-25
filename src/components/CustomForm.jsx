import { useRef, useState } from 'react'
import { customBenefits, focusOptions } from '../data/content'
import { CheckIcon } from './icons'

export default function CustomForm() {
  const formRef = useRef(null)
  const [submitted, setSubmitted] = useState(false)
  const [name, setName] = useState('')

  const onSubmit = (e) => {
    e.preventDefault()
    const form = formRef.current
    if (!form.reportValidity()) return
    const fd = new FormData(form)
    const submittedName = (fd.get('name') || '').toString().trim()
    try {
      const list = JSON.parse(localStorage.getItem('wf_custom_requests') || '[]')
      list.push({
        name: submittedName,
        email: fd.get('email'),
        focus: fd.get('focus'),
        intention: fd.get('intention'),
        ts: Date.now(),
      })
      localStorage.setItem('wf_custom_requests', JSON.stringify(list))
    } catch {
      /* storage unavailable — proceed to confirmation regardless */
    }
    setName(submittedName)
    setSubmitted(true)
  }

  const reset = () => {
    formRef.current?.reset()
    setSubmitted(false)
  }

  return (
    <div className="wf-custom-split" id="wf-custom-form-anchor">
      <div data-reveal>
        <div className="wf-eyebrow" style={{ letterSpacing: '0.22em', marginBottom: 16 }}>
          Custom Code
        </div>
        <h3 className="wf-custom-h3">A field built for you alone.</h3>
        <p className="wf-custom-p">
          Tell us the life you&apos;re engineering. We write the affirmation architecture, choose your frequencies,
          master it for headphones, and deliver a field that exists nowhere else.
        </p>
        <ul className="wf-check-list">
          {customBenefits.map((b) => (
            <li key={b}>
              <CheckIcon />
              {b}
            </li>
          ))}
        </ul>
      </div>

      <div data-reveal style={{ position: 'relative' }}>
        {!submitted ? (
          <div className="wf-form-card">
            <form ref={formRef} className="wf-form" noValidate onSubmit={onSubmit}>
              <div className="wf-form-row">
                <label className="wf-field">
                  <span className="wf-field-label">Name</span>
                  <input className="wf-input" name="name" type="text" placeholder="Your name" />
                </label>
                <label className="wf-field">
                  <span className="wf-field-label">Email *</span>
                  <input className="wf-input" name="email" type="email" required placeholder="you@email.com" />
                </label>
              </div>
              <label className="wf-field">
                <span className="wf-field-label">Focus area</span>
                <select className="wf-select" name="focus" required defaultValue="">
                  <option value="" disabled>
                    Choose a focus…
                  </option>
                  {focusOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="wf-field">
                <span className="wf-field-label">Your intention</span>
                <textarea
                  className="wf-textarea"
                  name="intention"
                  rows="4"
                  required
                  placeholder="Describe the outcome you want to engineer — be as specific as you like."
                />
              </label>
              <button type="submit" className="wf-form-submit wf-mag">
                Request your custom field
              </button>
              <p className="wf-form-note">No payment now — we scope your field and send a quote.</p>
            </form>
          </div>
        ) : (
          <div className="wf-success">
            <span className="wf-success-ic">
              <CheckIcon size={26} stroke={2.2} />
            </span>
            <h3 className="wf-line-title" style={{ fontSize: 30, marginBottom: 12 }}>
              Request received{name ? `, ${name}` : ''}.
            </h3>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: '#9298a6', fontWeight: 300, margin: '0 0 22px', maxWidth: 360 }}>
              We&apos;ll craft your field and email a scope within 7 days. Keep an eye on your inbox.
            </p>
            <button
              className="wf-mag"
              onClick={reset}
              style={{
                fontFamily: 'var(--wf-sans)',
                fontSize: 14,
                color: '#e7e9ee',
                background: 'var(--wf-glass-2)',
                border: '1px solid var(--wf-rule)',
                padding: '11px 22px',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Send another request
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
