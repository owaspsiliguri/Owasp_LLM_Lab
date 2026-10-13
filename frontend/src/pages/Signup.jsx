import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { isAuthEnabled } from '../services/supabase.js'

const MIN_PASSWORD = 8

export default function Signup() {
  const { signUp, session, loading } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  if (isAuthEnabled() && !loading && session) return <Navigate to="/" replace />

  async function submit(e) {
    e.preventDefault()
    setError(null)
    if (!email.includes('@')) { setError('Enter a valid email address.'); return }
    if (password.length < MIN_PASSWORD) { setError(`Password must be at least ${MIN_PASSWORD} characters.`); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setBusy(true)
    try {
      const result = await signUp({ fullName: fullName.trim(), email: email.trim(), password })
      if (result.needsConfirmation) setDone(true)
      else navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  if (!isAuthEnabled()) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="panel p-6 text-center">
          <h1 className="text-xl font-semibold">Create an account</h1>
          <p className="mt-3 text-fog-300">Authentication is not configured on this deployment, so the lab runs in local mode.</p>
          <Link className="btn btn-primary mt-4" to="/">Continue in local mode</Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="panel p-6">
          <h1 className="text-xl font-semibold">Check your email</h1>
          <p className="mt-3 text-fog-300">
            We sent a confirmation link to <strong className="text-fog-100">{email}</strong>. Open it, then come back and sign in.
          </p>
          <p className="mt-2 text-sm text-fog-500">
            (If the admin disabled email confirmation in Supabase, you can sign in right away.)
          </p>
          <Link className="btn btn-primary mt-4" to="/login">Go to sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="panel p-6">
        <h1 className="text-xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-fog-300">Free for students. Your progress is saved to your account.</p>
        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          <label className="block text-sm text-fog-300">
            Full name <span className="text-fog-500">(optional)</span>
            <input aria-label="Full name" type="text" autoComplete="name" className="input mt-1" value={fullName}
              onChange={(e) => setFullName(e.target.value)} placeholder="Ada Lovelace" maxLength={120} />
          </label>
          <label className="block text-sm text-fog-300">
            Email
            <input aria-label="Email" type="email" autoComplete="email" className="input mt-1" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" maxLength={200} required />
          </label>
          <label className="block text-sm text-fog-300">
            Password <span className="text-fog-500">(min {MIN_PASSWORD} characters)</span>
            <input aria-label="Password" type="password" autoComplete="new-password" className="input mt-1" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Choose a strong password" maxLength={200} required />
          </label>
          <label className="block text-sm text-fog-300">
            Confirm password
            <input aria-label="Confirm password" type="password" autoComplete="new-password" className="input mt-1" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat the password" maxLength={200} required />
          </label>
          {error && <p role="alert" className="rounded border border-vuln-400/50 bg-vuln-400/10 px-3 py-2 text-sm text-vuln-400">{error}</p>}
          <button className="btn btn-primary w-full" type="submit" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="mt-4 text-sm text-fog-300">
          Already registered? <Link className="text-steel-400 underline" to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
