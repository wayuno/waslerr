import { useRef, useState } from 'react'
import Background from '../components/Background'
import { useStore } from '../store/StoreProvider'
import { useReveal } from '../hooks/useReveal'
import { useMagnetic } from '../hooks/useMagnetic'

export default function Login() {
  const { login } = useStore()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const ref = useRef(null)
  useReveal(ref)
  useMagnetic(ref)

  const signup = mode === 'signup'

  const submit = (e) => {
    e.preventDefault()
    if (!email.trim()) return
    // admin email + correct password → real admin session (verified server-side);
    // anything else → demo customer session
    login(email.trim(), pass)
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

          <button type="submit" className="wf-form-submit wf-mag" style={{ width: '100%', marginTop: 6 }}>
            {signup ? 'Create account' : 'Enter the field'}
          </button>

          <p className="wf-form-note" style={{ marginTop: 16 }}>
            {signup ? 'Already have an account? ' : 'New here? '}
            <button
              type="button"
              className="wf-auth-toggle"
              onClick={() => setMode(signup ? 'signin' : 'signup')}
            >
              {signup ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </form>
      </section>
    </div>
  )
}
