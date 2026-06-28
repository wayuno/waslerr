import { useState } from 'react'
import { EyeIcon, EyeOffIcon } from './icons'

// Password field with a show/hide eye toggle. Drop-in for the .wf-input used in
// the auth screens.
export default function PasswordInput({ value, onChange, placeholder = '••••••••', autoComplete = 'current-password' }) {
  const [show, setShow] = useState(false)
  return (
    <div className="wf-pass-wrap">
      <input
        className="wf-input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="wf-pass-eye"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        tabIndex={-1}
      >
        {show ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
      </button>
    </div>
  )
}
