import { useRef, useState } from 'react'
import Background from '../components/Background'
import { useStore } from '../store/StoreProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'

export default function Login() {
  const { signIn, signUp } = useStore()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)
  useReveal(ref)
  useMagnetic(ref)

  const signup = mode === 'signup'

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!email.trim() || !pass) {
      setError('Enter your email and password.')
      return
    }
    setBusy(true)
    const res = signup ? await signUp(email, pass, name) : await signIn(email, pass)
    setBusy(false)
    if (res?.error) {
      setError(res.error)
    } else if (res?.needsConfirm) {
      setInfo('Check your inbox to confirm your email, then sign in.')
      setMode('signin')
    }
  }

  return (
    <div className="wf-app" ref={ref}>
      <Background resonanceTop="50%" />

      <section className="wf-auth" style={{ minHeight: '100vh' }}>
        <form className="wf-auth-card" data-reveal onSubmit={submit}>
          <span className="wf-monogram" style={{ width: 46, height: 46, fontSize: 26, marginBottom: 22 }}>
            W
          </span>
          <h1 className="wf-auth-title">{signup ? 'Create your account' : 'Welcome back'}</h1>
          <p className="wf-auth-sub">
            {signup
              ? 'Join Waslerr Fields and unlock your first field.'
              : 'Sign in to access your fields and the Inner Circle.'}
          </p>

          {signup && (
            <label className="wf-field" style={{ width: '100%' }}>
              <span className="wf-field-label">Name</span>
              <input
                className="wf-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </label>
          )}
          <label className="wf-field" style={{ width: '100%' }}>
            <span className="wf-field-label">Email</span>
            <input
              className="wf-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
            />
          </label>
          <label className="wf-field" style={{ width: '100%' }}>
            <span className="wf-field-label">Password</span>
            <input
              className="wf-input"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              autoComplete={signup ? 'new-password' : 'current-password'}
            />
          </label>

          {error && <p className="wf-auth-error">{error}</p>}
          {info && <p className="wf-auth-info">{info}</p>}

          <button type="submit" className="wf-form-submit wf-mag" style={{ width: '100%', marginTop: 6 }} disabled={busy}>
            {busy ? 'Please wait…' : signup ? 'Create account' : 'Enter the field'}
          </button>

          <p className="wf-form-note" style={{ marginTop: 16 }}>
            {signup ? 'Already have an account? ' : 'New here? '}
            <button
              type="button"
              className="wf-auth-toggle"
              onClick={() => {
                setMode(signup ? 'signin' : 'signup')
                setError('')
                setInfo('')
              }}
            >
              {signup ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </form>
      </section>
    </div>
  )
}
