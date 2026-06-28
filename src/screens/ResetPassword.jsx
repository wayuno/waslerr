import { useRef, useState } from 'react'
import Background from '../components/Background'
import { useStore } from '../store/StoreProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'

// Reached after a "forgot password" email link signs the user in for recovery.
// They pick a new password here; updateProfile writes it via Supabase.
export default function ResetPassword() {
  const { updateProfile, navigate, loggedIn, showToast } = useStore()
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)
  useReveal(ref)
  useMagnetic(ref)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (pass.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (pass !== pass2) {
      setError('Passwords don’t match.')
      return
    }
    setBusy(true)
    const res = await updateProfile({ password: pass })
    setBusy(false)
    if (res?.error) {
      setError(res.error)
      return
    }
    setDone(true)
    showToast?.('Password updated')
    setTimeout(() => navigate(loggedIn ? 'home' : 'login'), 1200)
  }

  return (
    <div className="wf-app" ref={ref}>
      <Background resonanceTop="50%" />

      <section className="wf-auth" style={{ minHeight: '100vh' }}>
        <form className="wf-auth-card" data-reveal onSubmit={submit}>
          <span className="wf-monogram" style={{ width: 46, height: 46, fontSize: 26, marginBottom: 22 }}>
            W
          </span>
          <h1 className="wf-auth-title">Set a new password</h1>
          <p className="wf-auth-sub">Choose a new password for your Waslerr Fields account.</p>

          <label className="wf-field" style={{ width: '100%' }}>
            <span className="wf-field-label">New password</span>
            <input
              className="wf-input"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </label>
          <label className="wf-field" style={{ width: '100%' }}>
            <span className="wf-field-label">Confirm password</span>
            <input
              className="wf-input"
              type="password"
              value={pass2}
              onChange={(e) => setPass2(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </label>

          {error && <p className="wf-auth-error">{error}</p>}
          {done && <p className="wf-auth-info">Password updated — taking you in…</p>}

          <button type="submit" className="wf-form-submit wf-mag" style={{ width: '100%', marginTop: 6 }} disabled={busy || done}>
            {busy ? 'Saving…' : 'Update password'}
          </button>

          <p className="wf-form-note" style={{ marginTop: 16 }}>
            <button type="button" className="wf-auth-toggle" onClick={() => navigate('login')}>
              Back to sign in
            </button>
          </p>
        </form>
      </section>
    </div>
  )
}
