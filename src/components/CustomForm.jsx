import { useRef, useState } from 'react'
import { customBenefits, focusOptions } from '../data/content'
import { useStore } from '../store/StoreProvider'
import { CheckIcon } from './icons'

export default function CustomForm() {
  const { requestViaChat, user, loggedIn } = useStore()
  const formRef = useRef(null)
  const [submitted, setSubmitted] = useState(false)
  const [name, setName] = useState('')
  const [focus, setFocus] = useState('')
  const [otherFocus, setOtherFocus] = useState('') // free text when "Something else"
  const [err, setErr] = useState('')

  const onSubmit = (e) => {
    e.preventDefault()
    setErr('')
    const form = formRef.current
    if (!form.reportValidity()) return
    if (!focus) return setErr('Choose a focus area.')
    const focusValue = focus === 'other' ? otherFocus.trim() : focus
    if (focus === 'other' && !focusValue) return setErr('Tell us what your focus is.')
    const fd = new FormData(form)
    const submittedName = (fd.get('name') || '').toString().trim()
    const payload = {
      name: submittedName,
      email: loggedIn ? user || '' : '', // always the signed-in account's email
      focus: focusValue,
      intention: (fd.get('intention') || '').toString(),
    }
    // custom code is members-only — requestViaChat redirects guests to sign-in
    if (!loggedIn) return requestViaChat(payload)
    try {
      const list = JSON.parse(localStorage.getItem('wf_custom_requests') || '[]')
      list.push({ ...payload, ts: Date.now() })
      localStorage.setItem('wf_custom_requests', JSON.stringify(list))
    } catch {
      /* storage unavailable — proceed to confirmation regardless */
    }
    setName(submittedName)
    setSubmitted(true)
    // also route the request through the support chat
    requestViaChat(payload)
  }

  const reset = () => {
    formRef.current?.reset()
    setFocus('')
    setOtherFocus('')
    setErr('')
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
                <label className="wf-field" style={loggedIn ? undefined : { gridColumn: '1 / -1' }}>
                  <span className="wf-field-label">Name</span>
                  <input className="wf-input" name="name" type="text" placeholder="Your name" />
                </label>
                {loggedIn && (
                  <label className="wf-field">
                    <span className="wf-field-label">Email · your account</span>
                    <input
                      className="wf-input"
                      name="email"
                      type="email"
                      value={user || ''}
                      readOnly
                      title="Linked to your signed-in account"
                      style={{ opacity: 0.7, cursor: 'not-allowed' }}
                    />
                  </label>
                )}
              </div>
              <label className="wf-field">
                <span className="wf-field-label">Focus area</span>
                <select className="wf-select" name="focus" required value={focus} onChange={(e) => setFocus(e.target.value)}>
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
              {focus === 'other' && (
                <label className="wf-field">
                  <span className="wf-field-label">Tell us your focus</span>
                  <input
                    className="wf-input"
                    type="text"
                    value={otherFocus}
                    onChange={(e) => setOtherFocus(e.target.value)}
                    placeholder="Describe the focus of your field"
                  />
                </label>
              )}
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
              {err && <p className="wf-auth-error" style={{ margin: 0 }}>{err}</p>}
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
